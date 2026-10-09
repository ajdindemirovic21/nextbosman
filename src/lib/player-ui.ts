import type { Player, Position } from "@/data/mock-players";

export type PositionLine = "gk" | "def" | "mid" | "fwd";

export function positionLine(position: Position): PositionLine {
  if (position === "GK") return "gk";
  if (position === "CB" || position === "LB" || position === "RB") return "def";
  if (position === "DM" || position === "CM" || position === "AM") return "mid";
  return "fwd";
}

export type ContractAccent = "free" | "soon" | null;

/** Free now = emerald. Contract ending within 12 months (or marked expiring) = orange. */
export function contractAccent(player: Player, now = new Date()): ContractAccent {
  if (player.availability === "free") return "free";
  if (player.contractUntil) {
    const until = Date.parse(`${player.contractUntil}T00:00:00Z`);
    if (!Number.isNaN(until)) {
      const horizon = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 12, now.getUTCDate());
      if (until <= horizon) return "soon";
    }
  }
  if (player.availability === "expiring") return "soon";
  return null;
}
