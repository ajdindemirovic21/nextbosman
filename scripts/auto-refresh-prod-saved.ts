/**
 * Validate a previously saved production snapshot before persist.
 * Not a Transfermarkt fetch. Simulated fixtures are refused.
 */
import fs from "node:fs";
import {
  applyFetchSuccess,
  snapshotFromListing,
  validateListingForPlayer,
  type AutoRefreshRecord,
  type AutoRefreshPublic,
} from "../src/lib/auto-refresh.ts";
import { isPlayerId } from "../src/lib/player-ids.ts";

export const PROD_SNAPSHOT_ORIGIN = "production worker + validateListingForPlayer";

export function asUtcMs(raw: string | null | undefined) {
  if (!raw) return NaN;
  const text = String(raw).trim();
  if (/[zZ]|[+-]\d{2}:\d{2}$/.test(text)) return Date.parse(text);
  return Date.parse(`${text}Z`);
}

export type SavedProdSnapshotFile = {
  simulated?: boolean;
  origin?: string;
  playerId?: string;
  attemptedAt?: string | null;
  sourceFetchedAt?: string | null;
  marketValueLastUpdated?: string | null;
  snapshot?: AutoRefreshPublic | null;
};

export function loadSavedProdSnapshotFile(file: string): { ok: true; data: SavedProdSnapshotFile } | { ok: false; reason: string } {
  if (!file?.trim()) return { ok: false, reason: "Missing --snapshot path." };
  if (!fs.existsSync(file)) return { ok: false, reason: "Snapshot file does not exist." };
  try {
    return { ok: true, data: JSON.parse(fs.readFileSync(file, "utf8")) as SavedProdSnapshotFile };
  } catch {
    return { ok: false, reason: "Snapshot file is not valid JSON." };
  }
}

export function validateSavedProdSnapshot(
  data: SavedProdSnapshotFile,
  requestedId: string,
): { ok: true; record: AutoRefreshRecord } | { ok: false; reason: string } {
  if (!isPlayerId(requestedId)) return { ok: false, reason: "Invalid player id." };
  if (data.simulated === true) return { ok: false, reason: "Simulated snapshot refused." };
  if (String(data.origin || "") !== PROD_SNAPSHOT_ORIGIN) {
    return { ok: false, reason: "Snapshot origin is not a production worker validation." };
  }
  if (String(data.playerId || "") !== requestedId) {
    return { ok: false, reason: "Snapshot player id does not match --ids." };
  }
  const snap = data.snapshot;
  if (!snap?.fetchedAt) return { ok: false, reason: "Snapshot is missing fetchedAt." };
  const source = data.sourceFetchedAt || snap.fetchedAt;
  if (asUtcMs(source) !== asUtcMs(snap.fetchedAt)) {
    return { ok: false, reason: "sourceFetchedAt does not match snapshot fetchedAt." };
  }
  const profile = {
    id: requestedId,
    isRetired: snap.isRetired,
    updatedAt: snap.fetchedAt,
    club: {
      id: snap.clubId,
      name: snap.clubName,
      contractExpires: snap.contractExpires,
      joined: snap.joined,
    },
    marketValueLastUpdated: data.marketValueLastUpdated ?? null,
  };
  const checked = validateListingForPlayer(requestedId, profile);
  if (!checked.ok) return { ok: false, reason: `invalid_listing:${checked.error}` };
  const rebuilt = snapshotFromListing(checked.profile, checked.sourceFetchedAt);
  if (
    !rebuilt ||
    rebuilt.fetchedAt !== snap.fetchedAt ||
    rebuilt.clubId !== snap.clubId ||
    rebuilt.clubName !== snap.clubName ||
    rebuilt.contractExpires !== snap.contractExpires ||
    rebuilt.isRetired !== snap.isRetired ||
    rebuilt.joined !== snap.joined
  ) {
    return { ok: false, reason: "Snapshot content does not match validated listing fields." };
  }
  return {
    ok: true,
    record: applyFetchSuccess(checked.profile, checked.sourceFetchedAt, {
      attemptedAt: data.attemptedAt || undefined,
      marketValueLastUpdated: data.marketValueLastUpdated ?? null,
    }),
  };
}

export function compareIncomingFetchedAt(
  incomingFetchedAt: string,
  storedFetchedAt: string | null | undefined,
): { ok: true; action: "write" | "already_current" } | { ok: false; reason: string } {
  const incoming = asUtcMs(incomingFetchedAt);
  if (!Number.isFinite(incoming)) return { ok: false, reason: "Incoming fetchedAt is not a valid time." };
  if (!storedFetchedAt) return { ok: true, action: "write" };
  const stored = asUtcMs(storedFetchedAt);
  if (!Number.isFinite(stored)) return { ok: false, reason: "Stored fetchedAt is not a valid time." };
  if (incoming < stored) return { ok: false, reason: "Incoming snapshot is older than the stored snapshot." };
  if (incoming === stored) return { ok: true, action: "already_current" };
  return { ok: true, action: "write" };
}
