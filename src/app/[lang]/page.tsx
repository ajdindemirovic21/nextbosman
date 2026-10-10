import Link from "next/link";
import { HomePaste } from "@/components/home-paste";
import { QuickShare } from "@/components/quick-share";
import {
  IconContract,
  IconMatch,
  IconPassport,
  IconPaste,
  IconPlayers,
  IconSend,
} from "@/components/icons";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { notFound } from "next/navigation";

const STAT_ICONS = [IconPlayers, IconContract, IconPassport];
const HOW_ICONS = [IconPaste, IconMatch, IconSend];

export default async function Page({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main className="home min-w-0">
      <section className="home-hero min-w-0">
        <p className="kicker text-xs font-semibold uppercase tracking-wider text-emerald-400">
          {dict.home.kicker}
        </p>
        <h1 className="max-w-none text-3xl font-extrabold tracking-tight text-white sm:text-5xl lg:text-6xl">
          {dict.home.slogan}
        </h1>
        <p className="home-lead text-slate-300">{dict.home.lead}</p>
        <ul className="mb-5 flex flex-wrap gap-2">
          {dict.home.stats.map((stat, index) => {
            const Icon = STAT_ICONS[index];
            return (
              <li
                key={stat.label}
                className="inline-flex max-w-full items-center gap-1.5 rounded-full border border-slate-800/70 bg-slate-950/80 px-3 py-1.5 text-xs font-medium text-slate-200"
              >
                <Icon className="h-3.5 w-3.5 text-emerald-400" />
                <span className="min-w-0 break-words">{stat.label}</span>
              </li>
            );
          })}
        </ul>
        <ul className="mb-5 grid w-full max-w-[720px] grid-cols-1 gap-3 md:grid-cols-3">
          {dict.home.how.map((step, index) => {
            const Icon = HOW_ICONS[index];
            return (
              <li
                key={step.title}
                className="min-w-0 rounded-xl border border-slate-800/60 bg-slate-900/50 px-3 py-3 backdrop-blur-md"
              >
                <p className="flex items-start gap-2 text-sm font-semibold leading-snug text-white">
                  <Icon className="mt-0.5 h-4 w-4 text-emerald-400" />
                  <span className="min-w-0 break-words">{step.title}</span>
                </p>
                <p className="mt-1 break-words pl-6 text-xs leading-snug text-slate-400">{step.text}</p>
              </li>
            );
          })}
        </ul>
        <HomePaste lang={lang} dict={dict} />
        <p className="home-purpose">{dict.home.purpose}</p>
      </section>

      <section className="home-paths" aria-label={dict.nav.search}>
        <article className="home-card rounded-2xl border border-slate-800/80 bg-slate-900/70 shadow-xl backdrop-blur-md">
          <Link className="home-card-link" href={`/${lang}/search?status=free`}>
            <span className="home-card-kicker">{dict.home.ctaFreeHint}</span>
            <strong>{dict.home.ctaFree}</strong>
          </Link>
          <QuickShare dict={dict} path={`/${lang}/search?status=free`} />
        </article>
        <article className="home-card rounded-2xl border border-slate-800/80 bg-slate-900/70 shadow-xl backdrop-blur-md">
          <Link className="home-card-link" href={`/${lang}/search?status=expiring`}>
            <span className="home-card-kicker">{dict.home.ctaExpiringHint}</span>
            <strong>{dict.home.ctaExpiring}</strong>
          </Link>
          <QuickShare dict={dict} path={`/${lang}/search?status=expiring`} />
        </article>
        <article className="home-card home-card-accent rounded-2xl shadow-xl backdrop-blur-md">
          <Link className="home-card-link" href={`/${lang}/search#match`}>
            <span className="home-card-kicker">{dict.home.ctaMatchHint}</span>
            <strong>{dict.home.ctaMatch}</strong>
          </Link>
          <QuickShare dict={dict} path={`/${lang}/search#match`} accent />
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
