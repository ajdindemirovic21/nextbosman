import assert from "node:assert/strict";
import {
  catalogFiltersFromPaste,
  extractClubName,
  parseMoneyToEur,
  parseWhatsAppPaste,
  pasteHasRecognizedNeeds,
  suggestedCatalogStatus,
} from "../src/lib/paste-parser.ts";
import { briefFromWhatsApp, parseBrief } from "../src/lib/match-brief.ts";

const q1 = "FCSB looking for a ST, EU passport, under 28, free agent.";
const q2 = "Tražimo lijevog ili desnog beka do 25 godina, plata do 10.000 eura mjesečno.";
const q3 = "Need CB and DM on loan, salary covered by parent club.";
const q4 = "Looking for a winger, transfer budget €500k, no nationality restrictions.";

const p1 = parseWhatsAppPaste(q1);
assert.equal(p1.club, "FCSB");
assert.deepEqual(p1.positions, ["ST"]);
assert.equal(p1.euPassport, true);
assert.equal(p1.maxAge, 27);
assert.equal(p1.wantsFreeAgent, true);
assert.equal(p1.maxMv, undefined);
assert.ok(p1.unverifiable.includes("confirmedFree"));
assert.equal(suggestedCatalogStatus(p1), "all");
assert.deepEqual(catalogFiltersFromPaste(p1), {
  positions: ["ST"],
  euOnly: true,
  minAge: undefined,
  maxAge: 27,
  maxMv: "any",
  status: "all",
});
assert.equal(briefFromWhatsApp(q1)?.club, "FCSB");
assert.equal(briefFromWhatsApp(q1)?.maxMv, undefined);
assert.equal(briefFromWhatsApp(q1)?.typicalMv, undefined);
assert.equal(briefFromWhatsApp(q1)?.market, "Romanian SuperLiga");
assert.equal(briefFromWhatsApp(q1)?.suggestedTypicalMv, 2_500_000);

const p2 = parseWhatsAppPaste(q2);
assert.equal(p2.club, undefined);
assert.deepEqual(p2.positions, ["LB", "RB"]);
assert.equal(p2.maxAge, 25);
assert.equal(p2.salaryEur, 10_000);
assert.equal(p2.maxMv, undefined);
assert.equal(p2.transferEur, undefined);
assert.ok(p2.unverifiable.includes("salary"));
assert.equal(suggestedCatalogStatus(p2), "all");
assert.deepEqual(catalogFiltersFromPaste(p2), {
  positions: ["LB", "RB"],
  euOnly: false,
  minAge: undefined,
  maxAge: 25,
  maxMv: "any",
  status: "all",
});

const p3 = parseWhatsAppPaste(q3);
assert.equal(p3.club, undefined);
assert.deepEqual(p3.positions, ["CB", "DM"]);
assert.equal(p3.loan, true);
assert.equal(p3.wantsFreeAgent, false);
assert.ok(p3.unverifiable.includes("loan"));
assert.ok(p3.unverifiable.includes("salary"));
assert.equal(suggestedCatalogStatus(p3), "all");
assert.equal(p3.maxMv, undefined);
assert.deepEqual(catalogFiltersFromPaste(p3), {
  positions: ["CB", "DM"],
  euOnly: false,
  minAge: undefined,
  maxAge: undefined,
  maxMv: "any",
  status: "all",
});

const p4 = parseWhatsAppPaste(q4);
assert.equal(p4.club, undefined);
assert.deepEqual(p4.positions, ["LW", "RW"]);
assert.equal(p4.transferEur, 500_000);
assert.equal(p4.maxMv, undefined);
assert.ok(p4.unverifiable.includes("transfer"));
assert.equal(suggestedCatalogStatus(p4), "all");
assert.deepEqual(catalogFiltersFromPaste(p4), {
  positions: ["LW", "RW"],
  euOnly: false,
  minAge: undefined,
  maxAge: undefined,
  maxMv: "any",
  status: "all",
});

assert.equal(extractClubName("Looking for a winger"), undefined);
assert.equal(extractClubName("Need a ST"), undefined);
assert.equal(extractClubName("We are looking for a ST"), undefined);
assert.equal(extractClubName("Hello looking for a ST"), undefined);

assert.equal(parseWhatsAppPaste("under 28").maxAge, 27);
assert.equal(parseWhatsAppPaste("do 28 godina").maxAge, 28);
assert.equal(parseWhatsAppPaste("do 25 godina").maxAge, 25);
assert.equal(parseWhatsAppPaste("age 24-30").maxAge, 30);
assert.equal(parseWhatsAppPaste("age 24-30").minAge, 24);

assert.equal(parseMoneyToEur("10.000"), 10_000);
assert.equal(parseMoneyToEur("500k"), 500_000);
assert.equal(parseMoneyToEur("1,5m"), 1_500_000);
assert.equal(parseMoneyToEur("1.5m"), 1_500_000);
assert.equal(parseWhatsAppPaste("market value up to 1,5m").maxMv, 1_500_000);
assert.equal(parseWhatsAppPaste("MV up to 1.5m").maxMv, 1_500_000);
assert.equal(parseWhatsAppPaste("transfer fee €1.5m").transferEur, 1_500_000);
assert.equal(parseWhatsAppPaste("transfer fee €1.5m").maxMv, undefined);

const empty = parseWhatsAppPaste("Thanks, we'll talk tomorrow.");
assert.deepEqual(empty.positions, []);
assert.equal(empty.club, undefined);
assert.equal(empty.maxAge, undefined);
assert.equal(empty.euPassport, false);
assert.equal(empty.unverifiable.length, 0);
assert.equal(pasteHasRecognizedNeeds(empty), false);
assert.equal(suggestedCatalogStatus(empty), undefined);
const emptyFilters = catalogFiltersFromPaste(empty);
assert.equal(emptyFilters.positions, "all");
assert.equal(emptyFilters.euOnly, false);
assert.equal(emptyFilters.maxMv, "any");
assert.equal(emptyFilters.status, undefined);

assert.equal(suggestedCatalogStatus(parseWhatsAppPaste("ST, contract expiring")), "expiring");
assert.equal(parseBrief("FCSB looking for a ST")?.typicalMv, undefined);
assert.equal(parseBrief("market value up to 1,5m")?.maxMv, 1_500_000);

const combo = parseWhatsAppPaste("under 28, market value up to 1,5m");
assert.equal(combo.maxAge, 27);
assert.equal(combo.minAge, undefined);
assert.equal(combo.maxMv, 1_500_000);

console.log("paste-parser tests passed");
