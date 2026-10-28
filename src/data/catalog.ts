import fs from "fs";
import path from "path";
import type { CatalogStatus, Player, Position } from "@/data/mock-players";
import {
  CATALOG_SEARCH_LIMIT,
  type CatalogSearchHit,
  catalogSearchReady,
  escapeIlikePattern,
  normalizeCatalogSearch,
  playerMatchesCatalogSearch,
  rankCatalogSearchHits,
  searchHitFromPlayer,
} from "@/lib/catalog-search";
import { isPlayerId, uniquePlayerIds } from "@/lib/player-ids";
import { applyPlayerLayers, matchesCatalogStatus } from "@/lib/player-review";
import { PAGE_SIZE, catalogIdKey, compareMarketValueThenId, pageOffset } from "@/lib/player-page";
import { parseTransfermarktProfileUrl } from "@/lib/profile-url";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { mapPlayerRow } from "@/lib/supabase/map-player";
import {
  PLAYERS_EFFECTIVE_COLUMNS,
  PLAYERS_EFFECTIVE_REVIEW_COLUMNS,
  PLAYERS_TABLE_COLUMNS,
  isMissingAutoColumns,
} from "@/lib/supabase/player-columns";
import { createPublicSupabase } from "@/lib/supabase/public";
import type { PlayerRow } from "@/lib/supabase/types";

export type PlayerQuery = {
  status: CatalogStatus;
  position?: Position | Position[] | "all";
  nationality?: string;
  euOnly?: boolean;
  minAge?: number;
  maxAge?: number;
  maxMv?: number | "any";
  page?: number;
};

function applyCatalogFilters(query: any, filters: PlayerQuery, bucketColumn: "filter_bucket" | "availability") {
  let next = query;
  if (filters.status === "no_club") {
    next = next.eq(bucketColumn, "no_club");
  } else if (filters.status === "free") {
    next = next.eq(bucketColumn, "free");
  } else if (filters.status === "expiring") {
    next = next.eq(bucketColumn, "expiring");
  }
  const wanted = positionList(filters.position);
  if (wanted?.length === 1) {
    next = next.eq("position", wanted[0]);
  } else if (wanted && wanted.length > 1) {
    next = next.in("position", wanted);
  }
  if (filters.nationality && filters.nationality !== "all") {
    next = next.eq("nationality", filters.nationality);
  }
  if (filters.euOnly) next = next.eq("eu_passport", true);
  if (filters.minAge) next = next.gte("age", filters.minAge);
  if (filters.maxAge) next = next.lte("age", filters.maxAge);
  if (filters.maxMv && filters.maxMv !== "any") {
    next = next.lte("market_value_eur", filters.maxMv);
  }
  return next as typeof query;
}

function positionList(position: PlayerQuery["position"]): Position[] | null {
  if (!position || position === "all") return null;
  const list = Array.isArray(position) ? position : [position];
  return list.length ? list : null;
}

export type PlayerQueryResult = {
  players: Player[];
  total: number;
  page: number;
  pageSize: number;
  nationalities: string[];
  catalogLimited: boolean;
};

let cache: Player[] | null = null;
let cacheMtime = 0;

export function loadCatalog(): Player[] {
  const file = path.join(process.cwd(), "data", "derived", "players.json");
  if (!fs.existsSync(file)) return [];
  const mtime = fs.statSync(file).mtimeMs;
  if (cache && cacheMtime === mtime) return cache;
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Player[];
  cache = parsed.map((player) => {
    const base: Player = {
      ...player,
      id: catalogIdKey(player.id),
      marketValueEur: Number(player.marketValueEur) || 0,
      hasSeasonStats: player.hasSeasonStats === true,
      profileUrl: parseTransfermarktProfileUrl(player.profileUrl, catalogIdKey(player.id)),
      manualReview: null,
      autoRefresh: null,
    };
    return applyPlayerLayers(base, null, null);
  });
  cacheMtime = mtime;
  return cache;
}

function withLocalSeasonStats(player: Player, row: PlayerRow): Player {
  if (typeof row.has_season_stats === "boolean") {
    return { ...player, hasSeasonStats: row.has_season_stats };
  }
  const local = loadCatalog().find((item) => item.id === player.id);
  return { ...player, hasSeasonStats: local?.hasSeasonStats === true };
}

function filterJsonRows(catalog: Player[], filters: PlayerQuery): Player[] {
  let rows = catalog.filter((player) =>
    matchesCatalogStatus(player.filterBucket ?? player.availability, filters.status),
  );
  const wanted = positionList(filters.position);
  if (wanted) {
    rows = rows.filter((player) => wanted.includes(player.position));
  }
  if (filters.nationality && filters.nationality !== "all") {
    rows = rows.filter((player) => player.nationality === filters.nationality);
  }
  if (filters.euOnly) rows = rows.filter((player) => player.euPassport);
  if (filters.minAge) rows = rows.filter((player) => player.age >= filters.minAge!);
  if (filters.maxAge) rows = rows.filter((player) => player.age <= filters.maxAge!);
  const maxMv = filters.maxMv;
  if (typeof maxMv === "number") {
    rows = rows.filter((player) => player.marketValueEur <= maxMv);
  }
  rows.sort(compareMarketValueThenId);
  return rows;
}

export function queryPlayersFromJson(filters: PlayerQuery, catalog = loadCatalog()): PlayerQueryResult {
  const nationalities = [...new Set(catalog.map((p) => p.nationality).filter(Boolean))].sort();
  const rows = filterJsonRows(catalog, filters);
  const total = rows.length;
  const page = Math.max(1, filters.page ?? 1);
  const offset = pageOffset(page, PAGE_SIZE);
  return {
    players: rows.slice(offset, offset + PAGE_SIZE),
    total,
    page,
    pageSize: PAGE_SIZE,
    nationalities,
    catalogLimited: true,
  };
}

function isMissingEffectiveView(error: { code?: string; message?: string } | null) {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "42P01") return true;
  return /players_effective/i.test(error.message ?? "");
}

let playersEffectiveSelect = PLAYERS_EFFECTIVE_COLUMNS;

function effectiveSelectColumns(table: "players_effective" | "players") {
  return table === "players_effective" ? playersEffectiveSelect : PLAYERS_TABLE_COLUMNS;
}

function rememberMissingAutoColumns() {
  playersEffectiveSelect = PLAYERS_EFFECTIVE_REVIEW_COLUMNS;
}

async function queryEffectiveTable(filters: PlayerQuery, table: "players_effective" | "players") {
  const supabase = createPublicSupabase();
  const page = Math.max(1, filters.page ?? 1);
  const offset = pageOffset(page, PAGE_SIZE);
  const to = offset + PAGE_SIZE - 1;
  const bucketColumn = table === "players_effective" ? "filter_bucket" : "availability";
  const columns = effectiveSelectColumns(table);
  const nationsPromise = supabase.rpc("player_nationalities");
  let query = applyCatalogFilters(
    supabase
      .from(table)
      .select(columns, { count: "exact" })
      .order("market_value_eur", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, to),
    filters,
    bucketColumn,
  );

  let [{ data, error, count }, nations] = await Promise.all([query, nationsPromise]);
  if (table === "players_effective" && isMissingAutoColumns(error)) {
    rememberMissingAutoColumns();
    query = applyCatalogFilters(
      supabase
        .from(table)
        .select(PLAYERS_EFFECTIVE_REVIEW_COLUMNS, { count: "exact" })
        .order("market_value_eur", { ascending: false })
        .order("id", { ascending: true })
        .range(offset, to),
      filters,
      bucketColumn,
    );
    const retried = await query;
    data = retried.data;
    error = retried.error;
    count = retried.count;
  }
  const nationalities = Array.isArray(nations.data) ? (nations.data as string[]) : [];
  return {
    data,
    error,
    count,
    nationalities,
    page,
    table,
    bucketColumn: bucketColumn as "filter_bucket" | "availability",
  };
}

async function emptyPageCount(
  filters: PlayerQuery,
  table: "players_effective" | "players",
  bucketColumn: "filter_bucket" | "availability",
  nationalities: string[],
  page: number,
  catalogLimited: boolean,
): Promise<PlayerQueryResult> {
  const counted = await applyCatalogFilters(
    createPublicSupabase().from(table).select("id", { count: "exact", head: true }),
    filters,
    bucketColumn,
  );
  return {
    players: [],
    total: counted.count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    nationalities,
    catalogLimited,
  };
}

export async function queryPlayersFromSupabase(filters: PlayerQuery): Promise<PlayerQueryResult> {
  let result = await queryEffectiveTable(filters, "players_effective");
  let catalogLimited = false;

  if (result.error && isMissingEffectiveView(result.error)) {
    result = await queryEffectiveTable(filters, "players");
    catalogLimited = true;
  }

  if (result.error?.code === "PGRST103") {
    return emptyPageCount(
      filters,
      result.table,
      result.bucketColumn,
      result.nationalities,
      result.page,
      catalogLimited,
    );
  }
  if (result.error) throw result.error;

  return {
    players: ((result.data ?? []) as PlayerRow[]).map((row) => withLocalSeasonStats(mapPlayerRow(row), row)),
    total: result.count ?? 0,
    page: result.page,
    pageSize: PAGE_SIZE,
    nationalities: result.nationalities,
    catalogLimited,
  };
}

export async function queryPlayers(filters: PlayerQuery): Promise<PlayerQueryResult> {
  if (!isSupabaseConfigured()) return queryPlayersFromJson(filters);
  try {
    return await queryPlayersFromSupabase(filters);
  } catch (error) {
    console.error("Supabase players query failed, using local catalog", error);
    return queryPlayersFromJson(filters);
  }
}

export async function getPlayer(id: string): Promise<Player | null> {
  const [player] = await getPlayersByIds([id]);
  return player ?? null;
}

function orderPlayers(ids: string[], found: Player[]): Player[] {
  const byId = new Map(found.map((player) => [player.id, player]));
  return ids.flatMap((id) => {
    const player = byId.get(id);
    return player ? [player] : [];
  });
}

export function searchCatalogFromJson(query: string): CatalogSearchHit[] {
  const value = normalizeCatalogSearch(query);
  if (!catalogSearchReady(value)) return [];
  const hits = loadCatalog().filter((player) => playerMatchesCatalogSearch(player, value));
  return rankCatalogSearchHits(hits, value).map(toSearchHit);
}

function toSearchHit(player: Player): CatalogSearchHit {
  return searchHitFromPlayer(player);
}

async function searchCatalogRows(query: string): Promise<PlayerRow[]> {
  const supabase = createPublicSupabase();
  const value = normalizeCatalogSearch(query);
  const pattern = `%${escapeIlikePattern(value)}%`;
  const orFilter = `name.ilike."${pattern}",id.ilike."${pattern}"`;

  async function fetchRows(table: "players_effective" | "players", columns: string) {
    const found = await supabase
      .from(table)
      .select(columns)
      .or(orFilter)
      .order("name", { ascending: true })
      .order("id", { ascending: true })
      .limit(CATALOG_SEARCH_LIMIT);
    if (found.error) return { rows: [] as PlayerRow[], error: found.error };
    const rows = ((found.data ?? []) as unknown as PlayerRow[]).map((row) => ({
      ...row,
      id: String(row.id),
    }));
    if (isPlayerId(value) && !rows.some((row) => row.id === value)) {
      const byId = await supabase.from(table).select(columns).eq("id", value).maybeSingle();
      if (byId.error) return { rows, error: byId.error };
      if (byId.data) {
        const extra = byId.data as unknown as PlayerRow;
        rows.push({ ...extra, id: String(extra.id) });
      }
    }
    return { rows, error: null };
  }

  let result = await fetchRows("players_effective", playersEffectiveSelect);
  if (result.error && isMissingAutoColumns(result.error)) {
    rememberMissingAutoColumns();
    result = await fetchRows("players_effective", PLAYERS_EFFECTIVE_REVIEW_COLUMNS);
  }
  if (result.error && isMissingEffectiveView(result.error)) {
    result = await fetchRows("players", PLAYERS_TABLE_COLUMNS);
  }
  if (result.error) throw result.error;
  return result.rows;
}

export async function searchCatalogPlayers(query: string): Promise<CatalogSearchHit[]> {
  const value = normalizeCatalogSearch(query);
  if (!catalogSearchReady(value)) return [];

  if (isSupabaseConfigured()) {
    const mapped = (await searchCatalogRows(value)).map((row) => mapPlayerRow(row));
    const matched = mapped.filter((player) => playerMatchesCatalogSearch(player, value));
    return rankCatalogSearchHits(matched, value).map(toSearchHit);
  }

  return searchCatalogFromJson(value);
}

export async function getPlayersByIds(ids: string[]): Promise<Player[]> {
  const wanted = uniquePlayerIds(ids);
  if (!wanted.length) return [];

  if (isSupabaseConfigured()) {
    const supabase = createPublicSupabase();
    const withAuto = await supabase.from("players_effective").select(playersEffectiveSelect).in("id", wanted);
    let effectiveRows: PlayerRow[] | null = null;
    if (!withAuto.error && withAuto.data) {
      effectiveRows = withAuto.data as unknown as PlayerRow[];
    } else if (isMissingAutoColumns(withAuto.error)) {
      rememberMissingAutoColumns();
      const withoutAuto = await supabase
        .from("players_effective")
        .select(PLAYERS_EFFECTIVE_REVIEW_COLUMNS)
        .in("id", wanted);
      if (!withoutAuto.error && withoutAuto.data) {
        effectiveRows = withoutAuto.data as unknown as PlayerRow[];
      }
    }
    if (effectiveRows) {
      const mapped = effectiveRows.map((row) => withLocalSeasonStats(mapPlayerRow(row), row));
      return orderPlayers(wanted, mapped);
    }
    const { data, error } = await supabase.from("players").select(PLAYERS_TABLE_COLUMNS).in("id", wanted);
    if (!error && data) {
      const mapped = (data as PlayerRow[]).map((row) => withLocalSeasonStats(mapPlayerRow(row), row));
      return orderPlayers(wanted, mapped);
    }
  }

  const catalog = loadCatalog();
  return orderPlayers(
    wanted,
    catalog.filter((player) => wanted.includes(player.id)),
  );
}
