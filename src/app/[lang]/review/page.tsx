import type { Metadata } from "next";
import { Suspense } from "react";
import { ReviewDesk } from "@/components/review-desk";
import { isLocale, type Locale } from "@/i18n/config";
import { getDictionary, type Dictionary } from "@/i18n/get-dictionary";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { buildPageMetadata } from "@/lib/site-metadata";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/review">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return buildPageMetadata(lang, {
    title: dict.meta.reviewTitle,
    description: dict.meta.reviewDescription,
    path: "/review",
    index: false,
  });
}

export default async function ReviewPage({ params }: PageProps<"/[lang]/review">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main className="page">
      <section className="hero hero-compact">
        <p className="kicker text-xs font-semibold uppercase tracking-wider text-emerald-400">
          {dict.review.kicker}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">{dict.review.title}</h1>
        <p className="lede">{dict.review.lead}</p>
      </section>
      <Suspense fallback={null}>
        <ReviewGate locale={lang} dict={dict} />
      </Suspense>
    </main>
  );
}

async function ReviewGate({ locale, dict }: { locale: Locale; dict: Dictionary }) {
  const { admin, user, unconfigured } = await requireAdmin();
  if (unconfigured) {
    return (
      <p className="agent-msg" role="status">
        {dict.review.unconfigured}
      </p>
    );
  }
  if (!user) {
    return (
      <p className="agent-msg" role="status">
        {dict.review.needSignIn}
      </p>
    );
  }
  if (!admin) {
    return (
      <p className="agent-msg" role="status">
        {dict.review.forbidden}
      </p>
    );
  }
  return <ReviewDesk dict={dict} locale={locale} />;
}
