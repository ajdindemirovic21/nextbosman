import fs from "fs";
import path from "path";
import type { Availability, Player, Position } from "@/data/mock-players";
import { uniquePlayerIds } from "@/lib/player-ids";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { mapPlayerRow } from "@/lib/supabase/map-player";
import { createPublicSupabase } from "@/lib/supabase/public";
import type { PlayerRow } from "@/lib/supabase/types";

export type PlayerQuery = {
  status: Availability;
  position?: Position | Position[] | "all";
  nationality?: string;
  euOnly?: boolean;
  maxAge?: number;
  maxMv?: number | "any";
  limit?: number;
};

function positionList(position: PlayerQuery["position"]): Position[] | null {
  if (!position || position === "all") return null;
  const list = Array.isArray(position) ? position : [position];
  return list.length ? list : null;
}

export type PlayerQueryResult = {
  players: Player[];
  total: number;
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
    hasSeasonStats: player.hasSeasonStats === true,
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

function queryPlayersFromJson(filters: PlayerQuery): PlayerQueryResult {
  const catalog = loadCatalog();
  const nationalities = [...new Set(catalog.map((p) => p.nationality).filter(Boolean))].sort();
  let rows = catalog.filter((player) => player.availability === filters.status);
  const wanted = positionList(filters.position);
  if (wanted) {
    rows = rows.filter((player) => wanted.includes(player.position));
  }
  if (filters.nationality && filters.nationality !== "all") {
    rows = rows.filter((player) => player.nationality === filters.nationality);
  }
  if (filters.euOnly) rows = rows.filter((player) => player.euPassport);
  const maxAge = filters.maxAge;
  if (maxAge) rows = rows.filter((player) => player.age <= maxAge);
  const maxMv = filters.maxMv;
  if (typeof maxMv === "number") {
    rows = rows.filter((player) => player.marketValueEur <= maxMv);
  }
  rows.sort((a, b) => b.marketValueEur - a.marketValueEur);
  const total = rows.length;
  const limit = filters.limit ?? 80;
  return { players: rows.slice(0, limit), total, nationalities };
}

async function queryPlayersFromSupabase(filters: PlayerQuery): Promise<PlayerQueryResult> {
  const supabase = createPublicSupabase();
  const limit = filters.limit ?? 80;

  let query = supabase
    .from("players")
    .select("*", { count: "exact" })
    .eq("availability", filters.status)
    .order("market_value_eur", { ascending: false })
    .limit(limit);

  const wanted = positionList(filters.position);
  if (wanted?.length === 1) {
    query = query.eq("position", wanted[0]);
  } else if (wanted && wanted.length > 1) {
    query = query.in("position", wanted);
  }
  if (filters.nationality && filters.nationality !== "all") {
    query = query.eq("nationality", filters.nationality);
  }
  if (filters.euOnly) query = query.eq("eu_passport", true);
  if (filters.maxAge) query = query.lte("age", filters.maxAge);
  if (filters.maxMv && filters.maxMv !== "any") {
    query = query.lte("market_value_eur", filters.maxMv);
  }

  const [{ data, error, count }, nations] = await Promise.all([
    query,
    supabase.rpc("player_nationalities"),
  ]);

  if (error) throw error;

  const nationalities = Array.isArray(nations.data) ? (nations.data as string[]) : [];

  return {
    players: ((data ?? []) as PlayerRow[]).map((row) => withLocalSeasonStats(mapPlayerRow(row), row)),
    total: count ?? 0,
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
