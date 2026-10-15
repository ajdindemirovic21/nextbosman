import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { searchPathFromFilters } from "../src/lib/list-search.ts";
import { PAGE_SIZE, compareMarketValueThenId, parsePageParam } from "../src/lib/player-page.ts";

function loadLocalEnv() {
  const file = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const cut = line.indexOf("=");
    if (cut <= 0) continue;
    const key = line.slice(0, cut).trim();
    let value = line.slice(cut + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (process.env[key] == null) process.env[key] = value;
  }
}

assert.equal(PAGE_SIZE, 80);
assert.equal(parsePageParam(null), 1);
assert.equal(parsePageParam(""), 1);
assert.equal(parsePageParam("1"), 1);
assert.equal(parsePageParam("2"), 2);
assert.equal(parsePageParam("0"), 1);
assert.equal(parsePageParam("-3"), 1);
assert.equal(parsePageParam("foo"), 1);
assert.equal(parsePageParam("2.9"), 1);

const oldList = searchPathFromFilters("en", { status: "all", position: "ST", maxAge: 36 });
assert.doesNotMatch(oldList, /[?&]page=/);

const filters = {
  status: "all" as const,
  position: "ST" as const,
  euOnly: true,
};

function assertStableOrder(players: { id: string; marketValueEur: number }[]) {
  for (let i = 1; i < players.length; i += 1) {
    const cmp = compareMarketValueThenId(players[i - 1], players[i]);
    assert.ok(cmp <= 0, `order broke at ${players[i - 1].id} -> ${players[i].id}`);
  }
}

function assertNoDupes(players: { id: string }[]) {
  const ids = players.map((player) => String(player.id));
  assert.equal(ids.length, new Set(ids).size);
}

async function main() {
  loadLocalEnv();
  const { queryPlayers, queryPlayersFromJson, queryPlayersFromSupabase } = await import(
    "../src/data/catalog.ts"
  );
  const { isSupabaseConfigured } = await import("../src/lib/supabase/env.ts");

  const local1 = queryPlayersFromJson({ ...filters, page: 1 });
  const local2 = queryPlayersFromJson({ ...filters, page: 2 });
  const lastPage = Math.max(1, Math.ceil(local1.total / PAGE_SIZE));
  const localLast = queryPlayersFromJson({ ...filters, page: lastPage });
  const localBeyond = queryPlayersFromJson({ ...filters, page: lastPage + 5 });

  assert.equal(local1.pageSize, 80);
  assert.equal(local1.players.length, Math.min(80, local1.total));
  assertNoDupes([...local1.players, ...local2.players]);
  const overlap = new Set(local1.players.map((player) => player.id));
  for (const player of local2.players) {
    assert.equal(overlap.has(player.id), false);
  }
  assertStableOrder(local1.players);
  assertStableOrder(local2.players);
  assert.equal(localLast.players.length, local1.total - (lastPage - 1) * PAGE_SIZE);
  assert.equal(localBeyond.players.length, 0);
  assert.equal(localBeyond.total, local1.total);

  const live1 = await queryPlayers({ ...filters, page: 1 });
  const live2 = await queryPlayers({ ...filters, page: 2 });
  assertNoDupes([...live1.players, ...live2.players]);
  assertStableOrder(live1.players);
  assertStableOrder(live2.players);
  assert.equal(live1.pageSize, 80);
  const liveLastPage = Math.max(1, Math.ceil(live1.total / PAGE_SIZE));
  const liveLast = await queryPlayers({ ...filters, page: liveLastPage });
  assert.equal(liveLast.players.length, live1.total - (liveLastPage - 1) * PAGE_SIZE);
  const liveBeyond = await queryPlayers({ ...filters, page: liveLastPage + 8 });
  assert.equal(liveBeyond.players.length, 0);
  assert.equal(liveBeyond.total, live1.total);

  const notes: string[] = [];
  if (isSupabaseConfigured()) {
    const remote1 = await queryPlayersFromSupabase({ ...filters, page: 1 });
    const json1 = queryPlayersFromJson({ ...filters, page: 1 });
    const remoteIds = remote1.players.map((player) => player.id).join(",");
    const jsonIds = json1.players.map((player) => player.id).join(",");
    if (remote1.total !== json1.total || remoteIds !== jsonIds) {
      notes.push(
        `Supabase and JSON fallback differ for ST+EU page 1: remote total=${remote1.total} json total=${json1.total}. Likely a stale data/derived/players.json versus the live players table, or a type/collation mismatch on id.`,
      );
      const remoteOnly = remote1.players.filter((player) => !json1.players.some((row) => row.id === player.id));
      const jsonOnly = json1.players.filter((player) => !remote1.players.some((row) => row.id === player.id));
      notes.push(
        `First-page ID mismatch sample remoteOnly=${remoteOnly
          .slice(0, 3)
          .map((player) => player.id)
          .join(",")} jsonOnly=${jsonOnly
          .slice(0, 3)
          .map((player) => player.id)
          .join(",")}`,
      );
    } else {
      notes.push("Supabase and JSON fallback match for ST+EU page 1 IDs and total.");
    }
  } else {
    notes.push("Supabase is not configured; live query used JSON fallback only.");
  }

  console.log("pagination tests passed", {
    local: { total: local1.total, last: localLast.players.length },
    live: { total: live1.total, last: liveLast.players.length },
    notes,
  });
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
