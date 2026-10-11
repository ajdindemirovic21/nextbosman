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

function isAllowedAuthOrigin(origin: string) {
  const host = hostnameOf(origin);
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1") return true;
  if (host.endsWith(".vercel.app")) return true;
  const configured = process.env.NEXT_PUBLIC_SITE_URL?.trim();
  if (configured && hostnameOf(configured) === host) return true;
  return false;
}

/** Origin of the current request — production login stays on Vercel, local login stays on localhost. */
export function requestOrigin(request: Request) {
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",")[0]?.trim();
  const host = forwardedHost || request.headers.get("host") || "";
  const proto =
    request.headers.get("x-forwarded-proto")?.split(",")[0]?.trim() ||
    (host.startsWith("localhost") || host.startsWith("127.") ? "http" : "https");
  const candidate = host ? `${proto}://${host}` : "";
  if (candidate && isAllowedAuthOrigin(candidate)) return candidate.replace(/\/$/, "");

  const env = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/$/, "");
  if (env) return env;
  return new URL(request.url).origin;
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
