/**
 * Trusted write path for listing snapshots. Script/server only.
 * Uses the service role. Never grant these writes to anon or authenticated agents.
 */
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { AutoRefreshRecord } from "@/lib/auto-refresh";
import { supabaseServiceRoleKey, supabaseUrl, supabaseAnonKey } from "@/lib/supabase/env";

export function isAutoRefreshPersistEnabled() {
  return process.env.AUTO_REFRESH_PERSIST === "1" && process.env.AUTO_REFRESH_DRY_RUN !== "1";
}

export function createSnapshotWriter(client?: SupabaseClient) {
  if (client) return client;
  const url = supabaseUrl();
  const service = supabaseServiceRoleKey();
  const anon = supabaseAnonKey();
  if (!url || !service) {
    throw new Error("Snapshot persist requires a service-role key on the server. Refusing.");
  }
  if (anon && service === anon) {
    throw new Error("Snapshot persist refused: service-role key matches the public key.");
  }
  return createClient(url, service, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}

export async function persistAutoRefreshRecord(
  playerId: string,
  record: AutoRefreshRecord,
  client?: SupabaseClient,
) {
  if (!client && !isAutoRefreshPersistEnabled()) {
    throw new Error("Snapshot persist requires AUTO_REFRESH_PERSIST=1 and must not be a dry-run.");
  }
  const sb = createSnapshotWriter(client);
  if (record.snapshot && !record.lastError) {
    const { error } = await sb.from("player_auto_snapshots").upsert(
      {
        player_id: playerId,
        club_id: record.snapshot.clubId,
        club_name: record.snapshot.clubName,
        contract_expires: record.snapshot.contractExpires,
        is_retired: record.snapshot.isRetired,
        joined: record.snapshot.joined,
        fetched_at: record.snapshot.fetchedAt,
        last_error: null,
        last_error_at: null,
      },
      { onConflict: "player_id" },
    );
    if (error) throw error;
    return;
  }

  const { data: existing, error: readError } = await sb
    .from("player_auto_snapshots")
    .select("player_id, fetched_at, club_id, club_name, contract_expires, is_retired, joined")
    .eq("player_id", playerId)
    .maybeSingle();
  if (readError) throw readError;

  if (!existing) {
    const { error } = await sb.from("player_auto_snapshots").insert({
      player_id: playerId,
      last_error: record.lastError,
      last_error_at: record.lastErrorAt,
    });
    if (error) throw error;
    return;
  }

  const { error } = await sb
    .from("player_auto_snapshots")
    .update({
      last_error: record.lastError,
      last_error_at: record.lastErrorAt,
    })
    .eq("player_id", playerId);
  if (error) throw error;
}
