import type { Position } from "@/data/mock-players";

const SUB: Record<string, Position> = {
  Goalkeeper: "GK",
  "Centre-Back": "CB",
  "Sweeper": "CB",
  "Left-Back": "LB",
  "Right-Back": "RB",
  "Defensive Midfield": "DM",
  "Central Midfield": "CM",
  "Right Midfield": "RW",
  "Left Midfield": "LW",
  "Attacking Midfield": "AM",
  "Left Winger": "LW",
  "Right Winger": "RW",
  "Centre-Forward": "ST",
  "Second Striker": "ST",
};

const GROUP: Record<string, Position> = {
  Goalkeeper: "GK",
  Defender: "CB",
  Midfield: "CM",
  Attack: "ST",
};

export function mapPosition(subPosition: string, group: string): Position {
  return SUB[subPosition] ?? GROUP[group] ?? "CM";
}
