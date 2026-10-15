import type { Metadata } from "next";
import Link from "next/link";
import { HomePaste } from "@/components/home-paste";
import { IconMatch, IconPaste, IconSend } from "@/components/icons";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { buildPageMetadata } from "@/lib/site-metadata";
import { notFound } from "next/navigation";

export async function generateMetadata({
  params,
}: PageProps<"/[lang]">): Promise<Metadata> {
  const { lang } = await params;
  if (!isLocale(lang)) return {};
  const dict = await getDictionary(lang);
  return {
    ...buildPageMetadata(lang, {
      title: dict.meta.title,
      description: dict.meta.description,
    }),
    title: { absolute: dict.meta.title },
  };
}

const HOW_ICONS = [IconPaste, IconMatch, IconSend];

export default async function Page({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main className="home min-w-0">
      <section className="home-hero min-w-0">
        <p className="kicker text-sm font-medium text-slate-400">
          {dict.home.kicker}
        </p>
        <h1 className="home-title">{dict.home.slogan}</h1>
        <p className="home-lead">{dict.home.lead}</p>
        <HomePaste lang={lang} dict={dict} />
        <ol className="home-how">
          {dict.home.how.map((step, index) => {
            const Icon = HOW_ICONS[index];
            return (
              <li key={step.title}>
                <Icon className="h-4 w-4 shrink-0 text-slate-400" />
                <span>
                  <strong>{step.title}</strong>
                  <span>{step.text}</span>
                </span>
              </li>
            );
          })}
        </ol>
        <p className="home-disclaimer">{dict.home.disclaimer}</p>
      </section>

      <section className="home-paths" aria-label={dict.nav.search}>
        <article className="home-card">
          <Link className="home-card-link" href={`/${lang}/search?status=free`}>
            <span className="home-card-kicker">{dict.home.ctaFreeHint}</span>
            <strong>{dict.home.ctaFree}</strong>
          </Link>
        </article>
        <article className="home-card">
          <Link className="home-card-link" href={`/${lang}/search?status=expiring`}>
            <span className="home-card-kicker">{dict.home.ctaExpiringHint}</span>
            <strong>{dict.home.ctaExpiring}</strong>
          </Link>
        </article>
        <article className="home-card home-card-accent">
          <Link className="home-card-link" href={`/${lang}/search#match`}>
            <span className="home-card-kicker">{dict.home.ctaMatchHint}</span>
            <strong>{dict.home.ctaMatch}</strong>
          </Link>
        </article>
      </section>

      <section className="home-points">
        {dict.home.points.map((point) => (
          <article key={point.title} className="min-w-0">
            <h2 className="break-words">{point.title}</h2>
            <p className="break-words">{point.text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
