import type { Player } from "@/data/mock-players";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatDate } from "@/lib/format";

function hasClubName(value: string | null | undefined): value is string {
  return Boolean(value && value !== "—");
}

export function formatListedClub(player: Player, dict: Dictionary): string {
  if (hasClubName(player.club)) return player.club;
  if (hasClubName(player.lastClub)) return `${dict.status.listedClub}: ${player.lastClub}`;
  return "—";
}

export function contractPrimary(player: Player, dict: Dictionary, locale: string): string {
  if (player.freeSince) {
    return dict.status.listedExpiry.replace("{date}", formatDate(player.freeSince, locale));
  }
  if (player.contractUntil) {
    return dict.status.listedUntil.replace("{date}", formatDate(player.contractUntil, locale));
  }
  return dict.status.contractUnknown;
}

export function contractNote(player: Player, dict: Dictionary): string | null {
  if (player.freeSince) return dict.status.statusUnconfirmed;
  return null;
}

export function contractShareLine(player: Player, dict: Dictionary, locale: string): string {
  const primary = contractPrimary(player, dict, locale);
  const note = contractNote(player, dict);
  return note ? `${primary} ${note}` : primary;
}
