export function isPlayerId(id: string) {
  return /^[a-zA-Z0-9_-]{1,32}$/.test(id);
}

export function uniquePlayerIds(ids: readonly string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of ids) {
    const id = raw.trim();
    if (!isPlayerId(id) || seen.has(id)) continue;
    seen.add(id);
    out.push(id);
  }
  return out;
}
