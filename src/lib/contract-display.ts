import type { Player } from "@/data/mock-players";
import type { Dictionary } from "@/i18n/get-dictionary";
import { isConfirmedWithoutClub } from "@/lib/auto-refresh";
import { formatDate } from "@/lib/format";
import {
  effectiveClub,
  effectiveContract,
  type ManualReviewPublic,
  type ReviewablePlayer,
} from "@/lib/player-review";
import { sourceUrlHost } from "@/lib/public-source-url";

function hasClubName(value: string | null | undefined): value is string {
  return Boolean(value && value !== "—");
}

export function formatCatalogClub(
  club: string | null | undefined,
  lastClub: string | null | undefined,
  dict: Dictionary,
): string {
  if (hasClubName(club)) return club;
  if (hasClubName(lastClub)) return `${dict.status.listedClub}: ${lastClub}`;
  return "—";
}

export function formatListedClub(
  player: ReviewablePlayer & { manualReview?: ManualReviewPublic | null },
  dict: Dictionary,
): string {
  const review = player.manualReview ?? null;
  if (!review && !player.autoRefresh) {
    return formatCatalogClub(player.club, player.lastClub, dict);
  }
  const club = effectiveClub(player, review);
  if (club.kind === "retired") return dict.status.retiredLabel;
  if (club.kind === "none") {
    return review ? dict.status.noClubLabel : dict.status.withoutClubListed;
  }
  if (club.kind === "unknown") return dict.status.clubUnknown;
  if (club.kind === "current") return club.name;
  return `${dict.status.listedClub}: ${club.name}`;
}

export function contractPrimary(player: Player, dict: Dictionary, locale: string): string {
  const review = player.manualReview ?? null;
  if (!review && !player.autoRefresh) {
    if (player.freeSince) {
      return dict.status.listedExpiry.replace("{date}", formatDate(player.freeSince, locale));
    }
    if (player.contractUntil) {
      return dict.status.listedUntil.replace("{date}", formatDate(player.contractUntil, locale));
    }
    return dict.status.contractUnknown;
  }
  const contract = effectiveContract(player, review);
  if (contract.kind === "unknown") {
    if (!review && player.autoRefresh) return dict.status.autoContractUnknown;
    return dict.status.contractUnknown;
  }
  if (contract.from === "catalog" && player.freeSince && contract.iso === player.freeSince) {
    return dict.status.listedExpiry.replace("{date}", formatDate(contract.iso, locale));
  }
  return dict.status.listedUntil.replace("{date}", formatDate(contract.iso, locale));
}

export function contractNote(player: Player, dict: Dictionary): string | null {
  if (player.manualReview) return null;
  if (player.autoRefresh && isConfirmedWithoutClub(player.autoRefresh)) {
    return dict.status.withoutClubNotFree;
  }
  if (player.autoRefresh) return null;
  if (player.freeSince) return dict.status.statusUnconfirmed;
  return null;
}

export function overlayStatusLines(player: Player, dict: Dictionary, locale: string): string[] {
  const review = player.manualReview;
  if (review) {
    const checked = dict.status.checkedOn.replace("{date}", formatDate(review.checkedAt.slice(0, 10), locale));
    const host = sourceUrlHost(review.sourceUrl) || review.sourceUrl;
    const source = dict.status.source.replace("{host}", host);
    const lines = [checked, source];
    if (review.publicNote) lines.push(review.publicNote);
    return lines;
  }
  const auto = player.autoRefresh;
  if (!auto) return [];
  const fetched = dict.status.autoFetchedOn.replace("{date}", formatDate(auto.fetchedAt.slice(0, 10), locale));
  const lines = [fetched, dict.status.autoSource];
  if (isConfirmedWithoutClub(auto)) lines.push(dict.status.withoutClubNotFree);
  return lines;
}

export function manualCheckLines(player: Player, dict: Dictionary, locale: string): string[] {
  return overlayStatusLines(player, dict, locale);
}

export function contractShareLine(player: Player, dict: Dictionary, locale: string): string {
  const primary = contractPrimary(player, dict, locale);
  const note = contractNote(player, dict);
  const checks = overlayStatusLines(player, dict, locale);
  return [note ? `${primary} ${note}` : primary, ...checks].join(" · ");
}
