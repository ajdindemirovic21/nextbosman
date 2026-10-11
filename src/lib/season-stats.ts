import type { Player } from "@/data/mock-players";

export function hasSeasonStats(player: Player) {
  return player.hasSeasonStats === true;
}

export function formatSeasonCount(player: Player, value: number, locale?: string) {
  if (!hasSeasonStats(player)) return "—";
  return locale ? value.toLocaleString(locale) : String(value);
}
