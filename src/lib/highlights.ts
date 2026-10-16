import type { Player } from "@/data/mock-players";
import type { Dictionary } from "@/i18n/get-dictionary";
import { contractShareLine, formatListedClub } from "@/lib/contract-display";
import { formatMarketValue } from "@/lib/format";
import { parseTransfermarktProfileUrl } from "@/lib/profile-url";
import { formatSeasonCount, hasSeasonStats } from "@/lib/season-stats";

export function playerHighlightsUrl(playerName: string): string {
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(
    `${playerName} football skills highlights`,
  )}`;
}

export function playerWhatsAppShare(player: Player, dict: Dictionary, locale: string): string {
  const profileUrl = parseTransfermarktProfileUrl(player.profileUrl, player.id);
  const club = formatListedClub(player, dict);
  const contract = contractShareLine(player, dict, locale);
  const eu = player.euPassport ? " · EU" : "";
  const summary = [
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
    `${dict.profile.youtubeSearch}: ${playerHighlightsUrl(player.name)}`,
  ];

  if (!profileUrl) return summary.join("\n");
  return [profileUrl, "", ...summary].join("\n");
}
