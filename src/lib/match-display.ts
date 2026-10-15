import type { Dictionary } from "@/i18n/get-dictionary";
import { formatMarketValue } from "@/lib/format";
import type { MatchFact } from "@/lib/match-brief";

function ageWant(fact: MatchFact, dict: Dictionary): string {
  if (fact.want.startsWith("<=")) {
    return dict.match.requestedMax.replace("{n}", fact.want.slice(2));
  }
  if (fact.want.startsWith(">=")) {
    return dict.match.requestedMin.replace("{n}", fact.want.slice(2));
  }
  return dict.match.requestedRange.replace("{range}", fact.want);
}

function haveLabel(fact: MatchFact, dict: Dictionary, locale: string): string {
  if (fact.key === "age") return dict.match.yearsOld.replace("{n}", fact.have);
  if (fact.key === "marketValue") {
    const value = Number(fact.have);
    return Number.isFinite(value) && value > 0 ? formatMarketValue(value, locale) : fact.have;
  }
  if (fact.key === "eu") return fact.have === "eu" ? dict.filters.euPassport : dict.match.noEu;
  return fact.have;
}

function wantLabel(fact: MatchFact, dict: Dictionary, locale: string): string {
  if (fact.key === "age") return ageWant(fact, dict);
  if (fact.key === "marketValue") {
    const value = Number(fact.want);
    return Number.isFinite(value) ? formatMarketValue(value, locale) : fact.want;
  }
  if (fact.key === "eu") return dict.filters.euPassport;
  return fact.want;
}

export function formatMatchFact(fact: MatchFact, dict: Dictionary, locale: string): string {
  const template =
    fact.status === "unknown" ? dict.match.factUnknown[fact.key] : dict.match.fact[fact.key];
  return template.replace("{have}", haveLabel(fact, dict, locale)).replace("{want}", wantLabel(fact, dict, locale));
}
