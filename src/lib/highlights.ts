import type { Player } from "@/data/mock-players";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatDate, formatMarketValue } from "@/lib/format";
import { formatSeasonCount, hasSeasonStats } from "@/lib/season-stats";

export function playerHighlightsUrl(playerName: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${playerName} football skills highlights`,
  )}`;
}

export function playerWhatsAppShare(player: Player, dict: Dictionary, locale: string): string {
  const club = player.club ?? player.lastClub;
  const contract =
    player.availability === "free" && player.freeSince
      ? `${dict.status.ended} ${formatDate(player.freeSince, locale)}`
      : player.contractUntil
        ? `${dict.status.until} ${formatDate(player.contractUntil, locale)}`
        : "—";
  const eu = player.euPassport ? " · EU" : "";

  return [
    `*${player.name}*`,
    `${player.position} · ${player.age}`,
    `${club}${player.league ? ` · ${player.league}` : ""}`,
    `${player.nationality}${eu}`,
    `${dict.table.marketValue}: ${formatMarketValue(player.marketValueEur, locale)}`,
    `${dict.profile.contract}: ${contract}`,
    hasSeasonStats(player)
      ? `${dict.profile.matches}: ${formatSeasonCount(player, player.appearances)} · ${dict.profile.goals}: ${formatSeasonCount(player, player.goals)} · ${dict.profile.assists}: ${formatSeasonCount(player, player.assists)}`
      : dict.profile.statsUnavailable,
    "",
    `📹 Highlights: ${playerHighlightsUrl(player.name)}`,
  ].join("\n");
}
