import { NextRequest, NextResponse } from "next/server";
import { localeHomePath, requestOrigin, resumeLocalAuthUrl } from "@/lib/site-url";
import { createRouteSupabase, withAuthCookies, type AuthCookie } from "@/lib/supabase/route";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const next = localeHomePath(request.nextUrl.searchParams.get("next"));
  const origin = requestOrigin(request);

  if (code) {
    const resume = resumeLocalAuthUrl(request, code, next);
    if (resume) return NextResponse.redirect(resume);
  }

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
