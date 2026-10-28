import type { AutoRefreshPublic } from "@/lib/auto-refresh";
import type { ManualReviewPublic, ReviewablePlayer } from "@/lib/player-review";

export type CatalogSearchHit = {
  id: string;
  name: string;
  position: string;
  club: string | null;
  lastClub: string | null;
  autoRefresh?: AutoRefreshPublic | null;
  manualReview?: ManualReviewPublic | null;
};

export function searchHitFromPlayer(player: {
  id: string;
  name: string;
  position: string;
  club: string | null;
  lastClub: string | null;
  autoRefresh?: AutoRefreshPublic | null;
  manualReview?: ManualReviewPublic | null;
}): CatalogSearchHit {
  return {
    id: player.id,
    name: player.name,
    position: player.position,
    club: player.club,
    lastClub: player.lastClub,
    autoRefresh: player.autoRefresh ?? null,
    manualReview: player.manualReview ?? null,
  };
}

export function playerFromSearchHit(hit: CatalogSearchHit): ReviewablePlayer & { manualReview?: ManualReviewPublic | null } {
  return {
    club: hit.club,
    lastClub: hit.lastClub ?? "",
    contractUntil: null,
    freeSince: null,
    availability: "free",
    autoRefresh: hit.autoRefresh ?? null,
    manualReview: hit.manualReview ?? null,
  };
}

export const CATALOG_SEARCH_LIMIT = 25;
export const CATALOG_SEARCH_MIN = 2;

export function normalizeCatalogSearch(raw: string): string {
  return raw.trim().replace(/\s+/g, " ").slice(0, 80);
}

export function catalogSearchReady(query: string): boolean {
  return normalizeCatalogSearch(query).length >= CATALOG_SEARCH_MIN;
}

export function playerMatchesCatalogSearch(player: { id: string; name: string }, query: string): boolean {
  const value = normalizeCatalogSearch(query);
  if (!value) return false;
  const needle = value.toLowerCase();
  if (player.id.toLowerCase().includes(needle)) return true;
  return player.name.toLowerCase().includes(needle);
}

export function rankCatalogSearchHits<T extends { id: string; name: string }>(hits: T[], query: string): T[] {
  const needle = normalizeCatalogSearch(query).toLowerCase();
  return [...hits]
    .sort((a, b) => {
      const aExact = a.id.toLowerCase() === needle || a.name.toLowerCase() === needle ? 0 : 1;
      const bExact = b.id.toLowerCase() === needle || b.name.toLowerCase() === needle ? 0 : 1;
      if (aExact !== bExact) return aExact - bExact;
      const byName = a.name.localeCompare(b.name);
      if (byName) return byName;
      return a.id.localeCompare(b.id);
    })
    .slice(0, CATALOG_SEARCH_LIMIT);
}

export function escapeIlikePattern(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/%/g, "\\%").replace(/_/g, "\\_");
}
