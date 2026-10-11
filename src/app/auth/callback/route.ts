import { NextRequest, NextResponse } from "next/server";
import { localeHomePath, requestOrigin } from "@/lib/site-url";
import { createRouteSupabase, withAuthCookies, type AuthCookie } from "@/lib/supabase/route";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const origin = requestOrigin(request);
  const next = localeHomePath(request.nextUrl.searchParams.get("next"));
  const jar: AuthCookie[] = [];

  if (code) {
    const supabase = createRouteSupabase(request, jar);
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (error) {
      return withAuthCookies(NextResponse.redirect(new URL(`${next}?auth=error`, origin)), jar);
    }
  }

  return withAuthCookies(NextResponse.redirect(new URL(next, origin)), jar);
}
