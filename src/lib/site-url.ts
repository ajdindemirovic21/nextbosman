import { defaultLocale, isLocale } from "@/i18n/config";

/** Public origin for canonical, OG, and sitemap. Set NEXT_PUBLIC_SITE_URL in production. */
export function getConfiguredSiteUrl() {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (env) return env;
  return "http://localhost:3000";
}

function hostnameOf(value: string) {
  try {
    return new URL(value.includes("://") ? value : `https://${value}`).hostname;
  } catch {
    return "";
  }
}

export function isLocalAuthHost(host: string) {
  return host === "localhost" || host === "127.0.0.1";
}

export function localAuthOrigin() {
  return "http://localhost:3000";
}

export function isAllowedAuthOrigin(origin: string) {
  const host = hostnameOf(origin);
  if (!host) return false;
  if (isLocalAuthHost(host)) return true;
  if (host.endsWith(".vercel.app")) return true;
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured && hostnameOf(configured) === host) return true;
  return false;
}

export function hasPkceVerifierCookie(request: { cookies: { getAll(): { name: string; value: string }[] } }) {
  return request.cookies.getAll().some((cookie) => cookie.name.includes("code-verifier") && cookie.value);
}

/** If Google/Supabase dropped a localhost login onto Vercel, send the code back to local PKCE cookies. */
export function resumeLocalAuthUrl(request: { url: string; nextUrl?: URL; cookies: { getAll(): { name: string; value: string }[] } }, code: string, nextPath: string) {
  const url = new URL(request.url);
  if (isLocalAuthHost(url.hostname)) return null;
  if (hasPkceVerifierCookie(request)) return null;
  const resume = new URL("/auth/callback", localAuthOrigin());
  resume.searchParams.set("code", code);
  resume.searchParams.set("next", nextPath);
  return resume;
}

/** Origin of the current request — production login stays on Vercel, local login stays on localhost. */
export function requestOrigin(request: Request) {
  const url = new URL(request.url);
  if (isLocalAuthHost(url.hostname)) return url.origin;

  const headerHost = request.headers.get("host")?.split(",")[0]?.trim() || "";
  if (isLocalAuthHost(hostnameOf(headerHost) || headerHost.split(":")[0])) {
    const proto =
      request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() || "http";
    return `${proto}://${headerHost}`.replace(/\/$/, "");
  }

  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || headerHost;
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const candidate = host ? `${proto}://${host}` : "";
  if (candidate && isAllowedAuthOrigin(candidate)) return candidate.replace(/\/$/, "");

  return url.origin;
}

export function authRedirectOrigin(request: Request, originParam: string | null) {
  const hinted = originParam?.trim().replace(/\/$/, "") ?? "";
  if (hinted && isAllowedAuthOrigin(hinted)) return hinted;
  return requestOrigin(request);
}

export function safeNextPath(next: string | null, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}

export function localeHomePath(next: string | null, fallbackLocale = defaultLocale) {
  const path = safeNextPath(next, `/${fallbackLocale}`);
  const first = path.split("/").filter(Boolean)[0];
  if (first && isLocale(first)) return path === "/" ? `/${first}` : path;
  return `/${fallbackLocale}${path === "/" ? "" : path}`;
}
