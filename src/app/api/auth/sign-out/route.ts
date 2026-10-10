import { NextRequest, NextResponse } from "next/server";
import { createServerSupabase } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { requestOrigin, safeNextPath } from "@/lib/site-url";

export async function POST(request: NextRequest) {
  if (isSupabaseConfigured()) {
    const supabase = await createServerSupabase();
    await supabase.auth.signOut();
  }
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  return NextResponse.redirect(new URL(next, requestOrigin(request)), { status: 303 });
}
