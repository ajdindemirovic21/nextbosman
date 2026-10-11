import type { Player, Position } from "@/data/mock-players";
import { extractPositions, parseWhatsAppPaste } from "@/lib/paste-parser";

export type Fit = "strong" | "possible" | "weak";

export type ClubBrief = {
  raw: string;
  club?: string;
  positions: Position[];
  euPassport?: boolean;
  minAge?: number;
  maxAge?: number;
  typicalMv?: number;
  stretchMv?: number;
  maxMv?: number;
  market?: string;
};

export type MatchResult = {
  fit: Fit;
  score: number;
  reasons: string[];
};

const RELATED: Record<Position, Position[]> = {
  GK: [],
  CB: ["DM", "LB", "RB"],
  LB: ["RB", "CB", "LW"],
  RB: ["LB", "CB", "RW"],
  DM: ["CM", "CB"],
  CM: ["DM", "AM"],
  AM: ["CM", "ST", "LW", "RW"],
  LW: ["RW", "AM", "ST", "LB"],
  RW: ["LW", "AM", "ST", "RB"],
  ST: ["AM", "LW", "RW"],
};

const THIRD_TIER =
  /tff\s*2|\b2\.\s*lig\b|third[\s-]*(tier|division)|3(?:rd|\.)\s*(lig|liga|league|div)|tre[cć]a\s*liga|üçüncü|ucuncu/;

const SECOND_TIER =
  /tff\s*1|\b1\.\s*lig\b|second[\s-]*(tier|division|league)|2(?:nd|\.)?\s*(lig|liga|league|div)|drug[aeoj]+\s*lig|ikinci\s*lig|segunda(?!\s*a\b)|championship\b|ligue\s*2|serie\s*b|2\.\s*bundesliga/;

const TR_T1_CLUBS =
  /band[iı]rma|sakarya|ey[uü]p|kocaeli|bodrum|umraniye|boluspor|erzurum|pendik|istanbulspor|manisa|corum|ahlat|amed/;

const TR_ELITE = /galatasaray|fenerbah|be[sş]ikta[sş]|trabzon/;

function inTurkey(text: string) {
  return /turkey|turkish|tursk|turkiye|anadolu|\btff\b|super\s*lig|galatasaray|fenerbah|be[sş]ikta[sş]|trabzon|band[iı]rma|sakarya|kocaeli|kayseri|alanya|konya|sivas|rize|hatay|gaziantep|kasimpasa|basaksehir|samsun|antalya/.test(
    text,
  );
}

type MarketRule = {
  test: (text: string) => boolean;
  market: string;
  typicalMv: number;
  stretchMv: number;
};

const MARKETS: MarketRule[] = [
  {
    test: (t) => inTurkey(t) && THIRD_TIER.test(t),
    market: "TFF 2. Lig",
    typicalMv: 400_000,
    stretchMv: 1_200_000,
  },
  {
    test: (t) =>
      inTurkey(t) &&
      (SECOND_TIER.test(t) || TR_T1_CLUBS.test(t) || /birinci\s*lig|turkish\s*first\s*league/.test(t)),
    market: "TFF 1. Lig",
    typicalMv: 1_200_000,
    stretchMv: 4_000_000,
  },
  {
    test: (t) => inTurkey(t) && TR_ELITE.test(t),
    market: "Süper Lig (big clubs)",
    typicalMv: 12_000_000,
    stretchMv: 28_000_000,
  },
  {
    test: (t) => inTurkey(t) && /super\s*lig/.test(t),
    market: "Süper Lig",
    typicalMv: 4_500_000,
    stretchMv: 12_000_000,
  },
  {
    test: (t) => inTurkey(t),
    market: "Turkey",
    typicalMv: 3_000_000,
    stretchMv: 10_000_000,
  },
  {
    test: (t) => /thailand|thai|buriram|bangkok|muangthong|pathum/.test(t),
    market: "Thai League 1",
    typicalMv: 1_800_000,
    stretchMv: 5_000_000,
  },
  {
    test: (t) => /romania|superliga|fcsb|dinamo|cluj|hermanstadt/.test(t),
    market: "Romanian SuperLiga",
    typicalMv: 2_500_000,
    stretchMv: 7_000_000,
  },
  {
    test: (t) => /saudi|hilal|nassr|ittihad/.test(t),
    market: "Saudi Pro League",
    typicalMv: 12_000_000,
    stretchMv: 40_000_000,
  },
  {
    test: (t) => /japan|j1|j-league|j league/.test(t),
    market: "J1 League",
    typicalMv: 3_000_000,
    stretchMv: 8_000_000,
  },
  {
    test: (t) => /korea|k league|ulsan/.test(t),
    market: "K League 1",
    typicalMv: 2_500_000,
    stretchMv: 7_000_000,
  },
  {
    test: (t) => /bosnia|bih|premijer|sarajevo|zeljeznicar|zeljeznicar/.test(t),
    market: "Bosnian Premier",
    typicalMv: 400_000,
    stretchMv: 1_200_000,
  },
  {
    test: (t) => /croatia|hrvatsk|hnl|hajduk|dinamo zagreb/.test(t) && SECOND_TIER.test(t),
    market: "Prva NL",
    typicalMv: 400_000,
    stretchMv: 1_200_000,
  },
  {
    test: (t) => /greece|super league 2|superleague 2/.test(t) && SECOND_TIER.test(t),
    market: "Super League 2",
    typicalMv: 400_000,
    stretchMv: 1_200_000,
  },
  {
    test: (t) => THIRD_TIER.test(t),
    market: "Third tier",
    typicalMv: 350_000,
    stretchMv: 1_000_000,
  },
  {
    test: (t) => SECOND_TIER.test(t),
    market: "Second tier",
    typicalMv: 1_000_000,
    stretchMv: 3_500_000,
  },
];

function parseExplicitMaxMv(text: string): number | undefined {
  const named = text.match(
    /(?:max(?:imum)?|up to|until|ceiling|do)\s*(?:mv|value|market(?:\s*value)?)?\s*[€$]?\s*(\d+(?:[.,]\d+)?)\s*(m(?:io|illion)?|k)?/i,
  );
  const plain = text.match(/[€$]\s*(\d+(?:[.,]\d+)?)\s*(m(?:io|illion)?|k)\b/i);
  const hit = named ?? plain;
  if (!hit) return undefined;
  const amount = Number(hit[1].replace(",", "."));
  const unit = (hit[2] || "").toLowerCase();
  if (unit.startsWith("m")) return Math.round(amount * 1_000_000);
  if (unit === "k") return Math.round(amount * 1_000);
  if (amount >= 1000) return Math.round(amount);
  return undefined;
}

export function parseBrief(raw: string): ClubBrief | null {
  const text = raw.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (!text) return null;

  const brief: ClubBrief = { raw: raw.trim(), positions: extractPositions(raw) };

  if (/\beu passport\b|\beu\b|pasos|putovnica/.test(text)) {
    brief.euPassport = true;
  }

  const ageRange = text.match(/(\d{2})\s*(?:-|–|to)\s*(\d{2})/);
  if (ageRange) {
    brief.minAge = Number(ageRange[1]);
    brief.maxAge = Number(ageRange[2]);
  } else {
    const maxAge = text.match(/under\s*(\d{2})|max(?:imum)?\s*age\s*(\d{2})|age\s*[≤<]\s*(\d{2})/);
    if (maxAge) {
      brief.maxAge = Number(maxAge[1] ?? maxAge[2] ?? maxAge[3]);
    }
  }

  const firstLine = raw.trim().split("\n")[0]?.replace(/[^a-zA-Z0-9 .'-]/g, " ").trim();
  if (firstLine && firstLine.length > 2) brief.club = firstLine;

  for (const market of MARKETS) {
    if (market.test(text)) {
      brief.market = market.market;
      brief.typicalMv = market.typicalMv;
      brief.stretchMv = market.stretchMv;
      brief.maxMv = market.stretchMv;
      break;
    }
  }

  const explicit = parseExplicitMaxMv(text);
  if (explicit) {
    brief.typicalMv = explicit;
    brief.stretchMv = explicit;
    brief.maxMv = explicit;
  }

  return brief;
}

export function briefFromWhatsApp(raw: string): ClubBrief | null {
  const brief = parseBrief(raw);
  if (!brief) return null;
  const paste = parseWhatsAppPaste(raw);
  if (paste.positions.length) brief.positions = paste.positions;
  if (paste.euPassport) brief.euPassport = true;
  return brief;
}

/** Highest MV this player might still accept for this brief — not a club budget cap. */
export function moveCeiling(player: Player, brief: ClubBrief): number | null {
  const typical = brief.typicalMv;
  const stretch = brief.stretchMv ?? brief.maxMv;
  if (!typical || !stretch) return stretch ?? null;

  let cap = typical;
  cap *= player.availability === "free" ? 2.1 : 1.2;
  if (player.age >= 30) cap *= 1.3;
  if (player.age >= 33) cap *= 1.2;
  if (player.age <= 23) cap *= 0.5;
  else if (player.age <= 26) cap *= 0.7;
  return Math.min(Math.round(cap), stretch);
}

export function isUnrealistic(player: Player, brief: ClubBrief): boolean {
  const ceiling = moveCeiling(player, brief);
  return Boolean(ceiling && player.marketValueEur > ceiling);
}

export function scorePlayer(player: Player, brief: ClubBrief): MatchResult {
  let score = 42;
  const reasons: string[] = [];
  let ceilingFit: Fit | null = null;

  if (brief.positions.length > 0) {
    if (brief.positions.includes(player.position)) {
      score += 26;
      reasons.push("position");
    } else if (brief.positions.some((pos) => RELATED[pos].includes(player.position))) {
      score += 8;
      reasons.push("positionClose");
    } else {
      score -= 26;
      reasons.push("positionMiss");
    }
  }

  if (brief.minAge != null || brief.maxAge != null) {
    const minAge = brief.minAge ?? 18;
    const maxAge = brief.maxAge ?? 40;
    if (player.age >= minAge && player.age <= maxAge) {
      score += 10;
      reasons.push("age");
    } else {
      score -= 18;
      reasons.push("ageOff");
    }
  }

  const ceiling = moveCeiling(player, brief);
  if (ceiling) {
    const ratio = player.marketValueEur / ceiling;
    if (ratio > 1) {
      score -= 55;
      reasons.push("levelUnrealistic");
      ceilingFit = "weak";
    } else if (ratio > 0.68) {
      score -= 10;
      reasons.push("levelHigh");
      ceilingFit = "possible";
    } else {
      score += 20;
      reasons.push("level");
    }
  }

  if (brief.euPassport) {
    if (player.euPassport) {
      score += 10;
      reasons.push("eu");
    } else {
      score -= 22;
      reasons.push("euMiss");
    }
  }

  if (player.availability === "expiring") {
    reasons.push("expiring");
  }

  score = Math.max(0, Math.min(100, score));
  let fit: Fit = score >= 72 ? "strong" : score >= 50 ? "possible" : "weak";
  if (ceilingFit === "weak") fit = "weak";
  if (ceilingFit === "possible" && fit === "strong") fit = "possible";
  return { fit, score, reasons };
}
