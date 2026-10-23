import { getPlayer } from "@/data/catalog";
import { isPlayerId } from "@/lib/player-ids";
import { publicPlayerPayload } from "@/lib/player-review";
import { NextRequest } from "next/server";

export async function GET(
  _request: NextRequest,
  context: { params: Promise<{ id: string }> },
) {
  const { id } = await context.params;
  if (!isPlayerId(id)) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  const player = await getPlayer(id);
  if (!player) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({ player: publicPlayerPayload(player) });
}
