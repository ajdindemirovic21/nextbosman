import Image from "next/image";
import type { Dictionary } from "@/i18n/get-dictionary";
import portrait from "../../public/home/adnan-kovac.jpg";

type Props = {
  home: Dictionary["home"];
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

export function HomeStory({ home }: Props) {
  const lead = home.storyList[0];

  return (
    <aside className="home-story" aria-label={home.storyLabel}>
      <p className="home-story-hand">{home.storyLabel}</p>

      <svg className="home-story-flow" viewBox="0 0 360 280" preserveAspectRatio="none" aria-hidden="true">
        <path
          d="M168 36 C 188 40, 198 58, 204 78"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="1.5"
          strokeDasharray="3.2 4.8"
          strokeLinecap="round"
        />
        <path d="M200 74 l8 8 -10 1" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" />
        <path
          d="M204 150 C 196 176, 176 188, 158 196"
          fill="none"
          stroke="var(--gold)"
          strokeWidth="1.5"
          strokeDasharray="3.2 4.8"
          strokeLinecap="round"
        />
        <path d="M164 192 l-10 6 11 2" fill="none" stroke="var(--gold)" strokeWidth="1.5" strokeLinecap="round" />
      </svg>

      <article className="home-story-card home-story-request">
        <header className="home-story-head">
          <span className="home-story-icon" aria-hidden="true">
            <svg viewBox="0 0 24 24" className="h-3.5 w-3.5">
              <rect
                x="3.5"
                y="6"
                width="17"
                height="12"
                rx="2"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
              />
              <path
                d="M4 7.2L12 13l8-5.8"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.75"
                strokeLinejoin="round"
              />
            </svg>
          </span>
          <h2>{home.storyRequestTitle}</h2>
        </header>
        <p className="home-story-quote">“{home.storyRequestQuote}”</p>
        <ul className="home-story-chips">
          <li>{home.storyChipPosition}</li>
          <li>{home.storyChipAge}</li>
          <li>{home.storyChipEu}</li>
        </ul>
      </article>

      <article className="home-story-card home-story-player">
        <div className="home-story-portrait">
          <Image
            src={portrait}
            alt=""
            width={168}
            height={168}
            sizes="112px"
            className="home-story-portrait-img"
          />
        </div>
        <div className="min-w-0">
          <h2>{home.storyPlayerName}</h2>
          <p className="home-story-meta">{home.storyPlayerMeta}</p>
          <ul className="home-story-matches">
            <li>
              <span className="home-story-check" aria-hidden="true" />
              {home.storyMatchPosition}
            </li>
            <li>
              <span className="home-story-check" aria-hidden="true" />
              {home.storyMatchPassport}
            </li>
            <li>
              <span className="home-story-check" aria-hidden="true" />
              {home.storyMatchFit}
            </li>
          </ul>
        </div>
      </article>

      <article className="home-story-card home-story-list">
        <h2>{home.storyListTitle}</h2>
        <ol>
          {home.storyList.map((row, index) => (
            <li key={row.name}>
              <span className="home-story-num">{index + 1}</span>
              {index === 0 && lead ? (
                <span className="home-story-mini home-story-mini-photo">
                  <Image src={portrait} alt="" width={40} height={40} sizes="28px" />
                </span>
              ) : (
                <span className="home-story-mini" aria-hidden="true">
                  {initials(row.name)}
                </span>
              )}
              <span className="min-w-0">
                <strong>{row.name}</strong>
                <span>{row.meta}</span>
              </span>
              <span className="home-story-dot" title={home.storyMatchNote} />
            </li>
          ))}
        </ol>
        <p className="home-story-note">{home.storyMatchNote}</p>
      </article>
    </aside>
  );
}
