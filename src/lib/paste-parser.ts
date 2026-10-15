import { positions, type CatalogStatus, type Position } from "@/data/mock-players";

export const PASTE_STORAGE_KEY = "nb-whatsapp-paste";

export type UnverifiableNeed = "salary" | "transfer" | "loan" | "confirmedFree";

export type PasteParse = {
  position?: Position;
  positions: Position[];
  club?: string;
  euPassport: boolean;
  minAge?: number;
  maxAge?: number;
  maxMv?: number;
  salaryEur?: number;
  transferEur?: number;
  loan: boolean;
  wantsFreeAgent: boolean;
  wantsListedExpiry: boolean;
  unverifiable: UnverifiableNeed[];
};

function fold(raw: string) {
  return raw.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
}

const POSITION_KEYS: Array<{ keys: string[]; position?: Position; bothWings?: boolean }> = [
  { keys: ["goalkeeper", "golman", "keeper", "gk"], position: "GK" },
  { keys: ["centre-back", "center-back", "stoper", "cb"], position: "CB" },
  { keys: ["left-back", "left back", "lijevi bek", "lijevog bek", "lijeva bek", "levi bek", "levog bek", "lb", "lwb"], position: "LB" },
  { keys: ["right-back", "right back", "desni bek", "desnog bek", "desna bek", "rb", "rwb"], position: "RB" },
  { keys: ["defensive midfield", "zadnji vezni", "cdm", "dm"], position: "DM" },
  { keys: ["central midfield", "centralni vezni", "cm"], position: "CM" },
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

function addFullbacks(text: string, add: (code: Position) => void) {
  if (/\b(lijev\w*|lev\w*)\b/.test(text) && /\bbek/.test(text)) add("LB");
  if (/\bdesn\w*\b/.test(text) && /\bbek/.test(text)) add("RB");
}

export function extractPositions(raw: string): Position[] {
  const text = fold(raw);
  const found: Position[] = [];
  const add = (code: Position) => {
    if (!found.includes(code)) found.push(code);
  };

  addFullbacks(text, add);

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

const CLUB_STOP =
  /^(we|the|a|an|our|for|to|looking|need|needs|want|club|team|klub|i|ja|hello|hi|hey|thanks|please|ok|yes|no)$/i;
const CLUB_TRIGGER =
  /\s+(looking\s+for|is\s+looking(?:\s+for)?|are\s+looking(?:\s+for)?|searching\s+for|tražimo|trazimo|we\s+need|needs)\b/i;

export function extractClubName(raw: string): string | undefined {
  const cut = raw.search(CLUB_TRIGGER);
  if (cut <= 0) return undefined;
  const prefix = raw.slice(0, cut).trim().replace(/[,:;.\-–—]+$/g, "").trim();
  if (!prefix || prefix.length > 40 || /[,:;]/.test(prefix)) return undefined;
  const words = prefix.split(/\s+/);
  if (words.length < 1 || words.length > 4) return undefined;
  if (words.some((word) => CLUB_STOP.test(word))) return undefined;
  if (words.length === 1 && words[0].length < 3) return undefined;
  if (/\b(passport|budget|salary|plata|winger|striker|player|igrač|igrac|transfer)\b/i.test(prefix)) {
    return undefined;
  }
  return prefix;
}

const AGE_BAND = "(?:1[6-9]|[2-3][0-9]|40)";

export function extractAgeBounds(raw: string): { minAge?: number; maxAge?: number } {
  const text = fold(raw);
  const range = text.match(new RegExp(`(${AGE_BAND})\\s*(?:-|–|to)\\s*(${AGE_BAND})`));
  if (range) return { minAge: Number(range[1]), maxAge: Number(range[2]) };

  const exclusive = text.match(
    new RegExp(`\\b(?:under|younger than|below|mlad[ií] od|age\\s*<)\\s*(${AGE_BAND})\\b`),
  );
  if (exclusive) return { maxAge: Number(exclusive[1]) - 1 };

  const inclusive = text.match(
    new RegExp(`\\b(?:do|up to|max(?:imum)?(?:\\s+age)?|age\\s*≤|aged?)\\s*(${AGE_BAND})\\b`),
  );
  if (!inclusive) return {};
  const after = text.slice((inclusive.index ?? 0) + inclusive[0].length);
  if (/^\s*(?:[.,]\d{3})?\s*(?:k|m|eura|eur|euro|€)/.test(after)) return {};
  return { maxAge: Number(inclusive[1]) };
}

export function extractMaxAge(raw: string): number | undefined {
  return extractAgeBounds(raw).maxAge;
}

export function extractMinAge(raw: string): number | undefined {
  return extractAgeBounds(raw).minAge;
}

export function parseMoneyToEur(raw: string): number | undefined {
  let t = raw.trim().toLowerCase().replace(/\s+/g, "");
  t = t.replace(/^(€|\$)/, "").replace(/€$/, "");
  t = t.replace(/(eura|euros|euro|eur)$/g, "");
  if (!t) return undefined;

  let unit = 1;
  if (/(million|mio)$/.test(t)) {
    unit = 1_000_000;
    t = t.replace(/(million|mio)$/, "");
  } else if (/k$/.test(t)) {
    unit = 1_000;
    t = t.replace(/k$/, "");
  } else if (/m$/.test(t)) {
    unit = 1_000_000;
    t = t.replace(/m$/, "");
  }

  if (/^\d{1,3}([.,]\d{3})+$/.test(t)) {
    return Math.round(Number(t.replace(/[.,]/g, "")) * unit);
  }
  if (/^\d+[.,]\d+$/.test(t)) {
    return Math.round(Number(t.replace(",", ".")) * unit);
  }
  if (/^\d+$/.test(t)) return Math.round(Number(t) * unit);
  return undefined;
}

type MoneyKind = "salary" | "transfer" | "marketValue";

function classifyMoneyWindow(window: string): MoneyKind | undefined {
  if (/\b(plata|salary|wage|mjese|monthly|per month|p\/m|netto|bruto)\b/.test(window)) return "salary";
  if (/\b(transfer|naknad|fee)\b/.test(window)) return "transfer";
  if (/\b(market value|trzisn|vrijednost|\bmv\b)\b/.test(window)) return "marketValue";
  if (/\bbudget\b/.test(window)) return "transfer";
  return undefined;
}

export function extractMoneyNeeds(raw: string): {
  salaryEur?: number;
  transferEur?: number;
  maxMv?: number;
} {
  const text = fold(raw);
  const amountRe = /(?:€|eur|eura|euro)?\s*(\d{1,3}(?:[.,]\d{3})+|\d+(?:[.,]\d+)?)\s*(m(?:io|illion)?|k|eura|eur|euros?)?/gi;
  const out: { salaryEur?: number; transferEur?: number; maxMv?: number } = {};
  for (const match of text.matchAll(amountRe)) {
    const token = `${match[1]}${match[2] ?? ""}`;
    const amount = parseMoneyToEur(token);
    if (!amount) continue;
    const start = match.index ?? 0;
    const afterAmount = text.slice(start + match[0].length);
    if (/^\s*godin/.test(afterAmount) || /^\s*years?\b/.test(afterAmount)) continue;
    const unit = (match[2] ?? "").toLowerCase();
    const hasCurrency = /[€$]/.test(match[0]) || /^(eura|eur|euros?)$/.test(unit);
    const hasScale = /^(m(?:io|illion)?|k)$/.test(unit);
    const grouped = /[.,]\d{3}/.test(match[1]);
    const bare = Number(match[1]);
    const looksLikeAge =
      !hasCurrency &&
      !hasScale &&
      !grouped &&
      Number.isInteger(bare) &&
      bare >= 16 &&
      bare <= 40;
    if (looksLikeAge) continue;
    const window = `${text.slice(Math.max(0, start - 28), start)} ${text.slice(start, start + match[0].length + 28)}`;
    const kind = classifyMoneyWindow(window);
    if (kind === "salary" && out.salaryEur == null) out.salaryEur = amount;
    if (kind === "transfer" && out.transferEur == null) out.transferEur = amount;
    if (kind === "marketValue" && out.maxMv == null) out.maxMv = amount;
  }
  return out;
}

export function pasteHasRecognizedNeeds(parsed: PasteParse): boolean {
  return Boolean(
    parsed.positions.length ||
      parsed.club ||
      parsed.euPassport ||
      parsed.minAge ||
      parsed.maxAge ||
      parsed.maxMv ||
      parsed.salaryEur ||
      parsed.transferEur ||
      parsed.loan ||
      parsed.wantsFreeAgent ||
      parsed.wantsListedExpiry ||
      parsed.unverifiable.length,
  );
}

export function suggestedCatalogStatus(parsed: PasteParse): CatalogStatus | undefined {
  if (!pasteHasRecognizedNeeds(parsed)) return undefined;
  if (parsed.wantsListedExpiry) return "expiring";
  return "all";
}

export type CatalogFiltersFromPaste = {
  positions: Position[] | "all";
  euOnly: boolean;
  minAge?: number;
  maxAge?: number;
  maxMv: number | "any";
  status?: CatalogStatus;
};

export function catalogFiltersFromPaste(parsed: PasteParse): CatalogFiltersFromPaste {
  return {
    positions: parsed.positions.length ? parsed.positions : "all",
    euOnly: parsed.euPassport,
    minAge: parsed.minAge,
    maxAge: parsed.maxAge,
    maxMv: parsed.maxMv ?? "any",
    status: suggestedCatalogStatus(parsed),
  };
}

export function parseWhatsAppPaste(raw: string): PasteParse {
  const text = fold(raw);
  const found = extractPositions(raw);
  const money = extractMoneyNeeds(raw);
  const age = extractAgeBounds(raw);
  const loan = /\bloan\b|posudba|na posudbu|prestamo/.test(text);
  const wantsFreeAgent =
    /slobodan|slobodni|free\s*agent|bez ugovora|without a club|out of contract/.test(text);
  const wantsListedExpiry = /istice|istek|expir|ending contract|ugovor isti/.test(text);
  const unverifiable: UnverifiableNeed[] = [];
  if (money.salaryEur || /\b(plata|salary|wage)\b/.test(text)) unverifiable.push("salary");
  if (money.transferEur || /\b(transfer|naknad)\b/.test(text)) unverifiable.push("transfer");
  if (loan) unverifiable.push("loan");
  if (wantsFreeAgent) unverifiable.push("confirmedFree");

  const result: PasteParse = {
    euPassport: /\beu\b|eu pasos|eu passport|eu putovnica|eu drzavl/.test(text),
    loan,
    positions: found,
    position: found[0],
    club: extractClubName(raw),
    minAge: age.minAge,
    maxAge: age.maxAge,
    maxMv: money.maxMv,
    salaryEur: money.salaryEur,
    transferEur: money.transferEur,
    wantsFreeAgent,
    wantsListedExpiry,
    unverifiable,
  };
  return result;
}
