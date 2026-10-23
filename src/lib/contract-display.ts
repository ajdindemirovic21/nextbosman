import type { Player } from "@/data/mock-players";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatDate } from "@/lib/format";
import { effectiveClub, effectiveContract } from "@/lib/player-review";
import { sourceUrlHost } from "@/lib/public-source-url";

function hasClubName(value: string | null | undefined): value is string {
  return Boolean(value && value !== "—");
}

export function formatListedClub(player: Player, dict: Dictionary): string {
  const review = player.manualReview ?? null;
  if (review) {
    const club = effectiveClub(player, review);
    if (club.kind === "none") return dict.status.noClubLabel;
    if (club.kind === "unknown") return dict.status.clubUnknown;
    if (club.kind === "current") return club.name;
    return `${dict.status.listedClub}: ${club.name}`;
  }
  if (hasClubName(player.club)) return player.club;
  if (hasClubName(player.lastClub)) return `${dict.status.listedClub}: ${player.lastClub}`;
  return "—";
}

export function contractPrimary(player: Player, dict: Dictionary, locale: string): string {
  const review = player.manualReview ?? null;
  if (review) {
    const contract = effectiveContract(player, review);
    if (contract.kind === "unknown") return dict.status.contractUnknown;
    if (contract.from === "catalog" && player.freeSince && contract.iso === player.freeSince) {
      return dict.status.listedExpiry.replace("{date}", formatDate(contract.iso, locale));
    }
    return dict.status.listedUntil.replace("{date}", formatDate(contract.iso, locale));
  }
  if (player.freeSince) {
    return dict.status.listedExpiry.replace("{date}", formatDate(player.freeSince, locale));
  }
  if (player.contractUntil) {
    return dict.status.listedUntil.replace("{date}", formatDate(player.contractUntil, locale));
  }
  return dict.status.contractUnknown;
}

export function contractNote(player: Player, dict: Dictionary): string | null {
  if (player.manualReview) return null;
  if (player.freeSince) return dict.status.statusUnconfirmed;
  return null;
}

export function manualCheckLines(player: Player, dict: Dictionary, locale: string): string[] {
  const review = player.manualReview;
  if (!review) return [];
  const checked = dict.status.checkedOn.replace("{date}", formatDate(review.checkedAt.slice(0, 10), locale));
  const host = sourceUrlHost(review.sourceUrl) || review.sourceUrl;
  const source = dict.status.source.replace("{host}", host);
  const lines = [checked, source];
  if (review.publicNote) lines.push(review.publicNote);
  return lines;
}

export function contractShareLine(player: Player, dict: Dictionary, locale: string): string {
  const primary = contractPrimary(player, dict, locale);
  const note = contractNote(player, dict);
  const checks = manualCheckLines(player, dict, locale);
  return [note ? `${primary} ${note}` : primary, ...checks].join(" · ");
}
