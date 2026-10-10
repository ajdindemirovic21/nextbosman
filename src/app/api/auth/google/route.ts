import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createServerSupabase } from "@/lib/supabase/server";
import { requestOrigin, safeNextPath } from "@/lib/site-url";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Auth is not configured" }, { status: 503 });
  }

  const origin = requestOrigin(request);
  const next = safeNextPath(request.nextUrl.searchParams.get("next"));
  const supabase = await createServerSupabase();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent(next)}`,
      queryParams: {
        access_type: "offline",
        prompt: "consent",
      },
    },
  });

  if (error || !data.url) {
    return NextResponse.json(
      { error: error?.message ?? "Google sign-in failed" },
      { status: 400 },
    );
  }

  return NextResponse.redirect(data.url);
}
