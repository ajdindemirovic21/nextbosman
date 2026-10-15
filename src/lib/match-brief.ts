import type { Player, Position } from "@/data/mock-players";
import { extractAgeBounds, extractClubName, extractMoneyNeeds, extractPositions, parseWhatsAppPaste } from "@/lib/paste-parser";

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
  suggestedTypicalMv?: number;
  suggestedStretchMv?: number;
};

export type ConditionStatus = "met" | "unmet" | "unknown";

export type MatchFact = {
  key: "position" | "age" | "eu" | "marketValue";
  status: ConditionStatus;
  have: string;
  want: string;
};

export type MatchResult = {
  fit: Fit;
  score: number;
  facts: MatchFact[];
  reasons: string[];
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

export function parseBrief(raw: string): ClubBrief | null {
  const text = raw.trim().toLowerCase().normalize("NFD").replace(/\p{M}/gu, "");
  if (!text) return null;

  const brief: ClubBrief = { raw: raw.trim(), positions: extractPositions(raw) };
  const club = extractClubName(raw);
  if (club) brief.club = club;

  if (/\beu passport\b|\beu\b|pasos|putovnica/.test(text)) {
    brief.euPassport = true;
  }

  const age = extractAgeBounds(raw);
  if (age.minAge) brief.minAge = age.minAge;
  if (age.maxAge) brief.maxAge = age.maxAge;

  for (const market of MARKETS) {
    if (market.test(text)) {
      brief.market = market.market;
      brief.suggestedTypicalMv = market.typicalMv;
      brief.suggestedStretchMv = market.stretchMv;
      break;
    }
  }

  const explicitMv = extractMoneyNeeds(raw).maxMv;
  if (explicitMv) {
    brief.typicalMv = explicitMv;
    brief.stretchMv = explicitMv;
    brief.maxMv = explicitMv;
  }

  return brief;
}

export function briefFromWhatsApp(raw: string): ClubBrief | null {
  const brief = parseBrief(raw);
  if (!brief) return null;
  const paste = parseWhatsAppPaste(raw);
  if (paste.positions.length) brief.positions = paste.positions;
  if (paste.euPassport) brief.euPassport = true;
  if (paste.club) brief.club = paste.club;
  else delete brief.club;
  if (paste.minAge) brief.minAge = paste.minAge;
  else delete brief.minAge;
  if (paste.maxAge) brief.maxAge = paste.maxAge;
  else delete brief.maxAge;
  if (paste.maxMv) {
    brief.maxMv = paste.maxMv;
    brief.typicalMv = paste.maxMv;
    brief.stretchMv = paste.maxMv;
  }
  return brief;
}

export function requestedAgeLabel(brief: ClubBrief): string {
  if (brief.minAge != null && brief.maxAge != null) return `${brief.minAge}–${brief.maxAge}`;
  if (brief.maxAge != null) return `<=${brief.maxAge}`;
  if (brief.minAge != null) return `>=${brief.minAge}`;
  return "";
}

export function scorePlayer(player: Player, brief: ClubBrief): MatchResult {
  const facts: MatchFact[] = [];

  if (brief.positions.length > 0) {
    const want = brief.positions.join("/");
    const have = player.position || "";
    facts.push({
      key: "position",
      status: have && brief.positions.includes(player.position) ? "met" : have ? "unmet" : "unknown",
      have,
      want,
    });
  }

  if (brief.minAge != null || brief.maxAge != null) {
    const want = requestedAgeLabel(brief);
    if (!player.age && player.age !== 0) {
      facts.push({ key: "age", status: "unknown", have: "", want });
    } else {
      const minOk = brief.minAge == null || player.age >= brief.minAge;
      const maxOk = brief.maxAge == null || player.age <= brief.maxAge;
      facts.push({
        key: "age",
        status: minOk && maxOk ? "met" : "unmet",
        have: String(player.age),
        want,
      });
    }
  }

  if (brief.maxMv) {
    const want = String(brief.maxMv);
    if (!player.marketValueEur) {
      facts.push({ key: "marketValue", status: "unknown", have: "", want });
    } else {
      facts.push({
        key: "marketValue",
        status: player.marketValueEur <= brief.maxMv ? "met" : "unmet",
        have: String(player.marketValueEur),
        want,
      });
    }
  }

  if (brief.euPassport) {
    facts.push({
      key: "eu",
      status: player.euPassport ? "met" : "unmet",
      have: player.euPassport ? "eu" : "none",
      want: "eu",
    });
  }

  const unmet = facts.filter((fact) => fact.status === "unmet").length;
  const unknown = facts.filter((fact) => fact.status === "unknown").length;
  const met = facts.filter((fact) => fact.status === "met").length;
  let fit: Fit = "possible";
  if (unmet > 0) fit = "weak";
  else if (facts.length > 0 && unknown === 0) fit = "strong";

  const score = Math.max(0, 100 - unmet * 40 - unknown * 15 + met);
  return {
    fit,
    score,
    facts,
    reasons: facts.map((fact) => `${fact.key}:${fact.status}`),
  };
}
