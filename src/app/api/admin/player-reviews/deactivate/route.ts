import { isPlayerId } from "@/lib/player-ids";
import { requireAdmin, rpcErrorStatus } from "@/lib/supabase/require-admin";
import { NextRequest } from "next/server";

export async function POST(request: NextRequest) {
  const { supabase, admin, unconfigured, user } = await requireAdmin();
  if (unconfigured) return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!admin || !supabase) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    playerId?: string;
    expectedHeadRevisionId?: string | null;
    privateNote?: string;
  };
  if (!isPlayerId(body.playerId ?? "")) {
    return Response.json({ error: "Invalid player" }, { status: 400 });
  }
  const { data, error } = await supabase.rpc("deactivate_player_review", {
    p_player_id: body.playerId,
    p_expected_head_revision_id: body.expectedHeadRevisionId ?? null,
    p_private_note: body.privateNote ?? null,
  });
  if (error) return Response.json({ error: error.message }, { status: rpcErrorStatus(error) });
  return Response.json(data);
}
