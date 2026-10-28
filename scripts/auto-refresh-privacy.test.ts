import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const sql = fs.readFileSync(path.join("supabase", "migrations", "add_player_auto_snapshots.sql"), "utf8");

assert.match(sql, /create table if not exists public\.player_auto_snapshots/);
assert.match(sql, /security_invoker\s*=\s*true/);
assert.match(sql, /set search_path = ''/);
assert.match(sql, /on conflict \(player_id\) do update/);
assert.match(sql, /last_error_at = excluded\.last_error_at/);
assert.doesNotMatch(
  sql.slice(sql.indexOf("record_player_auto_fetch_error")),
  /fetched_at = excluded\.fetched_at/,
);
assert.match(sql, /revoke all on function public\.record_player_auto_snapshot[\s\S]*from public, anon, authenticated;/i);
assert.match(sql, /revoke all on function public\.record_player_auto_fetch_error[\s\S]*from public, anon, authenticated;/i);
assert.doesNotMatch(sql, /grant execute on function public\.record_player_auto_snapshot/i);
assert.match(sql, /drop function if exists public\.player_filter_bucket\(text, boolean, text, text, date, date, date\)/);
assert.match(sql, /grant select \(\s*player_id,/i);
assert.doesNotMatch(sql, /grant select on public\.player_auto_snapshots to anon/i);
assert.match(
  sql,
  /grant execute on function public\.player_filter_bucket\(text, boolean, text, text, date, date, date, timestamptz, text, text, date, boolean\) to anon, authenticated;/,
);
assert.doesNotMatch(sql, /9900211/);
assert.match(sql, /auto_club_id = '515'/);
assert.match(sql, /auto_club_name = 'Without Club'/);
assert.match(sql, /auto_club_id = '123'/);

const errorFn = sql.slice(sql.indexOf("create or replace function public.record_player_auto_fetch_error"));
const errorBody = errorFn.slice(0, errorFn.indexOf("revoke all on function public.record_player_auto_fetch_error"));
assert.doesNotMatch(errorBody, /fetched_at =/);

const grantSql = fs.readFileSync(path.join("supabase", "sql", "test-project-grant-player-filter-bucket.sql"), "utf8");
assert.match(grantSql, /TEST PROJECT ONLY/);
assert.match(
  grantSql,
  /grant execute on function public\.player_filter_bucket\([\s\S]*timestamptz, text, text, date, boolean/,
);

const testSql = fs.readFileSync(path.join("supabase", "sql", "test-project-auto-snapshots.sql"), "utf8");
const seedSql = fs.readFileSync(path.join("supabase", "sql", "test-project-auto-snapshots.seed.sql"), "utf8");
assert.match(testSql, /TEST PROJECT ONLY/);
assert.match(
  testSql,
  /grant execute on function public\.player_filter_bucket\(text, boolean, text, text, date, date, date, timestamptz, text, text, date, boolean\) to anon, authenticated;/,
);
assert.match(seedSql, /'9900211'/);
assert.match(seedSql, /'9900216'/);
assert.doesNotMatch(seedSql, /delete from public\.players/i);
assert.doesNotMatch(seedSql, /'9900111'/);

console.log("auto-refresh SQL source checks passed (not applied)");
