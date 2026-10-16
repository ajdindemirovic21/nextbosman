import fs from "fs";
import path from "path";
import type { CatalogStatus, Player, Position } from "@/data/mock-players";
import { uniquePlayerIds } from "@/lib/player-ids";
import { parseTransfermarktProfileUrl } from "@/lib/profile-url";
import { PAGE_SIZE, catalogIdKey, compareMarketValueThenId, pageOffset } from "@/lib/player-page";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { mapPlayerRow } from "@/lib/supabase/map-player";
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

function applyCatalogFilters(query: any, filters: PlayerQuery) {
  let next = query;
  if (filters.status !== "all") {
    next = next.eq("availability", filters.status);
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
};

let cache: Player[] | null = null;
let cacheMtime = 0;

export function loadCatalog(): Player[] {
  const file = path.join(process.cwd(), "data", "derived", "players.json");
  if (!fs.existsSync(file)) return [];
  const mtime = fs.statSync(file).mtimeMs;
  if (cache && cacheMtime === mtime) return cache;
  const parsed = JSON.parse(fs.readFileSync(file, "utf8")) as Player[];
  cache = parsed.map((player) => ({
    ...player,
    id: catalogIdKey(player.id),
    marketValueEur: Number(player.marketValueEur) || 0,
    hasSeasonStats: player.hasSeasonStats === true,
    profileUrl: parseTransfermarktProfileUrl(player.profileUrl, catalogIdKey(player.id)),
  }));
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

export function queryPlayersFromJson(filters: PlayerQuery): PlayerQueryResult {
  const catalog = loadCatalog();
  const nationalities = [...new Set(catalog.map((p) => p.nationality).filter(Boolean))].sort();
  let rows =
    filters.status === "all"
      ? [...catalog]
      : catalog.filter((player) => player.availability === filters.status);
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
  const total = rows.length;
  const page = Math.max(1, filters.page ?? 1);
  const offset = pageOffset(page, PAGE_SIZE);
  return {
    players: rows.slice(offset, offset + PAGE_SIZE),
    total,
    page,
    pageSize: PAGE_SIZE,
    nationalities,
  };
}

export async function queryPlayersFromSupabase(filters: PlayerQuery): Promise<PlayerQueryResult> {
  const supabase = createPublicSupabase();
  const page = Math.max(1, filters.page ?? 1);
  const offset = pageOffset(page, PAGE_SIZE);
  const to = offset + PAGE_SIZE - 1;

  const nationsPromise = supabase.rpc("player_nationalities");
  let query = applyCatalogFilters(
    supabase
      .from("players")
      .select("*", { count: "exact" })
      .order("market_value_eur", { ascending: false })
      .order("id", { ascending: true })
      .range(offset, to),
    filters,
  );

  const [{ data, error, count }, nations] = await Promise.all([query, nationsPromise]);
  const nationalities = Array.isArray(nations.data) ? (nations.data as string[]) : [];

  if (error?.code === "PGRST103") {
    const counted = await applyCatalogFilters(
      supabase.from("players").select("id", { count: "exact", head: true }),
      filters,
    );
    return {
      players: [],
      total: counted.count ?? 0,
      page,
      pageSize: PAGE_SIZE,
      nationalities,
    };
  }

  if (error) throw error;

  return {
    players: ((data ?? []) as PlayerRow[]).map((row) => withLocalSeasonStats(mapPlayerRow(row), row)),
    total: count ?? 0,
    page,
    pageSize: PAGE_SIZE,
    nationalities,
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

export async function getPlayersByIds(ids: string[]): Promise<Player[]> {
  const wanted = uniquePlayerIds(ids);
  if (!wanted.length) return [];

  if (isSupabaseConfigured()) {
    const { data, error } = await createPublicSupabase().from("players").select("*").in("id", wanted);
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
