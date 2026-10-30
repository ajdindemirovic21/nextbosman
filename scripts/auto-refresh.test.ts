import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import type { Player } from "../src/data/mock-players.ts";
import { queryPlayersFromJson } from "../src/data/catalog.ts";
import {
  applyFetchFailure,
  applyFetchSuccess,
  autoFilterBucket,
  effectiveClubFromAuto,
  effectiveContractFromAuto,
  isConfirmedWithoutClub,
  isRetiredListing,
  snapshotFromListing,
  type ListingProfile,
} from "../src/lib/auto-refresh.ts";
import { AUTO_REFRESH_FETCH_ENABLED } from "../src/lib/auto-refresh-adapter.ts";
import { playerFromSearchHit, searchHitFromPlayer } from "../src/lib/catalog-search.ts";
import { contractNote, contractPrimary, formatListedClub, overlayStatusLines } from "../src/lib/contract-display.ts";
import { contractAccent } from "../src/lib/player-ui.ts";
import {
  applyPlayerLayers,
  effectiveClub,
  effectiveContract,
  filterBucketFor,
  matchesCatalogStatus,
  type ManualReviewPublic,
} from "../src/lib/player-review.ts";
import en from "../src/i18n/dictionaries/en.json" with { type: "json" };

const TODAY = "2026-10-27";
const fixtureDir = path.join("scripts", "fixtures", "auto-refresh");

function loadFixture(name: string): ListingProfile {
  return JSON.parse(fs.readFileSync(path.join(fixtureDir, name), "utf8")) as ListingProfile;
}

function catalogPlayer(partial: Partial<Player> & Pick<Player, "id" | "availability">): Player {
  return {
    name: partial.name ?? "Test",
    age: 28,
    dateOfBirth: "1998-01-01",
    position: "ST",
    club: null,
    lastClub: "CSV Club",
    league: "",
    country: "",
    nationality: "Bosnia",
    euPassport: false,
    contractUntil: null,
    freeSince: "2026-06-30",
    hasSeasonStats: false,
    appearances: 0,
    goals: 0,
    assists: 0,
    minutesPlayed: 0,
    internationalCaps: 0,
    internationalGoals: 0,
    marketValueEur: 1000,
    profileUrl: `https://www.transfermarkt.com/x/profil/spieler/${partial.id}`,
    ...partial,
  };
}

assert.equal(AUTO_REFRESH_FETCH_ENABLED, false);

const fekir = loadFixture("203496-fekir.json");
const marmol = loadFixture("617060-marmol.json");
const heaton = loadFixture("34130-heaton.json");
const zinchenko = loadFixture("203853-zinchenko.json");
const young = loadFixture("14086-young.json");

const fekirSnap = snapshotFromListing(fekir, fekir.fetched_at_utc!);
const marmolSnap = snapshotFromListing(marmol, marmol.fetched_at_utc!);
const heatonSnap = snapshotFromListing(heaton, heaton.fetched_at_utc!);
const zinchenkoSnap = snapshotFromListing(zinchenko, zinchenko.fetched_at_utc!);
const youngSnap = snapshotFromListing(young, young.fetched_at_utc!);

assert.ok(fekirSnap && marmolSnap && heatonSnap && zinchenkoSnap && youngSnap);

assert.equal(fekirSnap.clubName, "Abha Club");
assert.equal(fekirSnap.contractExpires, null);
assert.equal(autoFilterBucket(fekirSnap, TODAY), "other");
assert.deepEqual(effectiveClubFromAuto(fekirSnap), { kind: "current", name: "Abha Club" });
assert.deepEqual(effectiveContractFromAuto(fekirSnap), { kind: "unknown" });

const fekirPlayer = applyPlayerLayers(
  catalogPlayer({
    id: "203496",
    name: "Nabil Fekir",
    availability: "free",
    freeSince: "2026-06-30",
  }),
  null,
  fekirSnap,
  TODAY,
);
assert.equal(fekirPlayer.filterBucket, "other");
assert.equal(matchesCatalogStatus(fekirPlayer.filterBucket!, "free"), false);
assert.equal(matchesCatalogStatus(fekirPlayer.filterBucket!, "expiring"), false);
assert.deepEqual(effectiveClub(fekirPlayer, null), { kind: "current", name: "Abha Club" });
assert.deepEqual(effectiveContract(fekirPlayer, null), { kind: "unknown" });
assert.equal(formatListedClub(fekirPlayer, en), "Abha Club");
assert.equal(formatListedClub(playerFromSearchHit(searchHitFromPlayer(fekirPlayer)), en), "Abha Club");
assert.equal(contractPrimary(fekirPlayer, en, "en"), en.status.autoContractUnknown);
assert.equal(contractAccent(fekirPlayer), null);

assert.equal(autoFilterBucket(marmolSnap, TODAY), "other");
assert.equal(marmolSnap.contractExpires, "2030-06-30");
const marmolPlayer = applyPlayerLayers(
  catalogPlayer({ id: "617060", name: "Mika Mármol", availability: "free" }),
  null,
  marmolSnap,
  TODAY,
);
assert.equal(marmolPlayer.filterBucket, "other");
assert.equal(matchesCatalogStatus(marmolPlayer.filterBucket!, "expiring"), false);
assert.equal(matchesCatalogStatus(marmolPlayer.filterBucket!, "free"), false);

assert.equal(autoFilterBucket(heatonSnap, TODAY), "expiring");
const heatonPlayer = applyPlayerLayers(
  catalogPlayer({
    id: "34130",
    name: "Tom Heaton",
    club: "Manchester United",
    lastClub: "Manchester United",
    availability: "expiring",
    contractUntil: "2027-06-30",
    freeSince: null,
  }),
  null,
  heatonSnap,
  TODAY,
);
assert.equal(heatonPlayer.filterBucket, "expiring");
assert.equal(matchesCatalogStatus(heatonPlayer.filterBucket!, "expiring"), true);

assert.equal(isConfirmedWithoutClub(zinchenkoSnap), true);
assert.equal(autoFilterBucket(zinchenkoSnap, TODAY), "no_club");
const zinchenkoPlayer = applyPlayerLayers(
  catalogPlayer({ id: "203853", name: "Oleksandr Zinchenko", availability: "free" }),
  null,
  zinchenkoSnap,
  TODAY,
);
assert.equal(zinchenkoPlayer.filterBucket, "no_club");
assert.equal(matchesCatalogStatus(zinchenkoPlayer.filterBucket!, "free"), false);
assert.equal(matchesCatalogStatus(zinchenkoPlayer.filterBucket!, "no_club"), true);
assert.equal(formatListedClub(zinchenkoPlayer, en), en.status.withoutClubListed);
assert.equal(formatListedClub(playerFromSearchHit(searchHitFromPlayer(zinchenkoPlayer)), en), en.status.withoutClubListed);
assert.equal(contractNote(zinchenkoPlayer, en), en.status.withoutClubNotFree);
assert.ok(overlayStatusLines(zinchenkoPlayer, en, "en").some((line) => line.startsWith("Fetched ")));
assert.equal(overlayStatusLines(zinchenkoPlayer, en, "en").includes(en.status.withoutClubNotFree), false);
assert.equal(overlayStatusLines(zinchenkoPlayer, en, "en").includes(en.status.autoSource), false);

assert.equal(isRetiredListing(youngSnap), true);
assert.equal(autoFilterBucket(youngSnap, TODAY), "other");
const youngPlayer = applyPlayerLayers(
  catalogPlayer({ id: "14086", name: "Ashley Young", availability: "free" }),
  null,
  youngSnap,
  TODAY,
);
assert.equal(youngPlayer.filterBucket, "other");
assert.equal(matchesCatalogStatus(youngPlayer.filterBucket!, "free"), false);
assert.equal(matchesCatalogStatus(youngPlayer.filterBucket!, "expiring"), false);
assert.equal(formatListedClub(youngPlayer, en), en.status.retiredLabel);
assert.equal(formatListedClub(playerFromSearchHit(searchHitFromPlayer(youngPlayer)), en), en.status.retiredLabel);

const success = applyFetchSuccess(fekir, fekir.fetched_at_utc!);
const failed = applyFetchFailure(success, "429", "2026-10-27T12:00:00.000Z");
assert.equal(failed.snapshot?.fetchedAt, success.snapshot?.fetchedAt);
assert.equal(failed.snapshot?.clubName, "Abha Club");
assert.equal(failed.lastError, "429");
assert.equal(failed.lastErrorAt, "2026-10-27T12:00:00.000Z");

const review: ManualReviewPublic = {
  checkStatus: "no_club",
  clubMode: "none",
  clubValue: null,
  contractMode: "unknown",
  contractValue: null,
  sourceUrl: "https://example.com/check",
  checkedAt: "2026-10-26T12:00:00.000Z",
  eventAt: null,
  publicNote: "Manual wins",
};
const manualWins = applyPlayerLayers(
  catalogPlayer({ id: "203496", availability: "free", club: null, lastClub: "Real Betis Balompié" }),
  review,
  fekirSnap,
  TODAY,
);
assert.equal(manualWins.filterBucket, "no_club");
assert.deepEqual(effectiveClub(manualWins, review), { kind: "none" });
assert.equal(formatListedClub(manualWins, en), en.status.noClubLabel);
assert.equal(formatListedClub(playerFromSearchHit(searchHitFromPlayer(manualWins)), en), en.status.noClubLabel);
assert.equal(filterBucketFor(manualWins, review, TODAY), "no_club");

const layered = [fekirPlayer, marmolPlayer, heatonPlayer, zinchenkoPlayer, youngPlayer];
const freePage = queryPlayersFromJson({ status: "free" }, layered);
assert.equal(freePage.total, 0);
const expiringPage = queryPlayersFromJson({ status: "expiring" }, layered);
assert.equal(expiringPage.total, 1);
assert.equal(expiringPage.players[0].id, "34130");
const noClubPage = queryPlayersFromJson({ status: "no_club" }, layered);
assert.equal(noClubPage.total, 1);
assert.equal(noClubPage.players[0].id, "203853");

const batch = spawnSync(process.execPath, ["scripts/auto-refresh-batch.mjs", "--ids", "203496"], {
  encoding: "utf8",
  env: { ...process.env, AUTO_REFRESH_LIVE: "1" },
});
assert.equal(batch.status, 2);
assert.match(batch.stderr, /disabled|not wired/i);

console.log("auto-refresh overlay checks passed (fixtures only, no network)");
