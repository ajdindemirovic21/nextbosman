import { uniquePlayerIds } from "@/lib/player-ids";
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
  };

  const patch: Record<string, unknown> = {};
  if (typeof body.title === "string") patch.title = body.title.trim();
  if ("clubName" in body) patch.club_name = body.clubName?.trim() || null;
  if ("queryText" in body) patch.query_text = body.queryText?.trim() || null;
  if (body.filters) patch.filters = body.filters;
  if (body.playerIds) patch.player_ids = uniquePlayerIds(body.playerIds);

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
