import { cache } from "react";
import { connection } from "next/server";
import { uniquePlayerIds } from "@/lib/player-ids";
import { isShareToken } from "@/lib/share-token";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createPublicSupabase } from "@/lib/supabase/public";
import type { SharedListPublic } from "@/lib/supabase/types";

type SharedListRpcRow = {
  title: string;
  club_name: string | null;
  player_ids: string[] | null;
  updated_at: string;
};

export const loadSharedList = cache(async (token: string): Promise<SharedListPublic | null> => {
  await connection();
  if (!isShareToken(token) || !isSupabaseConfigured()) return null;

  const { data, error } = await createPublicSupabase().rpc("get_shared_list", { p_token: token });
  if (error) return null;

  const row = Array.isArray(data) ? (data[0] as SharedListRpcRow | undefined) : (data as SharedListRpcRow | null);
  if (!row?.title) return null;

  return {
    title: row.title,
    clubName: row.club_name ?? null,
    playerIds: uniquePlayerIds(row.player_ids ?? []),
    updatedAt: row.updated_at,
  };
});
