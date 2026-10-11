"use client";

import { HighlightsLink } from "@/components/highlights-link";
import { QuickShare } from "@/components/quick-share";
import type { Player } from "@/data/mock-players";
import type { Dictionary } from "@/i18n/get-dictionary";
import { nationalityFlagSrc } from "@/lib/flags";
import { contractNote, contractPrimary, formatListedClub } from "@/lib/contract-display";
import { formatDate, formatMarketValue } from "@/lib/format";
import type { MatchResult } from "@/lib/match-brief";
import { playerWhatsAppShare } from "@/lib/highlights";
import { contractAccent } from "@/lib/player-ui";
import { formatSeasonCount, hasSeasonStats } from "@/lib/season-stats";

type Props = {
  player: Player;
  dict: Dictionary;
  locale: string;
  match: MatchResult | null;
  sharePath: string;
  onClose: () => void;
};

function per90(player: Player, count: number) {
  if (!hasSeasonStats(player) || player.minutesPlayed < 90) return "—";
  return ((count / player.minutesPlayed) * 90).toFixed(2);
}

export function PlayerDrawer({ player, dict, locale, match, sharePath, onClose }: Props) {
  const club = formatListedClub(player, dict);
  const accent = contractAccent(player);
  const flagSrc = nationalityFlagSrc(player.nationality);
  const contract = contractPrimary(player, dict, locale);
  const contractExtra = contractNote(player, dict);
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
          <QuickShare
            dict={dict}
            path={sharePath}
            text={playerWhatsAppShare(player, dict, locale)}
          />
        </div>

        {match ? (
          <p className={`fit-badge fit-${match.fit}`}>
            {dict.match[match.fit]} · {match.score}
          </p>
        ) : null}

        <p className="drawer-season">{dict.profile.season}</p>
        {hasSeasonStats(player) ? null : (
          <p className="drawer-stats-unavailable" role="status">
            {dict.profile.statsUnavailable}
          </p>
        )}
        <dl className="stat-grid">
          <div>
            <dt>{dict.profile.matches}</dt>
            <dd>{formatSeasonCount(player, player.appearances)}</dd>
          </div>
          <div>
            <dt>{dict.profile.goals}</dt>
            <dd>{formatSeasonCount(player, player.goals)}</dd>
          </div>
          <div>
            <dt>{dict.profile.assists}</dt>
            <dd>{formatSeasonCount(player, player.assists)}</dd>
          </div>
          <div>
            <dt>{dict.profile.minutes}</dt>
            <dd>{formatSeasonCount(player, player.minutesPlayed, locale)}</dd>
          </div>
          <div>
            <dt>{dict.profile.per90Goals}</dt>
            <dd>{per90(player, player.goals)}</dd>
          </div>
          <div>
            <dt>{dict.profile.per90Assists}</dt>
            <dd>{per90(player, player.assists)}</dd>
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
            <dd className={accentClass}>
              <span>{contract}</span>
              {contractExtra ? <span className="block text-xs font-medium text-slate-400">{contractExtra}</span> : null}
            </dd>
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
