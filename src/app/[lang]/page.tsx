import Link from "next/link";
import { HomePaste } from "@/components/home-paste";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { notFound } from "next/navigation";

const STAT_ICONS = ["⚽", "📄", "🇪🇺"] as const;
const HOW_ICONS = ["⚡", "🎯", "📲"] as const;

export default async function Page({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main className="home">
      <section className="home-hero">
        <p className="kicker text-xs font-semibold uppercase tracking-wider text-emerald-400">
          {dict.home.kicker}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
          {dict.home.slogan}
        </h1>
        <p className="home-lead text-slate-300">{dict.home.lead}</p>
        <ul className="mb-5 flex flex-wrap gap-2">
          {dict.home.stats.map((stat, index) => (
            <li
              key={stat.label}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-800/70 bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-slate-200"
            >
              <span aria-hidden="true">{STAT_ICONS[index]}</span>
              {stat.label}
            </li>
          ))}
        </ul>
        <ul className="mb-4 grid max-w-[720px] grid-cols-1 gap-3 md:grid-cols-3">
          {dict.home.how.map((step, index) => (
            <li
              key={step.title}
              className="rounded-xl border border-slate-800/60 bg-slate-900/50 px-3 py-3 backdrop-blur-md"
            >
              <p className="text-sm font-semibold leading-snug text-white">
                <span aria-hidden="true" className="mr-1.5">
                  {HOW_ICONS[index]}
                </span>
                {step.title}
              </p>
              <p className="mt-1 text-xs leading-snug text-slate-400">{step.text}</p>
            </li>
          ))}
        </ul>
        <HomePaste lang={lang} dict={dict} />
        <p className="home-purpose">{dict.home.purpose}</p>
      </section>

      <section className="home-paths" aria-label={dict.nav.search}>
        <Link
          className="home-card rounded-2xl border border-slate-800/80 bg-slate-900/70 shadow-xl backdrop-blur-md"
          href={`/${lang}/search?status=free`}
        >
          <span className="home-card-kicker">{dict.home.ctaFreeHint}</span>
          <strong>{dict.home.ctaFree}</strong>
        </Link>
        <Link
          className="home-card rounded-2xl border border-slate-800/80 bg-slate-900/70 shadow-xl backdrop-blur-md"
          href={`/${lang}/search?status=expiring`}
        >
          <span className="home-card-kicker">{dict.home.ctaExpiringHint}</span>
          <strong>{dict.home.ctaExpiring}</strong>
        </Link>
        <Link
          className="home-card home-card-accent rounded-2xl shadow-xl backdrop-blur-md"
          href={`/${lang}/search#match`}
        >
          <span className="home-card-kicker">{dict.home.ctaMatchHint}</span>
          <strong>{dict.home.ctaMatch}</strong>
        </Link>
      </section>

      <section className="home-points">
        {dict.home.points.map((point) => (
          <article key={point.title}>
            <h2>{point.title}</h2>
            <p>{point.text}</p>
          </article>
        ))}
      </section>
    </main>
  );
}
