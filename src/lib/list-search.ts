import { positions } from "@/data/mock-players";
import type { SavedListFilters } from "@/lib/supabase/types";

export function searchPathFromFilters(locale: string, filters: SavedListFilters): string {
  const params = new URLSearchParams();
  params.set(
    "status",
    filters.status === "expiring" ? "expiring" : filters.status === "all" ? "all" : "free",
  );
  const position = filters.position && (positions as readonly string[]).includes(filters.position)
    ? filters.position
    : "all";
  params.set("position", position);
  params.set("nationality", filters.nationality?.trim() || "all");
  params.set("eu", filters.euOnly ? "1" : "0");
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
