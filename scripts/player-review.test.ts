import assert from "node:assert/strict";
import type { Player } from "../src/data/mock-players.ts";
import { queryPlayersFromJson } from "../src/data/catalog.ts";
import { formatListedClub } from "../src/lib/contract-display.ts";
import {
  applyManualReview,
  effectiveClub,
  filterBucketFor,
  matchesCatalogStatus,
  parseManualReviewRow,
  revisionHeadsMatch,
  validateReviewDraft,
  type ManualReviewPublic,
} from "../src/lib/player-review.ts";
import { parsePublicSourceUrl } from "../src/lib/public-source-url.ts";
import { toPlainText } from "../src/lib/plain-text.ts";
import en from "../src/i18n/dictionaries/en.json" with { type: "json" };

const dict = en;

const listed: Player = {
  id: "99",
  name: "Test",
  age: 24,
  dateOfBirth: "2002-01-01",
  position: "ST",
  club: null,
  lastClub: "Old FC",
  league: "",
  country: "",
  nationality: "Bosnia",
  euPassport: false,
  availability: "free",
  contractUntil: null,
  freeSince: "2024-01-01",
  hasSeasonStats: false,
  appearances: 0,
  goals: 0,
  assists: 0,
  minutesPlayed: 0,
  internationalCaps: 0,
  internationalGoals: 0,
  marketValueEur: 1000,
  profileUrl: null,
};

const noClub: ManualReviewPublic = {
  checkStatus: "no_club",
  clubMode: "none",
  clubValue: null,
  contractMode: "unknown",
  contractValue: null,
  sourceUrl: "https://example.com/club",
  checkedAt: "2026-10-01T12:00:00.000Z",
  eventAt: null,
  publicNote: "Plain note",
};

assert.equal(filterBucketFor(listed, null), "free");
assert.equal(filterBucketFor(listed, noClub), "no_club");
assert.equal(matchesCatalogStatus("no_club", "free"), false);
assert.equal(matchesCatalogStatus("free", "no_club"), false);
assert.equal(matchesCatalogStatus("no_club", "no_club"), true);
assert.deepEqual(effectiveClub(listed, noClub), { kind: "none" });
assert.equal(formatListedClub(applyManualReview(listed, noClub), dict), dict.status.noClubLabel);
assert.notEqual(formatListedClub(applyManualReview(listed, noClub), dict), "Old FC");

const under: ManualReviewPublic = {
  ...noClub,
  checkStatus: "under_contract",
  clubMode: "set",
  clubValue: "New FC",
  contractMode: "set",
  contractValue: "2027-10-16",
};
assert.equal(filterBucketFor(listed, under, "2026-10-16"), "expiring");
assert.equal(filterBucketFor(listed, { ...under, contractValue: "2027-10-17" }, "2026-10-16"), "other");
assert.equal(filterBucketFor(listed, { ...under, contractValue: "2026-10-16" }, "2026-10-16"), "other");

const unknown: ManualReviewPublic = { ...noClub, checkStatus: "unknown", clubMode: "unknown" };
assert.equal(filterBucketFor(listed, unknown), "other");
assert.equal(matchesCatalogStatus("other", "free"), false);
assert.equal(matchesCatalogStatus("other", "all"), true);

assert.equal(revisionHeadsMatch(null, null), true);
assert.equal(revisionHeadsMatch(null, undefined), true);
assert.equal(revisionHeadsMatch("aaa", "aaa"), true);
assert.equal(revisionHeadsMatch("aaa", "bbb"), false);
assert.equal(revisionHeadsMatch("aaa", null), false);

assert.equal(parsePublicSourceUrl("http://example.com"), null);
assert.equal(parsePublicSourceUrl("https://localhost/x"), null);
assert.equal(parsePublicSourceUrl("https://example.com/path"), "https://example.com/path");
assert.equal(toPlainText("<b>Hi</b>  there"), "Hi there");

const parsed = parseManualReviewRow({
  active: true,
  check_status: "no_club",
  club_mode: "keep",
  club_value: "Old FC",
  contract_mode: "unknown",
  contract_value: null,
  source_url: "https://example.com/a",
  checked_at: "2026-10-01T00:00:00Z",
  event_at: null,
  public_note: "<script>x</script>Visible",
});
assert.equal(parsed?.clubMode, "none");
assert.equal(parsed?.clubValue, null);
assert.equal(parsed?.publicNote.includes("<"), false);

assert.equal(
  validateReviewDraft(
    {
      checkStatus: "no_club",
      clubMode: "none",
      clubValue: "",
      contractMode: "unknown",
      contractValue: "",
      sourceUrl: "https://example.com/a",
      eventAt: "",
      publicNote: "",
      privateNote: "",
    },
    listed,
  ),
  null,
);
assert.equal(
  validateReviewDraft(
    {
      checkStatus: "under_contract",
      clubMode: "keep",
      clubValue: "",
      contractMode: "keep",
      contractValue: "",
      sourceUrl: "https://example.com/a",
      eventAt: "",
      publicNote: "",
      privateNote: "",
    },
    listed,
  ),
  "clubValue",
);

const jsonNoClub = queryPlayersFromJson({ status: "no_club", page: 1 });
assert.equal(jsonNoClub.catalogLimited, true);
assert.equal(jsonNoClub.players.length, 0);
assert.equal(jsonNoClub.total, 0);
const jsonFree = queryPlayersFromJson({ status: "free", page: 1 });
assert.ok(jsonFree.total >= jsonFree.players.length);
assert.equal(jsonFree.catalogLimited, true);
for (const player of jsonFree.players) {
  assert.equal(player.manualReview, null);
  assert.notEqual(player.filterBucket, "no_club");
  assert.notEqual(player.availability, "no_club");
}
const jsonAll = queryPlayersFromJson({ status: "all", page: 1 });
for (const player of jsonAll.players) {
  assert.equal(player.manualReview, null);
  assert.notEqual(player.filterBucket, "no_club");
}

console.log("player-review tests passed");
