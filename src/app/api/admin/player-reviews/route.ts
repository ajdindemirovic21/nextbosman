import { getPlayer } from "@/data/catalog";
import { isPlayerId } from "@/lib/player-ids";
import {
  validateReviewDraft,
  type CheckStatus,
  type ClubMode,
  type FieldMode,
  type ReviewDraft,
} from "@/lib/player-review";
import { parsePublicSourceUrl } from "@/lib/public-source-url";
import { requireAdmin, rpcErrorStatus } from "@/lib/supabase/require-admin";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { supabase, admin, unconfigured, user } = await requireAdmin();
  if (unconfigured) return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!admin || !supabase) return Response.json({ error: "Forbidden" }, { status: 403 });

  const playerId = request.nextUrl.searchParams.get("playerId") ?? "";
  if (!isPlayerId(playerId)) {
    return Response.json({ error: "Invalid player" }, { status: 400 });
  }
  const player = await getPlayer(playerId);
  if (!player) return Response.json({ error: "Not found" }, { status: 404 });

  const [current, history] = await Promise.all([
    supabase.rpc("admin_player_review_current", { p_player_id: playerId }),
    supabase.rpc("admin_player_review_history", { p_player_id: playerId }),
  ]);
  if (current.error) {
    return Response.json({ error: current.error.message }, { status: rpcErrorStatus(current.error) });
  }
  if (history.error) {
    return Response.json({ error: history.error.message }, { status: rpcErrorStatus(history.error) });
  }

  return Response.json({
    player,
    review: Array.isArray(current.data) ? current.data[0] ?? null : current.data ?? null,
    history: history.data ?? [],
  });
}

export async function POST(request: NextRequest) {
  const { supabase, admin, unconfigured, user } = await requireAdmin();
  if (unconfigured) return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!admin || !supabase) return Response.json({ error: "Forbidden" }, { status: 403 });

  const body = (await request.json()) as {
    playerId?: string;
    expectedHeadRevisionId?: string | null;
    draft?: ReviewDraft;
  };
  const playerId = body.playerId ?? "";
  if (!isPlayerId(playerId) || !body.draft) {
    return Response.json({ error: "Invalid body" }, { status: 400 });
  }
  const player = await getPlayer(playerId);
  if (!player) return Response.json({ error: "Not found" }, { status: 404 });
  const invalid = validateReviewDraft(body.draft, player);
  if (invalid) return Response.json({ error: invalid }, { status: 400 });
  if (!parsePublicSourceUrl(body.draft.sourceUrl)) {
    return Response.json({ error: "sourceUrl" }, { status: 400 });
  }

  const draft = body.draft;
  const { data, error } = await supabase.rpc("apply_player_review", {
    p_player_id: playerId,
    p_check_status: draft.checkStatus as CheckStatus,
    p_club_mode: (draft.checkStatus === "no_club" ? "none" : draft.clubMode) as ClubMode,
    p_club_value: draft.clubMode === "set" ? draft.clubValue : null,
    p_contract_mode: draft.contractMode as FieldMode,
    p_contract_value: draft.contractMode === "set" ? draft.contractValue || null : null,
    p_source_url: draft.sourceUrl,
    p_event_at: draft.eventAt || null,
    p_public_note: draft.publicNote,
    p_private_note: draft.privateNote,
    p_expected_head_revision_id: body.expectedHeadRevisionId ?? null,
  });
  if (error) return Response.json({ error: error.message }, { status: rpcErrorStatus(error) });
  return Response.json(data);
}
