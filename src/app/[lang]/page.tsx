import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { HomePaste } from "@/components/home-paste";
import { HomeStory } from "@/components/home-story";
import { IconLists, IconMatch, IconPaste } from "@/components/icons";
import { isLocale } from "@/i18n/config";
import { getDictionary } from "@/i18n/get-dictionary";
import { buildPageMetadata } from "@/lib/site-metadata";
import { notFound } from "next/navigation";
import deskPhoto from "../../../public/home/agent-desk.jpg";
import pitchGlow from "../../../public/home/pitch-glow.jpg";
import moreBoots from "../../../public/home/more-boots.jpg";
import moreCrowd from "../../../public/home/more-crowd.jpg";

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

const HOW_ICONS = [IconPaste, IconMatch, IconLists];

export default async function Page({ params }: PageProps<"/[lang]">) {
  const { lang } = await params;
  if (!isLocale(lang)) notFound();
  const dict = await getDictionary(lang);

  return (
    <main className="home min-w-0">
      <section className="home-stage">
        <div className="home-stage-media" aria-hidden="true">
          <Image
            src={deskPhoto}
            alt=""
            fill
            priority
            sizes="(max-width: 767px) 100vw, 1180px"
            className="home-stage-photo"
          />
          <Image
            src={pitchGlow}
            alt=""
            fill
            sizes="(max-width: 767px) 0px, 42vw"
            className="home-stage-pitch"
          />
          <svg className="home-stage-tactics" viewBox="0 0 420 360" aria-hidden="true">
            <g fill="none" stroke="rgba(236, 228, 204, 0.22)" strokeWidth="1.1">
              <rect x="48" y="28" width="340" height="300" rx="8" />
              <line x1="218" y1="28" x2="218" y2="328" />
              <circle cx="218" cy="178" r="46" />
              <rect x="48" y="108" width="58" height="140" />
              <rect x="330" y="108" width="58" height="140" />
              <circle cx="92" cy="178" r="18" />
              <circle cx="344" cy="178" r="18" />
              <path d="M48 178 H388" strokeDasharray="3 7" />
            </g>
          </svg>
          <div className="home-stage-shade" />
        </div>

        <div className="home-stage-copy">
          <p className="kicker home-kicker">{dict.home.kicker}</p>
          <h1 className="home-title">
            {dict.home.slogan}{" "}
            <span className="home-title-accent">{dict.home.sloganAccent}</span>
          </h1>
          <p className="home-lead">{dict.home.lead}</p>
          <HomePaste lang={lang} dict={dict} />
        </div>

        <HomeStory home={dict.home} />
      </section>

      <div className="home-band">
        <ol className="home-how">
          {dict.home.how.map((step, index) => {
            const Icon = HOW_ICONS[index];
            return (
              <li key={step.title}>
                <span className="home-how-num">0{index + 1}</span>
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
      </div>

      <section className="home-more">
        <div className="home-more-copy">
          <p className="home-kicker">{dict.home.moreKicker}</p>
          <h2 className="home-more-title">
            {dict.home.moreTitle}{" "}
            <span className="home-title-accent">{dict.home.moreTitleAccent}</span>
          </h2>
        </div>
        <div className="home-more-photos" aria-hidden="true">
          <div className="home-more-frame home-more-crowd">
            <Image src={moreCrowd} alt="" fill sizes="(max-width: 767px) 70vw, 420px" className="object-cover" />
          </div>
          <div className="home-more-frame home-more-boots">
            <Image src={moreBoots} alt="" fill sizes="(max-width: 767px) 55vw, 340px" className="object-cover" />
          </div>
          <div className="home-more-frame home-more-board">
            <Image src={pitchGlow} alt="" fill sizes="(max-width: 767px) 40vw, 240px" className="object-cover" />
          </div>
        </div>
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
