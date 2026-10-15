import assert from "node:assert/strict";
import { filterSavedLists, nextListAfterDelete, savedListsPath } from "../src/lib/list-search.ts";
import type { SavedList } from "../src/lib/supabase/types.ts";

function list(partial: Partial<SavedList> & Pick<SavedList, "id" | "title">): SavedList {
  return {
    userId: "u1",
    clubName: null,
    queryText: null,
    filters: {},
    playerIds: [],
    shareToken: null,
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...partial,
  };
}

assert.equal(savedListsPath("bs"), "/bs/lists");
assert.equal(savedListsPath("en", "  "), "/en/lists");
assert.equal(savedListsPath("en", "abc 12"), "/en/lists?list=abc%2012");

const lists = [
  list({ id: "new", title: "Newest ST", clubName: "FCSB", playerIds: ["1"] }),
  list({ id: "mid", title: "Midfield", clubName: "Bandırmaspor", playerIds: ["2", "3"] }),
  list({ id: "old", title: "Old GK", clubName: null, playerIds: ["4"] }),
];

assert.equal(filterSavedLists(lists, "").length, 3);
assert.deepEqual(
  filterSavedLists(lists, "fcsb").map((item) => item.id),
  ["new"],
);
assert.deepEqual(
  filterSavedLists(lists, "MID").map((item) => item.id),
  ["mid"],
);
assert.deepEqual(
  filterSavedLists(lists, "bandır").map((item) => item.id),
  ["mid"],
);
assert.equal(filterSavedLists(lists, "zzz").length, 0);

assert.equal(nextListAfterDelete(lists, "new")?.id, "mid");
assert.equal(nextListAfterDelete(lists, "mid")?.id, "old");
assert.equal(nextListAfterDelete(lists, "old")?.id, "mid");
assert.equal(nextListAfterDelete(lists, "missing")?.id, "new");
assert.equal(nextListAfterDelete([lists[0]], "new"), null);

console.log("list-nav tests passed");
