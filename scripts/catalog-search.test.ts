import assert from "node:assert/strict";
import {
  catalogSearchReady,
  escapeIlikePattern,
  normalizeCatalogSearch,
  playerMatchesCatalogSearch,
  rankCatalogSearchHits,
} from "../src/lib/catalog-search.ts";
import en from "../src/i18n/dictionaries/en.json" with { type: "json" };
import bs from "../src/i18n/dictionaries/bs.json" with { type: "json" };
import de from "../src/i18n/dictionaries/de.json" with { type: "json" };
import es from "../src/i18n/dictionaries/es.json" with { type: "json" };
import fr from "../src/i18n/dictionaries/fr.json" with { type: "json" };
import hr from "../src/i18n/dictionaries/hr.json" with { type: "json" };
import it from "../src/i18n/dictionaries/it.json" with { type: "json" };
import pt from "../src/i18n/dictionaries/pt.json" with { type: "json" };
import tr from "../src/i18n/dictionaries/tr.json" with { type: "json" };

const keys = [
  "searchLabel",
  "search",
  "searchTooShort",
  "searchFailed",
  "noMatches",
  "results",
  "invalidPlayerId",
  "notInCatalog",
] as const;

for (const dict of [en, bs, de, es, fr, hr, it, pt, tr]) {
  for (const key of keys) {
    assert.equal(typeof dict.review[key], "string");
    assert.ok(dict.review[key].length > 0);
  }
  assert.notEqual(dict.review.notInCatalog, dict.review.loadFailed);
}

assert.equal(normalizeCatalogSearch("  Ada  Kovač  "), "Ada Kovač");
assert.equal(catalogSearchReady("A"), false);
assert.equal(catalogSearchReady("Ad"), true);
assert.equal(catalogSearchReady("9900114"), true);

const free = { id: "1", name: "Ada Kovač" };
const expiring = { id: "2", name: "Ada Kovač" };
const other = { id: "3", name: "Marko Ilić" };
assert.equal(playerMatchesCatalogSearch(free, "kova"), true);
assert.equal(playerMatchesCatalogSearch(expiring, "Ada"), true);
assert.equal(playerMatchesCatalogSearch(other, "kova"), false);
assert.equal(playerMatchesCatalogSearch(free, "1"), true);
assert.equal(playerMatchesCatalogSearch({ id: "9900114", name: "Ada Kovač" }, "9900"), true);

const ranked = rankCatalogSearchHits(
  [other, expiring, free].filter((row) => playerMatchesCatalogSearch(row, "Ada Kovač")),
  "Ada Kovač",
);
assert.deepEqual(
  ranked.map((row) => row.id),
  ["1", "2"],
);

assert.equal(escapeIlikePattern("100%_win"), "100\\%\\_win");

console.log("catalog-search tests passed");
