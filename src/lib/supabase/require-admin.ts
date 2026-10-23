import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";

export async function requireAdmin() {
  if (!isSupabaseConfigured()) {
    return { supabase: null, user: null as null, admin: false, unconfigured: true as const };
  }
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { supabase, user: null as null, admin: false, unconfigured: false as const };
  }
  const { data, error } = await supabase.rpc("current_user_is_admin");
  if (error || data !== true) {
    return { supabase, user, admin: false, unconfigured: false as const };
  }
  return { supabase, user, admin: true, unconfigured: false as const };
}

export function rpcErrorStatus(error: { code?: string; message?: string } | null): number {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`;
  if (text.includes("42501") || text.includes("not_admin")) return 403;
  if (
    text.includes("PT409") ||
    text.includes("revision_conflict") ||
    error?.code === "40001"
  ) {
    return 409;
  }
  if (text.includes("P0002") || text.includes("not_found")) return 404;
  return 400;
}
