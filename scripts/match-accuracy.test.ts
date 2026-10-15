import assert from "node:assert/strict";
import type { Player } from "../src/data/mock-players.ts";
import { queryPlayers } from "../src/data/catalog.ts";
import { searchPathFromFilters } from "../src/lib/list-search.ts";
import { briefFromWhatsApp, scorePlayer } from "../src/lib/match-brief.ts";
import {
  catalogFiltersFromPaste,
  parseWhatsAppPaste,
} from "../src/lib/paste-parser.ts";

function player(over: Partial<Player>): Player {
  return {
    id: "p1",
    name: "Test Player",
    age: 25,
    dateOfBirth: "2001-01-01",
    position: "ST",
    club: null,
    lastClub: "Club",
    league: "League",
    country: "Country",
    nationality: "Bosnia",
    euPassport: true,
    availability: "free",
    contractUntil: null,
    freeSince: "2026-07-01",
    hasSeasonStats: false,
    appearances: 0,
    goals: 0,
    assists: 0,
    minutesPlayed: 0,
    internationalCaps: 0,
    internationalGoals: 0,
    marketValueEur: 1_000_000,
    ...over,
  };
}

const ageRange = parseWhatsAppPaste("Need a ST age 24-30");
assert.equal(ageRange.minAge, 24);
assert.equal(ageRange.maxAge, 30);
assert.equal(catalogFiltersFromPaste(ageRange).minAge, 24);
assert.equal(catalogFiltersFromPaste(ageRange).maxAge, 30);

const under = parseWhatsAppPaste("Need a ST under 28");
assert.equal(under.minAge, undefined);
assert.equal(under.maxAge, 27);

const inclusive = parseWhatsAppPaste("Need a ST do 28 godina");
assert.equal(inclusive.maxAge, 28);
assert.equal(inclusive.minAge, undefined);

const combo = parseWhatsAppPaste("Need a ST under 28, market value up to 1,5m");
assert.equal(combo.maxAge, 27);
assert.equal(combo.maxMv, 1_500_000);
assert.notEqual(combo.maxMv, 28);
assert.equal(combo.salaryEur, undefined);

const eu = parseWhatsAppPaste("Need a ST, EU passport");
assert.equal(eu.euPassport, true);

const briefCombo = briefFromWhatsApp("Need a ST under 28, market value up to 1,5m")!;
assert.equal(briefCombo.maxAge, 27);
assert.equal(briefCombo.minAge, undefined);
assert.equal(briefCombo.maxMv, 1_500_000);

const within = scorePlayer(player({ age: 25, marketValueEur: 1_000_000 }), briefCombo);
assert.equal(within.facts.find((fact) => fact.key === "age")?.status, "met");
assert.equal(within.facts.find((fact) => fact.key === "marketValue")?.status, "met");
assert.equal(within.facts.find((fact) => fact.key === "position")?.status, "met");
assert.equal(within.fit, "strong");
assert.ok(!within.reasons.includes("expiring"));

const tooOld = scorePlayer(player({ age: 29, marketValueEur: 800_000 }), briefCombo);
assert.equal(tooOld.facts.find((fact) => fact.key === "age")?.status, "unmet");
assert.equal(tooOld.fit, "weak");
assert.notEqual(tooOld.fit, "strong");

const overMv = scorePlayer(player({ age: 24, marketValueEur: 1_500_000 }), briefCombo);
assert.equal(overMv.facts.find((fact) => fact.key === "marketValue")?.status, "met");
assert.equal(overMv.fit, "strong");

const justOverMv = scorePlayer(player({ age: 24, marketValueEur: 1_600_000 }), briefCombo);
assert.equal(justOverMv.facts.find((fact) => fact.key === "marketValue")?.status, "unmet");
assert.equal(justOverMv.fit, "weak");

const missingMv = scorePlayer(player({ age: 24, marketValueEur: 0 }), briefCombo);
assert.equal(missingMv.facts.find((fact) => fact.key === "marketValue")?.status, "unknown");
assert.notEqual(missingMv.fit, "strong");

const briefEu = briefFromWhatsApp("Need a ST, EU passport")!;
const noEu = scorePlayer(player({ euPassport: false, age: 22, marketValueEur: 500_000 }), briefEu);
assert.equal(noEu.facts.find((fact) => fact.key === "eu")?.status, "unmet");
assert.notEqual(noEu.fit, "strong");

const youngMin = scorePlayer(player({ age: 17 }), briefFromWhatsApp("Need a ST age 24-30")!);
assert.equal(youngMin.facts.find((fact) => fact.key === "age")?.status, "unmet");
assert.notEqual(youngMin.fit, "strong");

const noAgeBrief = briefFromWhatsApp("Need a ST")!;
assert.equal(noAgeBrief.minAge, undefined);
assert.equal(noAgeBrief.maxAge, undefined);
const seventeen = scorePlayer(player({ age: 17 }), noAgeBrief);
assert.equal(seventeen.facts.find((fact) => fact.key === "age"), undefined);
assert.equal(seventeen.fit, "strong");

const unverifiable = parseWhatsAppPaste(
  "Need a ST on loan, salary 10.000, transfer budget €500k, free agent",
);
assert.deepEqual(unverifiable.unverifiable.sort(), ["confirmedFree", "loan", "salary", "transfer"]);
assert.equal(unverifiable.maxMv, undefined);

const oldListPath = searchPathFromFilters("en", { status: "free", maxAge: 36 });
assert.match(oldListPath, /maxAge=36/);
assert.doesNotMatch(oldListPath, /minAge=/);

const rangePath = searchPathFromFilters("bs", { minAge: 24, maxAge: 30 });
assert.match(rangePath, /minAge=24/);
assert.match(rangePath, /maxAge=30/);

async function main() {
  const live = await queryPlayers({
    status: "all",
    position: "ST",
    euOnly: true,
    maxAge: 27,
    maxMv: "any",
    limit: 80,
  });
  assert.ok(live.total >= live.players.length);
  for (const row of live.players) {
    assert.ok(row.age <= 27, `${row.name} age ${row.age} exceeded maxAge 27`);
    assert.equal(row.position, "ST");
    assert.equal(row.euPassport, true);
  }

  const mvLive = await queryPlayers({
    status: "all",
    position: "ST",
    maxMv: 1_500_000,
    limit: 80,
  });
  for (const row of mvLive.players) {
    assert.ok(row.marketValueEur <= 1_500_000, `${row.name} MV ${row.marketValueEur} over explicit limit`);
  }

  const minLive = await queryPlayers({
    status: "all",
    position: "ST",
    minAge: 24,
    maxAge: 30,
    limit: 80,
  });
  for (const row of minLive.players) {
    assert.ok(row.age >= 24 && row.age <= 30, `${row.name} age ${row.age} outside 24-30`);
  }

  const capped40 = await queryPlayers({
    status: "all",
    position: "ST",
    maxAge: 40,
    limit: 1,
  });
  const uncapped = await queryPlayers({
    status: "all",
    position: "ST",
    limit: 1,
  });
  assert.ok(uncapped.total >= capped40.total);

  console.log("match-accuracy tests passed", {
    stEuUnder28: { loaded: live.players.length, total: live.total },
    stMaxMv: { loaded: mvLive.players.length, total: mvLive.total },
    stAgeRange: { loaded: minLive.players.length, total: minLive.total },
    uncappedVs40: { uncapped: uncapped.total, maxAge40: capped40.total },
  });
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
