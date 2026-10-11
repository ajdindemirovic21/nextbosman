import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createRouteSupabase, withAuthCookies, type AuthCookie } from "@/lib/supabase/route";
import { authRedirectOrigin, localeHomePath } from "@/lib/site-url";

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Auth is not configured" }, { status: 503 });
  }

  const origin = authRedirectOrigin(request, request.nextUrl.searchParams.get("origin"));
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

  const response = withAuthCookies(NextResponse.redirect(data.url), jar);
  response.cookies.set("nb-auth-origin", origin, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 10,
  });
  return response;
}
