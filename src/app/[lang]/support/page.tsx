import type { Metadata } from "next";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { buildPageMetadata } from "@/lib/site-metadata";
import { getDonationUrl } from "@/lib/support";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]/support">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    ...buildPageMetadata(lang, {
      title: dict.meta.supportTitle,
      description: dict.meta.supportDescription,
      path: "/support",
    }),
    title: { absolute: dict.meta.supportTitle },
  };
}

export default async function SupportPage({ params }: PageProps<"/[lang]/support">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);
  const donateHref = getDonationUrl();

  return (
    <main className="page support">
      <p className="kicker text-xs font-semibold uppercase tracking-wider text-emerald-400">
        {dict.support.kicker}
      </p>
      <h1 className="text-3xl font-extrabold tracking-tight text-white">{dict.support.title}</h1>
      <p className="lede">{dict.support.lead}</p>

      <section className="support-grid">
        <article className="rounded-2xl border border-slate-800/80 bg-slate-900/70 shadow-xl backdrop-blur-md">
          <h2>{dict.support.freeTitle}</h2>
          <p>{dict.support.freeText}</p>
        </article>
        <article className="rounded-2xl border border-slate-800/80 bg-slate-900/70 shadow-xl backdrop-blur-md">
          <h2>{dict.support.donateTitle}</h2>
          <p>{dict.support.donateText}</p>
          {donateHref ? (
            <a className="btn-primary" href={donateHref} rel="noreferrer" target="_blank">
              {dict.support.donateCta}
            </a>
          ) : (
            <p className="support-soon">{dict.support.donateSoon}</p>
          )}
        </article>
        <article className="rounded-2xl border border-slate-800/80 bg-slate-900/70 shadow-xl backdrop-blur-md">
          <h2>{dict.support.proTitle}</h2>
          <p className="support-price">{dict.support.proPrice}</p>
          <p>{dict.support.proText}</p>
          <ul>
            {dict.support.proItems.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </article>
      </section>
    </main>
  );
}
