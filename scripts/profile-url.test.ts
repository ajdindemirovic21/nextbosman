import assert from "node:assert/strict";
import type { Player } from "../src/data/mock-players.ts";
import { playerHighlightsUrl, playerWhatsAppShare } from "../src/lib/highlights.ts";
import { parseTransfermarktProfileUrl } from "../src/lib/profile-url.ts";
import en from "../src/i18n/dictionaries/en.json" with { type: "json" };

const id = "32467";
const valid = `https://www.transfermarkt.co.uk/ivan-rakitic/profil/spieler/${id}`;

assert.equal(parseTransfermarktProfileUrl(valid, id), valid);
assert.equal(
  parseTransfermarktProfileUrl(`  ${valid}  `, id),
  valid,
);

assert.equal(parseTransfermarktProfileUrl(null, id), null);
assert.equal(parseTransfermarktProfileUrl("", id), null);
assert.equal(parseTransfermarktProfileUrl("not-a-url", id), null);
assert.equal(parseTransfermarktProfileUrl(valid.replace("https://", "http://"), id), null);
assert.equal(parseTransfermarktProfileUrl(valid.replace("www.transfermarkt.co.uk", "www.transfermarkt.de"), id), null);
assert.equal(parseTransfermarktProfileUrl(valid.replace("www.transfermarkt.co.uk", "transfermarkt.co.uk"), id), null);
assert.equal(
  parseTransfermarktProfileUrl(`https://evil.example/www.transfermarkt.co.uk/ivan-rakitic/profil/spieler/${id}`, id),
  null,
);
assert.equal(parseTransfermarktProfileUrl(valid, "999"), null);
assert.equal(parseTransfermarktProfileUrl(`${valid}?utm=1`, id), null);
assert.equal(parseTransfermarktProfileUrl(`${valid}#top`, id), null);
assert.equal(parseTransfermarktProfileUrl(`https://www.transfermarkt.co.uk/profil/spieler/${id}`, id), null);
assert.equal(
  parseTransfermarktProfileUrl("https://www.transfermarkt.co.uk/someone/profil/spieler/32467", "ivan-rakitic"),
  null,
);
assert.equal(
  parseTransfermarktProfileUrl(`https://user:pass@www.transfermarkt.co.uk/ivan-rakitic/profil/spieler/${id}`, id),
  null,
);

function player(over: Partial<Player> = {}): Player {
  return {
    id: "32467",
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
    profileUrl: null,
    marketValueEur: 1_000_000,
    ...over,
  };
}

const youtube = playerHighlightsUrl("Test Player");
assert.match(youtube, /^https:\/\/www\.youtube\.com\/results\?search_query=/);

const withProfile = playerWhatsAppShare(player({ profileUrl: valid }), en, "en");
const withProfileLines = withProfile.split("\n");
assert.equal(withProfileLines[0], valid);
assert.equal(withProfileLines[1], "");
assert.equal(withProfileLines[2], "*Test Player*");
assert.ok(withProfile.includes(en.profile.statsUnavailable));
assert.ok(withProfile.includes(en.status.statusUnconfirmed));
assert.equal(withProfileLines.at(-2), "");
assert.equal(withProfileLines.at(-1), `${en.profile.youtubeSearch}: ${youtube}`);
assert.equal(withProfile.indexOf(valid), 0);
assert.equal(withProfile.indexOf(valid, 1), -1);
assert.ok(!withProfile.includes("📹"));
assert.ok(!withProfile.includes("/en/search"));

const missing = playerWhatsAppShare(player({ profileUrl: null }), en, "en");
assert.equal(missing.split("\n")[0], "*Test Player*");
assert.ok(!missing.includes("transfermarkt.co.uk"));
assert.ok(missing.endsWith(`${en.profile.youtubeSearch}: ${youtube}`));

const invalidKeptOffMessage = playerWhatsAppShare(
  player({ profileUrl: "https://www.transfermarkt.de/test-player/profil/spieler/32467" }),
  en,
  "en",
);
assert.equal(invalidKeptOffMessage.split("\n")[0], "*Test Player*");
assert.ok(!invalidKeptOffMessage.includes("transfermarkt.de"));

const withStats = playerWhatsAppShare(
  player({
    hasSeasonStats: true,
    appearances: 10,
    goals: 4,
    assists: 2,
    profileUrl: valid,
  }),
  en,
  "en",
);
assert.ok(withStats.includes(`${en.profile.matches}: 10`));
assert.ok(!withStats.includes(en.profile.statsUnavailable));

console.log("profile-url tests passed");
