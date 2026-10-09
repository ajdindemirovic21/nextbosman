import { positions, type Availability, type Position } from "@/data/mock-players";

export const PASTE_STORAGE_KEY = "nb-whatsapp-paste";

export type PasteParse = {
  position?: Position;
  positions: Position[];
  availability?: Availability;
  euPassport: boolean;
  loan: boolean;
};

const POSITION_KEYS: Array<{ keys: string[]; position?: Position; bothWings?: boolean }> = [
  { keys: ["goalkeeper", "golman", "keeper", "gk"], position: "GK" },
  { keys: ["centre-back", "center-back", "stoper", "cb"], position: "CB" },
  { keys: ["left-back", "left back", "lijevi bek", "levi bek", "lb", "lwb"], position: "LB" },
  { keys: ["right-back", "right back", "desni bek", "rb", "rwb"], position: "RB" },
  { keys: ["defensive midfield", "zadnji vezni", "cdm", "dm"], position: "DM" },
  { keys: ["central midfield", "centralni vezni", "vezni", "cm"], position: "CM" },
  { keys: ["attacking midfield", "ofanzivni", "trequartista", "cam", "am", "no.10", "no 10"], position: "AM" },
  { keys: ["left winger", "left wing", "lijevo krilo", "lw"], position: "LW" },
  { keys: ["right winger", "right wing", "desno krilo", "rw"], position: "RW" },
  { keys: ["winger", "krilo", "wing"], bothWings: true },
  { keys: ["striker", "napadac", "napadač", "centre-forward", "forward", "no.9", "no 9", "st", "cf"], position: "ST" },
];

export function hasToken(text: string, key: string): boolean {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  if (key.length <= 3) {
    return new RegExp(`(^|[^a-z0-9])${escaped}([^a-z0-9]|$)`, "i").test(text);
  }
  return text.includes(key);
}

export function extractPositions(raw: string): Position[] {
  const text = raw.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const found: Position[] = [];
  const add = (code: Position) => {
    if (!found.includes(code)) found.push(code);
  };

  for (const row of POSITION_KEYS) {
    if (!row.keys.some((key) => hasToken(text, key))) continue;
    if (row.bothWings) {
      add("LW");
      add("RW");
      continue;
    }
    if (row.position) add(row.position);
  }

  if (!found.length) {
    for (const code of positions) {
      if (hasToken(text, code.toLowerCase())) add(code);
    }
  }

  return found;
}

export function parseWhatsAppPaste(raw: string): PasteParse {
  const text = raw.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  const found = extractPositions(raw);
  const result: PasteParse = {
    euPassport: false,
    loan: false,
    positions: found,
    position: found[0],
  };
  if (!text) return result;

  const wantsFree = /slobodan|slobodni|free\s*agent|\bfree\b|bez ugovora|without a club|out of contract/.test(
    text,
  );
  const wantsExpiring = /istice|istek|expir|ending contract|ugovor isti/.test(text);
  if (wantsFree) result.availability = "free";
  else if (wantsExpiring) result.availability = "expiring";

  result.loan = /\bloan\b|posudba|na posudbu|prestamo/.test(text);
  result.euPassport = /\beu\b|eu pasos|eu passport|eu putovnica|eu drzavl/.test(text);

  return result;
}
