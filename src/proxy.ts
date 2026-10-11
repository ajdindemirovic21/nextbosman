import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { copyCookies, withSupabaseSession } from "@/lib/supabase/middleware";

const locales = ["en", "es", "de", "fr", "pt", "tr", "it", "bs", "hr"] as const;
type Locale = (typeof locales)[number];
const defaultLocale: Locale = "en";

function isLocale(value: string): value is Locale {
  return (locales as readonly string[]).includes(value);
}

function negotiateLocale(header: string): Locale {
  const wanted = header.split(",").map((part) => part.split(";")[0]?.trim().toLowerCase());

  for (const tag of wanted) {
    if (!tag) continue;
    if (isLocale(tag)) return tag;
    const base = tag.split("-")[0];
    if (isLocale(base)) return base;
  }

  return defaultLocale;
}

function localeFromRequest(request: NextRequest): Locale {
  const cookie = request.cookies.get("NEXT_LOCALE")?.value;
  if (cookie && isLocale(cookie)) return cookie;
  return negotiateLocale(request.headers.get("accept-language") ?? "");
}

export async function proxy(request: NextRequest) {
  const sessionResponse = await withSupabaseSession(request);
  const { pathname } = request.nextUrl;
  const pathnameHasLocale = locales.some(
    (locale) => pathname.startsWith(`/${locale}/`) || pathname === `/${locale}`,
  );

  if (
    pathname.startsWith("/api/") ||
    pathname.startsWith("/auth/") ||
    pathname.startsWith("/icon") ||
    pathname.startsWith("/apple-icon") ||
    pathname.startsWith("/opengraph-image") ||
    pathname.startsWith("/twitter-image") ||
    pathname === "/sitemap.xml" ||
    pathname === "/robots.txt" ||
    pathname === "/manifest.webmanifest"
  ) {
    return sessionResponse;
  }

  const oauthCode = request.nextUrl.searchParams.get("code");
  if (oauthCode) {
    const locale = pathnameHasLocale ? pathname.split("/")[1] : localeFromRequest(request);
    const nextPath = pathnameHasLocale ? pathname : `/${locale}`;
    const callbackUrl = request.nextUrl.clone();
    callbackUrl.pathname = "/auth/callback";
    callbackUrl.search = "";
    callbackUrl.searchParams.set("code", oauthCode);
    callbackUrl.searchParams.set("next", nextPath);
    return copyCookies(sessionResponse, NextResponse.redirect(callbackUrl));
  }

  if (pathnameHasLocale) return sessionResponse;

  const locale = localeFromRequest(request);
  request.nextUrl.pathname = `/${locale}${pathname}`;
  return copyCookies(sessionResponse, NextResponse.redirect(request.nextUrl));
}

export const config = {
  matcher: ["/((?!_next|.*\\..*).*)"],
};
