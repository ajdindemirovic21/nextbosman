"use client";

import { HighlightsLink } from "@/components/highlights-link";
import { WhatsAppShare } from "@/components/whatsapp-share";
import type { Player } from "@/data/mock-players";
import type { Dictionary } from "@/i18n/get-dictionary";
import { nationalityFlagSrc } from "@/lib/flags";
import { formatDate, formatMarketValue } from "@/lib/format";
import type { MatchResult } from "@/lib/match-brief";
import { contractAccent } from "@/lib/player-ui";

type Props = {
  player: Player;
  dict: Dictionary;
  locale: string;
  match: MatchResult | null;
  onClose: () => void;
};

function per90(count: number, minutes: number) {
  if (minutes < 90) return "—";
  return ((count / minutes) * 90).toFixed(2);
}

export function PlayerDrawer({ player, dict, locale, match, onClose }: Props) {
  const club = player.club ?? player.lastClub;
  const accent = contractAccent(player);
  const flagSrc = nationalityFlagSrc(player.nationality);
  const contract =
    player.availability === "free" && player.freeSince
      ? `${dict.status.ended} ${formatDate(player.freeSince, locale)}`
      : player.contractUntil
        ? `${dict.status.until} ${formatDate(player.contractUntil, locale)}`
        : "—";
  const accentClass =
    accent === "soon" ? "stat-accent-soon" : accent === "free" ? "stat-accent-free" : undefined;

  return (
    <div className="drawer-root">
      <button type="button" className="scrim" aria-label={dict.profile.close} onClick={onClose} />
      <aside className="drawer" role="dialog" aria-labelledby="player-drawer-title">
        <button type="button" className="drawer-close min-h-11 w-full md:w-auto" onClick={onClose}>
          {dict.profile.close}
        </button>
        <p className="drawer-kicker">
          {dict.positions[player.position]} · {player.age}
        </p>
        <h2 id="player-drawer-title">{player.name}</h2>
        <p className="drawer-club">{club}</p>

        <div className="drawer-media">
          <HighlightsLink playerName={player.name} dict={dict} />
          <WhatsAppShare player={player} dict={dict} locale={locale} />
        </div>

        {match ? (
          <p className={`fit-badge fit-${match.fit}`}>
            {dict.match[match.fit]} · {match.score}
          </p>
        ) : null}

        <p className="drawer-season">{dict.profile.season}</p>
        <dl className="stat-grid">
          <div>
            <dt>{dict.profile.matches}</dt>
            <dd>{player.appearances}</dd>
          </div>
          <div>
            <dt>{dict.profile.goals}</dt>
            <dd>{player.goals}</dd>
          </div>
          <div>
            <dt>{dict.profile.assists}</dt>
            <dd>{player.assists}</dd>
          </div>
          <div>
            <dt>{dict.profile.minutes}</dt>
            <dd>{player.minutesPlayed.toLocaleString(locale)}</dd>
          </div>
          <div>
            <dt>{dict.profile.per90Goals}</dt>
            <dd>{per90(player.goals, player.minutesPlayed)}</dd>
          </div>
          <div>
            <dt>{dict.profile.per90Assists}</dt>
            <dd>{per90(player.assists, player.minutesPlayed)}</dd>
          </div>
          <div>
            <dt>{dict.profile.born}</dt>
            <dd>{formatDate(player.dateOfBirth, locale)}</dd>
          </div>
          <div>
            <dt>{dict.profile.nationality}</dt>
            <dd className="nat-value">
              {flagSrc ? (
                <img className="nat-flag" src={flagSrc} alt="" width={22} height={16} />
              ) : null}
              <span>{player.nationality}</span>
              {player.euPassport ? <span className="eu">EU</span> : null}
            </dd>
          </div>
          {player.internationalCaps > 0 ? (
            <div>
              <dt>{dict.profile.caps}</dt>
              <dd>
                {player.internationalCaps}
                {player.internationalGoals > 0 ? ` · ${player.internationalGoals} G` : ""}
              </dd>
            </div>
          ) : null}
          <div>
            <dt>{dict.table.marketValue}</dt>
            <dd className={accentClass}>{formatMarketValue(player.marketValueEur, locale)}</dd>
          </div>
          <div>
            <dt>{dict.profile.contract}</dt>
            <dd className={accentClass}>{contract}</dd>
          </div>
        </dl>

        {match ? (
          <ul className="reason-list">
            {match.reasons.map((reason) => (
              <li key={reason}>{dict.match.reasons[reason as keyof typeof dict.match.reasons]}</li>
            ))}
          </ul>
        ) : null}
      </aside>
    </div>
  );
}
