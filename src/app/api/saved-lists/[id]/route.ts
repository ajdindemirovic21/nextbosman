import { isPlayerId, uniquePlayerIds } from "@/lib/player-ids";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { ensureAgentProfile, mapSavedList } from "@/lib/supabase/saved-lists";
import type { SavedListFilters, SavedListRow } from "@/lib/supabase/types";
import { NextRequest } from "next/server";

type Params = { params: Promise<{ id: string }> };

async function requireAgent() {
  if (!isSupabaseConfigured()) {
    return { supabase: null, user: null as null, unconfigured: true as const };
  }
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { supabase, user: null as null, unconfigured: false as const };
  await ensureAgentProfile(supabase, user.id, user.email);
  return { supabase, user, unconfigured: false as const };
}

async function loadOwnList(
  supabase: NonNullable<Awaited<ReturnType<typeof requireAgent>>["supabase"]>,
  userId: string,
  id: string,
) {
  return supabase.from("saved_lists").select("*").eq("id", id).eq("user_id", userId).maybeSingle();
}

export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user, unconfigured } = await requireAgent();
  if (unconfigured) return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  if (!user || !supabase) return Response.json({ error: "Sign in to update a list" }, { status: 401 });

  const body = (await request.json()) as {
    title?: string;
    clubName?: string | null;
    queryText?: string | null;
    filters?: SavedListFilters;
    playerIds?: string[];
    addPlayerId?: string;
    removePlayerId?: string;
  };

  const addPlayerId = typeof body.addPlayerId === "string" ? body.addPlayerId.trim() : "";
  const removePlayerId = typeof body.removePlayerId === "string" ? body.removePlayerId.trim() : "";
  if (addPlayerId && !isPlayerId(addPlayerId)) {
    return Response.json({ error: "Invalid player id" }, { status: 400 });
  }
  if (removePlayerId && !isPlayerId(removePlayerId)) {
    return Response.json({ error: "Invalid player id" }, { status: 400 });
  }

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.trim();
  if ("clubName" in body) patch.club_name = body.clubName?.trim() || null;
  if ("queryText" in body) patch.query_text = body.queryText?.trim() || null;
  if (body.filters) patch.filters = body.filters;

  if (addPlayerId || removePlayerId) {
    const { data: current, error: loadError } = await loadOwnList(supabase, user.id, id);
    if (loadError) return Response.json({ error: loadError.message }, { status: 500 });
    if (!current) return Response.json({ error: "List not found" }, { status: 404 });

    const currentIds = uniquePlayerIds((current as SavedListRow).player_ids ?? []);
    if (addPlayerId && currentIds.includes(addPlayerId) && !removePlayerId && Object.keys(patch).length === 0) {
      return Response.json({ list: mapSavedList(current as SavedListRow), alreadyMember: true });
    }

    let nextIds = currentIds;
    if (addPlayerId) nextIds = uniquePlayerIds([...nextIds, addPlayerId]);
    if (removePlayerId) nextIds = nextIds.filter((playerId) => playerId !== removePlayerId);
    patch.player_ids = nextIds;
  } else if (body.playerIds) {
    patch.player_ids = uniquePlayerIds(body.playerIds);
  }

  if (Object.keys(patch).length === 0) {
    return Response.json({ error: "Nothing to update" }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("saved_lists")
    .update(patch)
    .eq("id", id)
    .eq("user_id", user.id)
    .select("*")
    .maybeSingle();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!data) return Response.json({ error: "List not found" }, { status: 404 });
  return Response.json({ list: mapSavedList(data as SavedListRow) });
}

export async function DELETE(_request: NextRequest, { params }: Params) {
  const { id } = await params;
  const { supabase, user, unconfigured } = await requireAgent();
  if (unconfigured) return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  if (!user || !supabase) return Response.json({ error: "Sign in to delete a list" }, { status: 401 });

  const { error, count } = await supabase
    .from("saved_lists")
    .delete({ count: "exact" })
    .eq("id", id)
    .eq("user_id", user.id);

  if (error) return Response.json({ error: error.message }, { status: 500 });
  if (!count) return Response.json({ error: "List not found" }, { status: 404 });
  return Response.json({ ok: true });
}
