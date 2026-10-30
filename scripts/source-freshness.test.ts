import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import type { Player } from "../src/data/mock-players.ts";
import { snapshotFromListing, type ListingProfile } from "../src/lib/auto-refresh.ts";
import {
  contractShareLine,
  sourceFreshnessItems,
} from "../src/lib/contract-display.ts";
import { formatDate } from "../src/lib/format.ts";
import { playerWhatsAppShare } from "../src/lib/highlights.ts";
import { applyPlayerLayers, type ManualReviewPublic } from "../src/lib/player-review.ts";
import { locales } from "../src/i18n/config.ts";
import en from "../src/i18n/dictionaries/en.json" with { type: "json" };
import bs from "../src/i18n/dictionaries/bs.json" with { type: "json" };
import de from "../src/i18n/dictionaries/de.json" with { type: "json" };
import es from "../src/i18n/dictionaries/es.json" with { type: "json" };
import fr from "../src/i18n/dictionaries/fr.json" with { type: "json" };
import hr from "../src/i18n/dictionaries/hr.json" with { type: "json" };
import it from "../src/i18n/dictionaries/it.json" with { type: "json" };
import pt from "../src/i18n/dictionaries/pt.json" with { type: "json" };
import tr from "../src/i18n/dictionaries/tr.json" with { type: "json" };

const dicts = { en, es, de, fr, pt, tr, it, bs, hr } as const;
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

const statusKeys = Object.keys(en.status).sort().join(",");
for (const locale of locales) {
  assert.equal(Object.keys(dicts[locale].status).sort().join(","), statusKeys, locale);
  assert.match(dicts[locale].footer.live, /catalog|katalog|Katalog|catálogo|catalogue|catalogo/i);
  assert.doesNotMatch(dicts[locale].table.sampleNote, /live database|živa baza|Live-Datenbank|base en vivo|base en direct|base ao vivo|canlı veritabanı|database live/i);
}

const csv = applyPlayerLayers(
  catalogPlayer({ id: "99", availability: "free", name: "CSV Player" }),
  null,
  null,
  TODAY,
);
assert.deepEqual(sourceFreshnessItems(csv, en, "en", false), []);
assert.deepEqual(sourceFreshnessItems(csv, en, "en", true), [{ text: en.status.catalogSourceUnknown }]);
assert.doesNotMatch(contractShareLine(csv, en, "en"), /Fetched |Manually checked /);
assert.doesNotMatch(playerWhatsAppShare(csv, en, "en"), /Fetched |Manually checked /);
assert.ok(!sourceFreshnessItems(csv, en, "en", true)[0]?.text.includes("2026-10-27"));
assert.ok(!sourceFreshnessItems(csv, en, "en", true)[0]?.text.includes(formatDate("2026-10-27")));

const fekir = loadFixture("203496-fekir.json");
const fekirSnap = snapshotFromListing(fekir, fekir.fetched_at_utc!);
assert.ok(fekirSnap);
const auto = applyPlayerLayers(
  catalogPlayer({ id: "203496", name: "Nabil Fekir", availability: "free" }),
  null,
  fekirSnap,
  TODAY,
);
const fetched = en.status.autoFetchedOn.replace("{date}", formatDate(fekirSnap.fetchedAt, "en"));
assert.deepEqual(sourceFreshnessItems(auto, en, "en", false), [{ text: fetched }]);
const autoDetail = sourceFreshnessItems(auto, en, "en", true);
assert.equal(autoDetail[0]?.text, fetched);
assert.equal(autoDetail[1]?.text, en.status.autoFetchedNote);
assert.ok(!autoDetail.some((item) => item.text === en.status.autoSource));
assert.match(contractShareLine(auto, en, "en"), new RegExp(fetched.replaceAll(".", "\\.")));
assert.match(playerWhatsAppShare(auto, en, "en"), /Abha Club/);
assert.match(playerWhatsAppShare(auto, en, "en"), new RegExp(fetched.replaceAll(".", "\\.")));
assert.doesNotMatch(playerWhatsAppShare(auto, en, "en"), /Manually checked /);

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
const manual = applyPlayerLayers(
  catalogPlayer({ id: "203496", availability: "free", lastClub: "Real Betis Balompié" }),
  review,
  fekirSnap,
  TODAY,
);
const checked = en.status.manualCheckBadge.replace("{date}", formatDate(review.checkedAt, "en"));
assert.deepEqual(sourceFreshnessItems(manual, en, "en", false), [{ text: checked }]);
const manualDetail = sourceFreshnessItems(manual, en, "en", true);
assert.equal(manualDetail[0]?.text, checked);
assert.equal(manualDetail[1]?.href, "https://example.com/check");
assert.equal(manualDetail[2]?.text, "Manual wins");
assert.ok(!manualDetail.some((item) => item.text === fetched));
assert.match(contractShareLine(manual, en, "en"), new RegExp(checked.replaceAll(".", "\\.")));
assert.match(contractShareLine(manual, en, "en"), /https:\/\/example\.com\/check/);
assert.doesNotMatch(contractShareLine(manual, en, "en"), new RegExp(fetched.replaceAll(".", "\\.")));
assert.match(playerWhatsAppShare(manual, en, "en"), new RegExp(checked.replaceAll(".", "\\.")));
assert.match(playerWhatsAppShare(manual, en, "en"), /https:\/\/example\.com\/check/);

console.log("source freshness checks passed (synthetic fixtures, no network)");
