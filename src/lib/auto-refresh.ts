import { isDateInNext12CalendarMonths } from "@/lib/calendar-months";

type AutoFilterBucket = "free" | "expiring" | "no_club" | "other";

export const WITHOUT_CLUB_ID = "515";
export const WITHOUT_CLUB_NAME = "Without Club";
export const RETIRED_CLUB_ID = "123";

export type AutoRefreshPublic = {
  fetchedAt: string;
  clubId: string | null;
  clubName: string | null;
  contractExpires: string | null;
  isRetired: boolean;
  joined: string | null;
};

export type AutoRefreshRecord = {
  snapshot: AutoRefreshPublic | null;
  lastError: string | null;
  lastErrorAt: string | null;
  attemptedAt?: string | null;
  sourceFetchedAt?: string | null;
  marketValueLastUpdated?: string | null;
};

export type ListingProfile = {
  id?: string | number | null;
  isRetired?: boolean | null;
  updatedAt?: string | null;
  fetchedAt?: string | null;
  fetched_at_utc?: string | null;
  marketValueLastUpdated?: string | null;
  club_id?: string | number | null;
  club_name?: string | null;
  contractExpires?: string | null;
  joined?: string | null;
  club?: {
    id?: string | number | null;
    name?: string | null;
    contractExpires?: string | null;
    joined?: string | null;
  } | null;
};

export type ListingValidation =
  | { ok: true; profile: ListingProfile; sourceFetchedAt: string }
  | { ok: false; error: string };

export function isRetiredListing(snapshot: Pick<AutoRefreshPublic, "clubId" | "isRetired">): boolean {
  return snapshot.isRetired === true || snapshot.clubId === RETIRED_CLUB_ID;
}

export function isConfirmedWithoutClub(snapshot: Pick<AutoRefreshPublic, "clubId" | "clubName" | "isRetired">): boolean {
  return (
    snapshot.clubId === WITHOUT_CLUB_ID &&
    snapshot.clubName === WITHOUT_CLUB_NAME &&
    snapshot.isRetired !== true
  );
}

function isoDateOnly(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const slice = String(raw).slice(0, 10);
  return /^\d{4}-\d{2}-\d{2}$/.test(slice) ? slice : null;
}

function asId(raw: string | number | null | undefined): string | null {
  if (raw == null || raw === "") return null;
  return String(raw);
}

export function sourceFetchedAt(profile: ListingProfile): string | null {
  const raw = profile.updatedAt ?? profile.fetchedAt ?? profile.fetched_at_utc;
  if (!raw || !String(raw).trim()) return null;
  return String(raw).trim();
}

export function validateListingForPlayer(requestedId: string, profile: ListingProfile | null | undefined): ListingValidation {
  if (!profile) return { ok: false, error: "empty_profile" };
  const gotId = asId(profile.id);
  if (!gotId) return { ok: false, error: "missing_profile_id" };
  if (gotId !== requestedId) return { ok: false, error: `id_mismatch:${gotId}` };
  if (typeof profile.isRetired !== "boolean") return { ok: false, error: "invalid_isRetired" };
  const fetched = sourceFetchedAt(profile);
  if (!fetched) return { ok: false, error: "missing_source_updated_at" };
  return { ok: true, profile, sourceFetchedAt: fetched };
}

export function snapshotFromListing(profile: ListingProfile, fetchedAt: string): AutoRefreshPublic | null {
  if (!fetchedAt) return null;
  const club = profile.club ?? null;
  const clubId = asId(club?.id ?? profile.club_id);
  const clubName = (club?.name ?? profile.club_name ?? "").trim() || null;
  return {
    fetchedAt,
    clubId,
    clubName,
    contractExpires: isoDateOnly(club?.contractExpires ?? profile.contractExpires),
    isRetired: profile.isRetired === true,
    joined: isoDateOnly(club?.joined ?? profile.joined),
  };
}

export function parseAutoSnapshotRow(row: {
  auto_fetched_at?: string | null;
  auto_club_id?: string | null;
  auto_club_name?: string | null;
  auto_contract_expires?: string | null;
  auto_is_retired?: boolean | null;
  auto_joined?: string | null;
} | null): AutoRefreshPublic | null {
  if (!row?.auto_fetched_at) return null;
  return {
    fetchedAt: row.auto_fetched_at,
    clubId: asId(row.auto_club_id),
    clubName: (row.auto_club_name ?? "").trim() || null,
    contractExpires: isoDateOnly(row.auto_contract_expires),
    isRetired: row.auto_is_retired === true,
    joined: isoDateOnly(row.auto_joined),
  };
}

export function applyFetchSuccess(
  profile: ListingProfile,
  fetchedAt: string,
  extras?: { attemptedAt?: string; marketValueLastUpdated?: string | null },
): AutoRefreshRecord {
  return {
    snapshot: snapshotFromListing(profile, fetchedAt),
    lastError: null,
    lastErrorAt: null,
    attemptedAt: extras?.attemptedAt ?? null,
    sourceFetchedAt: fetchedAt,
    marketValueLastUpdated: extras?.marketValueLastUpdated ?? profile.marketValueLastUpdated ?? null,
  };
}

export function applyFetchFailure(
  previous: AutoRefreshRecord | null,
  error: string,
  failedAt: string,
): AutoRefreshRecord {
  return {
    snapshot: previous?.snapshot ?? null,
    lastError: error,
    lastErrorAt: failedAt,
    attemptedAt: failedAt,
    sourceFetchedAt: previous?.sourceFetchedAt ?? previous?.snapshot?.fetchedAt ?? null,
    marketValueLastUpdated: previous?.marketValueLastUpdated ?? null,
  };
}

export function recordFromValidatedListing(
  requestedId: string,
  previous: AutoRefreshRecord | null,
  profile: ListingProfile | null | undefined,
  attemptedAt: string,
): AutoRefreshRecord {
  const checked = validateListingForPlayer(requestedId, profile);
  if (!checked.ok) return applyFetchFailure(previous, checked.error, attemptedAt);
  return applyFetchSuccess(checked.profile, checked.sourceFetchedAt, {
    attemptedAt,
    marketValueLastUpdated: checked.profile.marketValueLastUpdated ?? null,
  });
}

export function autoFilterBucket(snapshot: AutoRefreshPublic, todayIso: string): AutoFilterBucket {
  if (isRetiredListing(snapshot)) return "other";
  if (isConfirmedWithoutClub(snapshot)) return "no_club";
  if (snapshot.contractExpires && isDateInNext12CalendarMonths(snapshot.contractExpires, todayIso)) {
    return "expiring";
  }
  return "other";
}

export function effectiveClubFromAuto(
  snapshot: AutoRefreshPublic,
): { kind: "none" } | { kind: "unknown" } | { kind: "current"; name: string } | { kind: "retired" } {
  if (isRetiredListing(snapshot)) return { kind: "retired" };
  if (isConfirmedWithoutClub(snapshot)) return { kind: "none" };
  const name = snapshot.clubName?.trim();
  if (name) return { kind: "current", name };
  return { kind: "unknown" };
}

export function effectiveContractFromAuto(
  snapshot: AutoRefreshPublic,
): { kind: "unknown" } | { kind: "date"; iso: string; from: "overlay" } {
  if (isRetiredListing(snapshot) || isConfirmedWithoutClub(snapshot)) {
    return { kind: "unknown" };
  }
  if (snapshot.contractExpires) {
    return { kind: "date", iso: snapshot.contractExpires, from: "overlay" };
  }
  return { kind: "unknown" };
}
