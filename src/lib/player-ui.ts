import type { Player, Position } from "@/data/mock-players";

export type PositionLine = "gk" | "def" | "mid" | "fwd";

export function positionLine(position: Position): PositionLine {
  if (position === "GK") return "gk";
  if (position === "CB" || position === "LB" || position === "RB") return "def";
  if (position === "DM" || position === "CM" || position === "AM") return "mid";
  return "fwd";
}

export type ContractAccent = "free" | "soon" | null;

/** Listed future expiry within 12 calendar months UTC (or the expiring filter bucket) = orange. Past dates are not treated as confirmed free. */
export function contractAccent(player: Player, now = new Date()): ContractAccent {
  if (player.filterBucket === "no_club" || player.filterBucket === "other") return null;
  if (player.filterBucket === "expiring") return "soon";
  if (player.autoRefresh && !player.manualReview) return null;
  if (player.contractUntil) {
    const until = Date.parse(`${player.contractUntil}T00:00:00Z`);
    if (!Number.isNaN(until)) {
      const horizon = Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 12, now.getUTCDate());
      if (until > Date.parse(`${now.toISOString().slice(0, 10)}T00:00:00Z`) && until <= horizon) {
        return "soon";
      }
    }
  }
  if (!player.manualReview && player.availability === "expiring") return "soon";
  return null;
}
