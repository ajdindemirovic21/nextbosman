import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createRouteSupabase, withAuthCookies, type AuthCookie } from "@/lib/supabase/route";
import { localeHomePath, requestOrigin } from "@/lib/site-url";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Auth is not configured" }, { status: 503 });
  }

  const origin = requestOrigin(request);
  const next = localeHomePath(request.nextUrl.searchParams.get("next"));
  const jar: AuthCookie[] = [];
  const supabase = createRouteSupabase(request, jar);
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

  return withAuthCookies(NextResponse.redirect(data.url), jar);
}
