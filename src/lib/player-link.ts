export function playerSearchPath(locale: string, playerId: string, search = "") {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.set("player", playerId);
  return `/${locale}/search?${params.toString()}`;
}

export function searchPathWithoutPlayer(locale: string, search = "") {
  const params = new URLSearchParams(search.startsWith("?") ? search.slice(1) : search);
  params.delete("player");
  const query = params.toString();
  return query ? `/${locale}/search?${query}` : `/${locale}/search`;
}
