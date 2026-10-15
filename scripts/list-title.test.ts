import assert from "node:assert/strict";
import { formatListOption, recognizedClubName, suggestedListFields } from "../src/lib/list-title.ts";

const labels = {
  ageUpTo: "up to {age}",
  ageFrom: "from {age}",
  ageRange: "{min}–{max}",
  eu: "EU",
};

const fcsb = suggestedListFields(
  { club: "FCSB", positions: "ST", maxAge: 27 },
  labels,
);
assert.equal(fcsb.title, "FCSB · ST · up to 27");
assert.equal(fcsb.club, "FCSB");

const noClub = suggestedListFields({ club: "  ", positions: ["ST", "LW"], minAge: 24, maxAge: 30, euOnly: true }, labels);
assert.equal(noClub.club, "");
assert.equal(noClub.title, "ST/LW · 24–30 · EU");
assert.equal(recognizedClubName(undefined), "");
assert.equal(recognizedClubName("Bandırmaspor"), "Bandırmaspor");

const empty = suggestedListFields({ positions: "all" }, labels);
assert.equal(empty.title, "");
assert.equal(empty.club, "");

assert.equal(
  formatListOption(
    { title: "FCSB · ST", clubName: "FCSB", playerIds: ["1", "2"] },
    "{count} saved players",
  ),
  "FCSB · ST · FCSB · 2 saved players",
);
assert.equal(
  formatListOption({ title: "ST only", clubName: null, playerIds: ["a"] }, "{count} saved players"),
  "ST only · 1 saved players",
);

console.log("list-title tests passed");
