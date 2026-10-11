import { getPlayer } from "@/data/catalog";
import { NextRequest } from "next/server";

function isPlayerId(id: string) {
  return /^[a-zA-Z0-9_-]{1,32}$/.test(id);
}

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

  return Response.json({ player });
}
