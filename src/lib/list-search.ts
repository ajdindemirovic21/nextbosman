import { positions } from "@/data/mock-players";
import type { SavedList, SavedListFilters } from "@/lib/supabase/types";

export function savedListsPath(locale: string, listId?: string | null): string {
  const path = `/${locale}/lists`;
  const id = listId?.trim();
  return id ? `${path}?list=${encodeURIComponent(id)}` : path;
}

export function filterSavedLists(lists: SavedList[], query: string): SavedList[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return lists;
  return lists.filter((list) => {
    const title = list.title.toLowerCase();
    const club = (list.clubName ?? "").toLowerCase();
    return title.includes(needle) || club.includes(needle);
  });
}

export function nextListAfterDelete(lists: SavedList[], deletedId: string): SavedList | null {
  const index = lists.findIndex((list) => list.id === deletedId);
  const remaining = lists.filter((list) => list.id !== deletedId);
  if (!remaining.length) return null;
  if (index === -1) return remaining[0];
  return remaining[Math.min(index, remaining.length - 1)];
}

export function searchPathFromFilters(locale: string, filters: SavedListFilters): string {
  const params = new URLSearchParams();
  params.set(
    "status",
    filters.status === "expiring"
      ? "expiring"
      : filters.status === "all"
        ? "all"
        : filters.status === "no_club"
          ? "no_club"
          : "free",
  );
  const position = filters.position && (positions as readonly string[]).includes(filters.position)
    ? filters.position
    : "all";
  params.set("position", position);
  params.set("nationality", filters.nationality?.trim() || "all");
  params.set("eu", filters.euOnly ? "1" : "0");
  if (typeof filters.minAge === "number" && Number.isFinite(filters.minAge)) {
    params.set("minAge", String(filters.minAge));
  }
  if (typeof filters.maxAge === "number" && Number.isFinite(filters.maxAge)) {
    params.set("maxAge", String(filters.maxAge));
  }
  if (typeof filters.maxMv === "number" && Number.isFinite(filters.maxMv)) {
    params.set("maxMv", String(filters.maxMv));
  } else {
    params.set("maxMv", "any");
  }
  return `/${locale}/search?${params.toString()}`;
}
