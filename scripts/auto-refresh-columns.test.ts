import assert from "node:assert/strict";
import { isMissingAutoColumns } from "../src/lib/supabase/player-columns.ts";

assert.equal(
  isMissingAutoColumns({
    code: "PGRST204",
    message: "Could not find the 'auto_club_id' column of 'players_effective' in the schema cache",
  }),
  true,
);
assert.equal(
  isMissingAutoColumns({
    code: "42703",
    message: 'column p.auto_fetched_at does not exist',
  }),
  true,
);
assert.equal(
  isMissingAutoColumns({
    code: "PGRST204",
    message: "Could not find the 'review_active' column of 'players_effective' in the schema cache",
  }),
  false,
);
assert.equal(isMissingAutoColumns(null), false);

console.log("auto-refresh column fallback checks passed");
