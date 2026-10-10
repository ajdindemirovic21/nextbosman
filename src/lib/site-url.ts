export function requestOrigin(request: Request) {
  const env = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (env) return env;
  const host = request.headers.get("x-forwarded-host") ?? request.headers.get("host");
  const proto = request.headers.get("x-forwarded-proto") ?? "https";
  if (host) return `${proto}://${host}`;
  return new URL(request.url).origin;
}

export function safeNextPath(next: string | null, fallback = "/") {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return fallback;
  return next;
}
