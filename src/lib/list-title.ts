import type { Position } from "@/data/mock-players";

export type ListTitleInput = {
  club?: string | null;
  positions?: Position | Position[] | "all" | null;
  minAge?: number | null;
  maxAge?: number | null;
  euOnly?: boolean;
};

export type ListTitleLabels = {
  ageUpTo: string;
  ageFrom: string;
  ageRange: string;
  eu: string;
};

function positionCodes(position: ListTitleInput["positions"]): string[] {
  if (!position || position === "all") return [];
  return (Array.isArray(position) ? position : [position]).filter(Boolean);
}

export function recognizedClubName(club?: string | null): string {
  return club?.trim() ?? "";
}

export function suggestedListFields(input: ListTitleInput, labels: ListTitleLabels): {
  title: string;
  club: string;
} {
  const club = recognizedClubName(input.club);
  const parts: string[] = [];
  if (club) parts.push(club);
  const codes = positionCodes(input.positions);
  if (codes.length) parts.push(codes.join("/"));
  if (input.minAge != null && input.maxAge != null) {
    parts.push(
      labels.ageRange.replace("{min}", String(input.minAge)).replace("{max}", String(input.maxAge)),
    );
  } else if (input.maxAge != null) {
    parts.push(labels.ageUpTo.replace("{age}", String(input.maxAge)));
  } else if (input.minAge != null) {
    parts.push(labels.ageFrom.replace("{age}", String(input.minAge)));
  }
  if (input.euOnly) parts.push(labels.eu);
  return { title: parts.join(" · "), club };
}

export function formatListOption(
  list: { title: string; clubName: string | null; playerIds: string[] },
  playersLabel: string,
): string {
  const players = playersLabel.replace("{count}", String(list.playerIds.length));
  const club = list.clubName?.trim();
  return club ? `${list.title} · ${club} · ${players}` : `${list.title} · ${players}`;
}
