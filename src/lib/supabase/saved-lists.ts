import type { SavedList, SavedListFilters, SavedListRow } from "@/lib/supabase/types";

export function mapSavedList(row: SavedListRow): SavedList {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    clubName: row.club_name,
    queryText: row.query_text,
    filters: (row.filters ?? {}) as SavedListFilters,
    playerIds: row.player_ids ?? [],
    shareToken: row.share_token ?? null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function ensureAgentProfile(
  supabase: Awaited<ReturnType<typeof import("@/lib/supabase/server").createServerSupabase>>,
  userId: string,
  email: string | undefined,
) {
  const { error } = await supabase.from("users").upsert(
    {
      id: userId,
      email: email ?? null,
    },
    { onConflict: "id" },
  );
  if (error) throw error;
}
