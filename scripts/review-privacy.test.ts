import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";

const sql = fs.readFileSync(path.join("supabase", "migrations", "add_player_reviews.sql"), "utf8");

assert.match(sql, /security_invoker\s*=\s*true/);
assert.match(sql, /set search_path = ''/);
assert.doesNotMatch(sql, /set search_path = public/);
assert.doesNotMatch(sql, /pg_catalog\.coalesce/i);
assert.match(sql, /COALESCE\(/);
assert.match(sql, /revoke all on function public\.apply_player_review[\s\S]*from public, anon, authenticated;/i);
assert.match(sql, /grant execute on function public\.apply_player_review[\s\S]*to authenticated;/i);
assert.match(sql, /using \(active is true\)/);
assert.match(sql, /revoke all on public\.player_review_revisions from public, anon, authenticated;/i);
assert.doesNotMatch(sql, /grant (select|insert|update|delete) on public\.player_review_revisions/i);
assert.match(sql, /if not public\.current_user_is_admin\(\)/);
assert.match(sql, /revision_conflict/);
assert.match(sql, /sqlstate 'PT409'/);
assert.doesNotMatch(sql, /errcode = '40001'/);
assert.match(sql, /created_by/);
assert.match(sql, /private_note/);
assert.doesNotMatch(sql, /create policy \".+\" on public\.player_review_revisions/i);
assert.match(sql, /grant select \(/i);
assert.match(sql, /First create: both sides null/);

const viewBlock = sql.slice(sql.indexOf("create or replace view public.players_effective"));
const viewSql = viewBlock.slice(0, viewBlock.indexOf("create or replace function public.current_user_is_admin"));
assert.doesNotMatch(viewSql, /private_note/);
assert.doesNotMatch(viewSql, /created_by/);
assert.doesNotMatch(viewSql, /head_revision_id/);

const grantBlock = sql.slice(sql.indexOf("grant select ("));
const reviewGrant = grantBlock.slice(0, grantBlock.indexOf("on public.player_reviews"));
assert.doesNotMatch(reviewGrant, /head_revision_id/);
assert.doesNotMatch(reviewGrant, /private_note/);

console.log("review-privacy SQL source checks passed (not live Supabase RLS)");
