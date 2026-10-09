import { queryPlayers } from "@/data/catalog";
import { positions, type Availability, type Position } from "@/data/mock-players";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const status = (searchParams.get("status") || "free") as Availability;
  if (status !== "free" && status !== "expiring") {
    return Response.json({ error: "Invalid status" }, { status: 400 });
  }

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
    maxAge: Number(searchParams.get("maxAge") || 40),
    maxMv: maxMvRaw && maxMvRaw !== "any" ? Number(maxMvRaw) : "any",
    limit: positionCodes.length > 1 ? 120 : 80,
  });

  return Response.json(result);
}
