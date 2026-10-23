const MAX_LENGTH = 2048;
const BLOCKED_HOSTS = new Set(["localhost", "127.0.0.1", "0.0.0.0", "::1", "[::1]"]);

function isPrivateHostname(hostname: string) {
  if (BLOCKED_HOSTS.has(hostname.toLowerCase())) return true;
  if (hostname.endsWith(".localhost")) return true;
  if (hostname === "local") return true;
  const ipv4 = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/.exec(hostname);
  if (ipv4) {
    const [a, b] = [Number(ipv4[1]), Number(ipv4[2])];
    if (a === 10 || a === 127 || a === 0) return true;
    if (a === 192 && b === 168) return true;
    if (a === 172 && b >= 16 && b <= 31) return true;
    if (a === 169 && b === 254) return true;
  }
  return hostname.startsWith("10.") || hostname.endsWith(".internal");
}

/** Public HTTPS page URL for a club, league, federation, or similar. Never fetched server-side. */
export function parsePublicSourceUrl(raw: unknown): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  if (!trimmed || trimmed.length > MAX_LENGTH) return null;
  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }
  if (parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  if (parsed.port && parsed.port !== "443") return null;
  if (!parsed.hostname || isPrivateHostname(parsed.hostname)) return null;
  if (parsed.hostname.includes(" ")) return null;
  return parsed.href;
}

export function sourceUrlHost(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "";
  }
}
