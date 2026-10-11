import { uniquePlayerIds } from "@/lib/player-ids";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { ensureAgentProfile, mapSavedList } from "@/lib/supabase/saved-lists";
import type { SavedListFilters, SavedListRow } from "@/lib/supabase/types";
import { NextRequest } from "next/server";

async function requireAgent() {
  if (!isSupabaseConfigured()) {
    return { supabase: null, user: null as null, unconfigured: true as const };
  }
  const supabase = await createServerSupabase();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) {
    return { supabase, user: null as null, unconfigured: false as const };
  }
  await ensureAgentProfile(supabase, user.id, user.email);
  return { supabase, user, unconfigured: false as const };
}

export async function GET() {
  const { supabase, user, unconfigured } = await requireAgent();
  if (unconfigured) return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  if (!user || !supabase) return Response.json({ error: "Sign in to view saved lists" }, { status: 401 });

  const { data, error } = await supabase
    .from("saved_lists")
    .select("*")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ lists: ((data ?? []) as SavedListRow[]).map(mapSavedList) });
}

export async function POST(request: NextRequest) {
  const { supabase, user, unconfigured } = await requireAgent();
  if (unconfigured) return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  if (!user || !supabase) return Response.json({ error: "Sign in to save a list" }, { status: 401 });

  const body = (await request.json()) as {
    title?: string;
    clubName?: string;
    queryText?: string;
    filters?: SavedListFilters;
    playerIds?: string[];
  };

  const title = body.title?.trim();
  if (!title) return Response.json({ error: "Title is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("saved_lists")
    .insert({
      user_id: user.id,
      title,
      club_name: body.clubName?.trim() || null,
      query_text: body.queryText?.trim() || null,
      filters: body.filters ?? {},
      player_ids: uniquePlayerIds(body.playerIds ?? []),
    })
    .select("*")
    .single();

  if (error) return Response.json({ error: error.message }, { status: 500 });
  return Response.json({ list: mapSavedList(data as SavedListRow) }, { status: 201 });
}
