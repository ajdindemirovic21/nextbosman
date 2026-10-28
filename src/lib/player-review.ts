import type { Availability, Player } from "@/data/mock-players";
import {
  autoFilterBucket,
  effectiveClubFromAuto,
  effectiveContractFromAuto,
  type AutoRefreshPublic,
} from "@/lib/auto-refresh";
import { isDateInNext12CalendarMonths, utcTodayIso } from "@/lib/calendar-months";
import { toPlainText } from "@/lib/plain-text";
import { parsePublicSourceUrl } from "@/lib/public-source-url";

export type ReviewablePlayer = Pick<
  Player,
  "club" | "lastClub" | "contractUntil" | "freeSince" | "availability" | "autoRefresh"
>;

export type CheckStatus = "no_club" | "under_contract" | "unknown";
export type FieldMode = "keep" | "set" | "unknown";
export type ClubMode = FieldMode | "none";
export type FilterBucket = Availability | "no_club" | "other";
export type CatalogQueryStatus = Availability | "all" | "no_club";

export type ManualReviewPublic = {
  checkStatus: CheckStatus;
  clubMode: ClubMode;
  clubValue: string | null;
  contractMode: FieldMode;
  contractValue: string | null;
  sourceUrl: string;
  checkedAt: string;
  eventAt: string | null;
  publicNote: string;
};

export type EffectiveClub =
  | { kind: "none" }
  | { kind: "unknown" }
  | { kind: "retired" }
  | { kind: "current"; name: string }
  | { kind: "listed_source"; name: string };

export type EffectiveContract =
  | { kind: "unknown" }
  | { kind: "date"; iso: string; from: "overlay" | "catalog" };

export function isCatalogQueryStatus(raw: string | null | undefined): raw is CatalogQueryStatus {
  return raw === "free" || raw === "expiring" || raw === "all" || raw === "no_club";
}

export function effectiveClub(player: ReviewablePlayer, review: ManualReviewPublic | null): EffectiveClub {
  if (!review && player.autoRefresh) {
    return effectiveClubFromAuto(player.autoRefresh);
  }
  if (!review) {
    if (player.club) return { kind: "current", name: player.club };
    if (player.lastClub && player.lastClub !== "—") return { kind: "listed_source", name: player.lastClub };
    return { kind: "unknown" };
  }
  if (review.checkStatus === "no_club" || review.clubMode === "none") return { kind: "none" };
  if (review.clubMode === "unknown") return { kind: "unknown" };
  if (review.clubMode === "set") {
    const name = (review.clubValue ?? "").trim();
    return name ? { kind: "current", name } : { kind: "unknown" };
  }
  if (player.club) return { kind: "current", name: player.club };
  if (player.lastClub && player.lastClub !== "—") return { kind: "listed_source", name: player.lastClub };
  return { kind: "unknown" };
}

export function catalogListedEnd(player: ReviewablePlayer): string | null {
  return player.contractUntil || player.freeSince || null;
}

export function effectiveContract(player: ReviewablePlayer, review: ManualReviewPublic | null): EffectiveContract {
  if (!review && player.autoRefresh) {
    return effectiveContractFromAuto(player.autoRefresh);
  }
  if (!review) {
    const iso = catalogListedEnd(player);
    return iso ? { kind: "date", iso, from: "catalog" } : { kind: "unknown" };
  }
  if (review.contractMode === "unknown") return { kind: "unknown" };
  if (review.contractMode === "set") {
    const iso = review.contractValue;
    return iso ? { kind: "date", iso, from: "overlay" } : { kind: "unknown" };
  }
  const iso = catalogListedEnd(player);
  return iso ? { kind: "date", iso, from: "catalog" } : { kind: "unknown" };
}

export function filterBucketFor(
  player: ReviewablePlayer,
  review: ManualReviewPublic | null,
  todayIso = utcTodayIso(),
): FilterBucket {
  if (!review) {
    if (player.autoRefresh) return autoFilterBucket(player.autoRefresh, todayIso);
    return player.availability;
  }
  if (review.checkStatus === "no_club") return "no_club";
  if (review.checkStatus === "unknown") return "other";
  const contract = effectiveContract(player, review);
  if (contract.kind === "date" && isDateInNext12CalendarMonths(contract.iso, todayIso)) {
    return "expiring";
  }
  return "other";
}

export function matchesCatalogStatus(
  bucket: FilterBucket,
  status: CatalogQueryStatus,
): boolean {
  if (status === "all") return true;
  if (status === "no_club") return bucket === "no_club";
  if (status === "free") return bucket === "free";
  return bucket === "expiring";
}

export function parseManualReviewRow(row: {
  active?: boolean | null;
  check_status?: string | null;
  club_mode?: string | null;
  club_value?: string | null;
  contract_mode?: string | null;
  contract_value?: string | null;
  source_url?: string | null;
  checked_at?: string | null;
  event_at?: string | null;
  public_note?: string | null;
} | null): ManualReviewPublic | null {
  if (!row || row.active === false) return null;
  const sourceUrl = parsePublicSourceUrl(row.source_url);
  if (!sourceUrl) return null;
  const checkStatus = row.check_status;
  if (checkStatus !== "no_club" && checkStatus !== "under_contract" && checkStatus !== "unknown") {
    return null;
  }
  const clubMode = parseClubMode(row.club_mode, checkStatus);
  const contractMode = parseFieldMode(row.contract_mode);
  if (!clubMode || !contractMode) return null;
  if (!row.checked_at) return null;
  return {
    checkStatus,
    clubMode,
    clubValue: clubMode === "set" ? toPlainText(row.club_value ?? "", 120) || null : null,
    contractMode,
    contractValue: contractMode === "set" ? isoDateOnly(row.contract_value) : null,
    sourceUrl,
    checkedAt: row.checked_at,
    eventAt: isoDateOnly(row.event_at),
    publicNote: toPlainText(row.public_note ?? "", 500),
  };
}

function parseFieldMode(raw: string | null | undefined): FieldMode | null {
  if (raw === "keep" || raw === "set" || raw === "unknown") return raw;
  return null;
}

function parseClubMode(raw: string | null | undefined, status: CheckStatus): ClubMode | null {
  if (status === "no_club") return "none";
  if (raw === "none") return null;
  return parseFieldMode(raw);
}

function isoDateOnly(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const slice = raw.slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(slice) ? slice : null;
}

export function applyPlayerLayers(
  player: Player,
  review: ManualReviewPublic | null,
  auto: AutoRefreshPublic | null,
  todayIso = utcTodayIso(),
): Player {
  const next: Player = {
    ...player,
    autoRefresh: auto,
    manualReview: review,
  };
  return {
    ...next,
    filterBucket: filterBucketFor(next, review, todayIso),
  };
}

export function applyManualReview(
  player: Player,
  review: ManualReviewPublic | null,
  todayIso = utcTodayIso(),
): Player {
  return applyPlayerLayers(player, review, player.autoRefresh ?? null, todayIso);
}

export function publicPlayerPayload(player: Player): Player {
  const review = player.manualReview ?? null;
  const auto = player.autoRefresh ?? null;
  return {
    ...player,
    autoRefresh: auto
      ? {
          fetchedAt: auto.fetchedAt,
          clubId: auto.clubId,
          clubName: auto.clubName,
          contractExpires: auto.contractExpires,
          isRetired: auto.isRetired,
          joined: auto.joined,
        }
      : null,
    manualReview: review
      ? {
          checkStatus: review.checkStatus,
          clubMode: review.clubMode,
          clubValue: review.clubValue,
          contractMode: review.contractMode,
          contractValue: review.contractValue,
          sourceUrl: review.sourceUrl,
          checkedAt: review.checkedAt,
          eventAt: review.eventAt,
          publicNote: review.publicNote,
        }
      : null,
  };
}

export type ReviewDraft = {
  checkStatus: CheckStatus;
  clubMode: ClubMode;
  clubValue: string;
  contractMode: FieldMode;
  contractValue: string;
  sourceUrl: string;
  eventAt: string;
  publicNote: string;
  privateNote: string;
};

export function revisionHeadsMatch(
  currentHead: string | null | undefined,
  expectedHead: string | null | undefined,
): boolean {
  return (currentHead ?? "") === (expectedHead ?? "");
}

export function validateReviewDraft(draft: ReviewDraft, player: ReviewablePlayer): string | null {
  if (!parsePublicSourceUrl(draft.sourceUrl)) return "sourceUrl";
  if (draft.checkStatus === "no_club") {
    if (draft.clubMode !== "none") return "clubMode";
  } else {
    if (draft.clubMode === "none") return "clubMode";
    if (draft.clubMode === "set" && !toPlainText(draft.clubValue, 120)) return "clubValue";
    if (draft.checkStatus === "under_contract" && draft.clubMode === "keep" && !player.club) {
      return "clubValue";
    }
  }
  if (draft.contractMode === "set" && !isoDateOnly(draft.contractValue)) return "contractValue";
  return null;
}
