import assert from "node:assert/strict";
import fs from "fs";
import path from "path";

const root = process.cwd();
const idPattern = /^[a-zA-Z0-9_-]{1,32}$/;
const positions = new Set(["GK", "CB", "LB", "RB", "DM", "CM", "AM", "LW", "RW", "ST"]);
const availability = new Set(["free", "expiring"]);

const schema = fs.readFileSync(path.join(root, "supabase", "schema.sql"), "utf8");
const reviews = fs.readFileSync(path.join(root, "supabase", "migrations", "add_player_reviews.sql"), "utf8");
const seed = fs.readFileSync(path.join(root, "supabase", "sql", "test-project-bootstrap.sql"), "utf8");

assert.match(schema, /has_season_stats boolean not null default false/);
assert.match(schema, /profile_url text/);
assert.match(reviews, /p\.has_season_stats/);
assert.match(reviews, /p\.profile_url/);

const ids = [...seed.matchAll(/\n\s+'(\d{7})', 'TEST /g)].map((m) => m[1]);
assert.deepEqual(ids, ["9900001", "9900002", "9900003", "9900004", "9900005"]);
for (const id of ids) assert.match(id, idPattern);

const insertSql = seed.slice(seed.indexOf("insert into"));
assert.doesNotMatch(insertSql, /test-free-/);
assert.doesNotMatch(insertSql, /https?:\/\//i);
assert.doesNotMatch(insertSql, /transfermarkt/i);
assert.equal((insertSql.match(/'TEST /g) || []).length, 5);

const tuples = [
  ...insertSql.matchAll(
    /\(\s*'(\d{7})', 'TEST [^']+', (\d+), '[0-9-]+', '([A-Z]{2})',\s+(null|'[^']+'), '[^']+', '[^']+', '[^']+',\s+'[^']+', (?:true|false), '(free|expiring)', (null|'[0-9-]+'), (null|'[0-9-]+'),\s+(?:true|false), \d+, \d+, \d+, \d+, \d+, \d+, \d+, null\s*\)/g,
  ),
];
assert.equal(tuples.length, 5, "synthetic rows must match players check constraints");
for (const tuple of tuples) {
  const [, id, age, position, club, listed, contractUntil, freeSince] = tuple;
  assert.match(id, idPattern);
  assert.ok(Number(age) >= 16 && Number(age) <= 40);
  assert.ok(positions.has(position), position);
  assert.ok(availability.has(listed));
  if (listed === "free") {
    assert.equal(club, "null", "listed-free rows have no current club");
    assert.equal(contractUntil, "null");
    assert.match(freeSince, /^'[0-9-]+'$/);
  } else {
    assert.match(club, /^'[^']+'$/, "listed-expiring rows have a club");
    assert.match(contractUntil, /^'[0-9-]+'$/);
    assert.equal(freeSince, "null");
  }
}

const header = `-- TEST PROJECT ONLY. Empty database. Do not run on production.
-- Built from supabase/schema.sql, supabase/migrations/add_player_reviews.sql,
-- and supabase/sql/test-project-bootstrap.sql.
-- schema.sql already defines has_season_stats and profile_url, so
-- add_has_season_stats.sql and add_profile_url.sql are not applied again.
-- Wrapped in a single transaction. Does not create auth users or admins.

begin;

`;

const out = path.join(root, "supabase", "sql", "test-project-all.sql");
fs.writeFileSync(out, `${header}${schema}\n\n${reviews}\n\n${seed}\n\ncommit;\n`);
console.log(`Wrote ${path.relative(root, out)} (${fs.statSync(out).size} bytes)`);
