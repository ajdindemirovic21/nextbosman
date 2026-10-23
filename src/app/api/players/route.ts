import { getPlayersByIds, queryPlayers } from "@/data/catalog";
import { positions, type Position } from "@/data/mock-players";
import { isPlayerId, uniquePlayerIds } from "@/lib/player-ids";
import { isCatalogQueryStatus, publicPlayerPayload } from "@/lib/player-review";
import { PAGE_SIZE, parsePageParam } from "@/lib/player-page";
import { NextRequest } from "next/server";

const MAX_IDS = 200;

function parseOptionalAge(raw: string | null): number | undefined {
  if (raw == null || raw === "" || raw === "any") return undefined;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 15 || value > 55) return undefined;
  return value;
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const idsRaw = searchParams.get("ids");
  if (idsRaw != null && idsRaw.trim()) {
    const ids = uniquePlayerIds(idsRaw.split(",").filter(isPlayerId)).slice(0, MAX_IDS);
    const players = await getPlayersByIds(ids);
    return Response.json({ players: players.map(publicPlayerPayload) });
  }

  const statusRaw = searchParams.get("status") || "free";
  if (!isCatalogQueryStatus(statusRaw)) {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }
  const status = statusRaw;

  const maxMvRaw = searchParams.get("maxMv");
  const positionRaw = searchParams.get("position") || "all";
  const positionCodes = positionRaw
    .split(",")
    .map((code) => code.trim())
    .filter((code): code is Position => (positions as readonly string[]).includes(code));
  const position: Position | Position[] | "all" =
    positionRaw === "all" || positionCodes.length === 0
      ? "all"
      : positionCodes.length === 1
        ? positionCodes[0]
        : positionCodes;

  const result = await queryPlayers({
    status,
    position,
    nationality: searchParams.get("nationality") || "all",
    euOnly: searchParams.get("eu") === "1",
    minAge: parseOptionalAge(searchParams.get("minAge")),
    maxAge: parseOptionalAge(searchParams.get("maxAge")),
    maxMv: maxMvRaw && maxMvRaw !== "any" ? Number(maxMvRaw) : "any",
    page: parsePageParam(searchParams.get("page")),
  });

  return Response.json({
    ...result,
    players: result.players.map(publicPlayerPayload),
    page: result.page,
    pageSize: PAGE_SIZE,
  });
}
