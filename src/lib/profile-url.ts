export const TRANSFERMARKT_PROFILE_HOST = "www.transfermarkt.co.uk";

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function parseTransfermarktProfileUrl(raw: unknown, playerId: string): string | null {
  if (typeof raw !== "string") return null;
  const trimmed = raw.trim();
  const id = String(playerId ?? "").trim();
  if (!trimmed || !id) return null;

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    return null;
  }

  if (parsed.protocol !== "https:") return null;
  if (parsed.username || parsed.password) return null;
  if (parsed.port) return null;
  if (parsed.hostname !== TRANSFERMARKT_PROFILE_HOST) return null;
  if (parsed.search || parsed.hash) return null;

  const pathPattern = new RegExp(`^/[A-Za-z0-9_-]+/profil/spieler/${escapeRegExp(id)}$`);
  if (!pathPattern.test(parsed.pathname)) return null;

  return `https://${TRANSFERMARKT_PROFILE_HOST}${parsed.pathname}`;
}
