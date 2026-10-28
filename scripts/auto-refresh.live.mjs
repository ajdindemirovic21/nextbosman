/**
 * Live auto-overlay checks on nextbosman-test only.
 * Loads .env.test.local. Never prints keys. No Transfermarkt HTTP.
 * Synthetic IDs 9900211–9900216. Does not touch 9900111–9900115.
 */
import fs from "fs";
import path from "path";
import { spawnSync } from "child_process";
import { createClient } from "@supabase/supabase-js";

const SYNTHETIC_IDS = ["9900211", "9900212", "9900213", "9900214", "9900215", "9900216"];
const FETCHED_211 = "2026-10-27T09:06:51.895690";
const APP = "http://127.0.0.1:3010";
const VIEW_PUBLIC =
  "id, name, availability, filter_bucket, review_active, check_status, public_note, club, last_club, contract_until, free_since, auto_club_id, auto_club_name, auto_contract_expires, auto_is_retired, auto_joined, auto_fetched_at, market_value_eur";

function loadEnvFile(file) {
  const env = {};
  if (!fs.existsSync(file)) return env;
  for (const line of fs.readFileSync(file, "utf8").split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const cut = line.indexOf("=");
    if (cut <= 0) continue;
    const key = line.slice(0, cut).trim();
    let value = line.slice(cut + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

function urlHost(raw) {
  if (!raw) return null;
  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    return null;
  }
}

function redact(value) {
  if (value == null) return value;
  return String(value)
    .replace(/bearer\s+[a-z0-9._-]+/gi, "bearer [redacted]")
    .replace(/eyj[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+/gi, "[jwt]");
}

function errText(error) {
  if (!error) return "";
  return redact(`${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`)
    .toLowerCase()
    .slice(0, 220);
}

function isDenied(error) {
  const text = errText(error);
  return Boolean(
    error &&
      (text.includes("permission denied") ||
        text.includes("42501") ||
        text.includes("401") ||
        text.includes("403") ||
        text.includes("row-level security") ||
        text.includes("rls") ||
        text.includes("forbidden") ||
        text.includes("not granted") ||
        text.includes("schema cache") ||
        error.code === "42501" ||
        error.code === "PGRST205" ||
        error.code === "42P01" ||
        error.code === "PGRST301"),
  );
}

function publicRowSafe(row) {
  if (!row) return true;
  const keys = Object.keys(row);
  const blob = JSON.stringify(row);
  return (
    !keys.includes("private_note") &&
    !keys.includes("created_by") &&
    !keys.includes("head_revision_id") &&
    !keys.includes("last_error") &&
    !keys.includes("last_error_at") &&
    !blob.includes("private-auto-test-do-not-leak")
  );
}

const results = [];
function record(name, status, detail) {
  results.push({ name, status, detail: detail ?? "" });
  console.log(`${status}\t${name}${detail ? ` — ${detail}` : ""}`);
}
function fail(name, detail) {
  record(name, "FAIL", detail);
}
function pass(name, detail) {
  record(name, "PASS", detail);
}
function skip(name, detail) {
  record(name, "SKIP", detail);
}

const root = process.cwd();
const asserted = spawnSync(process.execPath, [path.join(root, "scripts", "assert-test-env.mjs")], {
  cwd: root,
  stdio: "inherit",
});
if (asserted.status !== 0) process.exit(asserted.status ?? 1);

const testEnv = loadEnvFile(path.join(root, ".env.test.local"));
const prodEnv = loadEnvFile(path.join(root, ".env.local"));
const usersEnv = loadEnvFile(path.join(root, ".env.test.users.local"));
if (urlHost(testEnv.NEXT_PUBLIC_SUPABASE_URL) === urlHost(prodEnv.NEXT_PUBLIC_SUPABASE_URL)) {
  console.error("ABORT: test URL host matches production.");
  process.exit(1);
}

const url = testEnv.NEXT_PUBLIC_SUPABASE_URL;
const publishable = testEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || testEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const anon = createClient(url, publishable, {
  auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
});

function clientFor(accessToken) {
  return createClient(url, publishable, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: { headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {} },
  });
}

async function timedQuery(label, promise) {
  const started = Date.now();
  let result;
  try {
    result = await promise;
  } catch (error) {
    result = { data: null, error };
  }
  console.log(`CALL\t${label}\t${Date.now() - started}ms\tcode=${result.error?.code ?? "ok"}`);
  return result;
}

async function expectDenied(name, result) {
  if (result.error && isDenied(result.error)) {
    pass(name, result.error.code ?? "denied");
    return;
  }
  if (Array.isArray(result.data) && result.data.length === 0 && !result.error) {
    pass(name, "empty");
    return;
  }
  fail(name, result.error ? errText(result.error) : `unexpected rows=${result.data?.length ?? "?"}`);
}

function byId(rows, id) {
  return rows.find((row) => String(row.id) === id) ?? null;
}

function sameFetchedAt(value, expectedIso) {
  const got = Date.parse(String(value ?? "").replace(" ", "T"));
  const want = Date.parse(expectedIso);
  return Number.isFinite(got) && got === want;
}

try {
  const probe = await timedQuery(
    "players_effective.auto_cols",
    anon.from("players_effective").select(VIEW_PUBLIC).in("id", SYNTHETIC_IDS),
  );

  if (probe.error && /auto_club_id|schema cache|does not exist/i.test(errText(probe.error))) {
    skip("db.migration", "run supabase/sql/test-project-auto-snapshots.sql on nextbosman-test");
    for (const name of [
      "overlay.new_club_unknown_end",
      "overlay.long_contract_not_listed",
      "overlay.without_club_filter",
      "overlay.retired_excluded",
      "overlay.manual_wins",
      "overlay.fetch_error_keeps_fetched_at",
      "overlay.filter_count_sort_page",
      "app.ids",
    ]) {
      skip(name, "migration not applied on test project");
    }
  } else if (probe.error) {
    fail("db.migration", errText(probe.error));
  } else {
    const rows = probe.data ?? [];
    const missing = SYNTHETIC_IDS.filter((id) => !rows.some((row) => row.id === id));
    if (missing.length) {
      skip("db.seed", `missing ${missing.join(",")}; run supabase/sql/test-project-auto-snapshots.sql`);
      for (const name of [
        "overlay.new_club_unknown_end",
        "overlay.long_contract_not_listed",
        "overlay.without_club_filter",
        "overlay.retired_excluded",
        "overlay.manual_wins",
        "overlay.fetch_error_keeps_fetched_at",
        "overlay.filter_count_sort_page",
        "app.ids",
      ]) {
        skip(name, "synthetic auto rows missing");
      }
    } else {
      pass("db.seed", "9900211–9900216 present");
      if (!rows.every(publicRowSafe)) fail("anon.private_fields", "private field leaked");
      else pass("anon.private_fields", "no last_error/private_note/created_by");

      const clubChange = byId(rows, "9900211");
      if (
        clubChange.filter_bucket === "other" &&
        clubChange.auto_club_name === "Abha Club" &&
        clubChange.auto_contract_expires == null &&
        clubChange.free_since === "2026-06-30"
      ) {
        pass("overlay.new_club_unknown_end", "Abha; CSV 2026-06-30 not used as overlay end");
      } else fail("overlay.new_club_unknown_end", JSON.stringify({
        bucket: clubChange.filter_bucket,
        club: clubChange.auto_club_name,
        end: clubChange.auto_contract_expires,
      }));

      const long = byId(rows, "9900212");
      if (long.filter_bucket === "other" && long.auto_contract_expires === "2030-06-30") {
        pass("overlay.long_contract_not_listed", "not free/expiring");
      } else fail("overlay.long_contract_not_listed", `bucket=${long.filter_bucket}`);

      const without = byId(rows, "9900214");
      if (without.filter_bucket === "no_club" && without.auto_club_id === "515") {
        pass("overlay.without_club_filter", "515 Without Club");
      } else fail("overlay.without_club_filter", `bucket=${without.filter_bucket}`);

      const retired = byId(rows, "9900215");
      if (retired.filter_bucket === "other" && (retired.auto_is_retired === true || retired.auto_club_id === "123")) {
        pass("overlay.retired_excluded", "not free/expiring");
      } else fail("overlay.retired_excluded", `bucket=${retired.filter_bucket}`);

      const manual = byId(rows, "9900216");
      if (manual.review_active === true && manual.filter_bucket === "no_club" && manual.auto_club_name === "Abha Club") {
        pass("overlay.manual_wins", "manual no_club over auto club");
      } else if (manual.review_active !== true) {
        skip("overlay.manual_wins", "no admin row when SQL ran; overlay not inserted");
      } else fail("overlay.manual_wins", `review=${manual.review_active} bucket=${manual.filter_bucket}`);

      if (sameFetchedAt(clubChange.auto_fetched_at, `${FETCHED_211}Z`)) {
        pass("overlay.fetch_error_keeps_fetched_at", String(clubChange.auto_fetched_at));
      } else fail("overlay.fetch_error_keeps_fetched_at", String(clubChange.auto_fetched_at));

      const counts = {};
      for (const bucket of ["free", "expiring", "no_club", "other"]) {
        const counted = await timedQuery(
          `count.${bucket}`,
          anon.from("players_effective").select("id", { count: "exact", head: true }).in("id", SYNTHETIC_IDS).eq("filter_bucket", bucket),
        );
        counts[bucket] = counted.count;
      }
      const page = await timedQuery(
        "page",
        anon
          .from("players_effective")
          .select("id, market_value_eur, filter_bucket", { count: "exact" })
          .in("id", SYNTHETIC_IDS)
          .order("market_value_eur", { ascending: false })
          .order("id", { ascending: true })
          .range(0, 1),
      );
      const expectNoClub = manual.review_active === true ? 2 : 1;
      const expectOther = manual.review_active === true ? 3 : 4;
      const sortOk = page.data?.[0]?.id === "9900212" && page.data?.[1]?.id === "9900211";
      if (
        counts.free === 0 &&
        counts.expiring === 1 &&
        counts.no_club === expectNoClub &&
        counts.other === expectOther &&
        page.count === 6 &&
        sortOk
      ) {
        pass("overlay.filter_count_sort_page", `free=0 expiring=1 no_club=${expectNoClub} other=${expectOther} page=[9900212,9900211]`);
      } else {
        fail(
          "overlay.filter_count_sort_page",
          `counts=${JSON.stringify(counts)} page=${JSON.stringify(page.data?.map((row) => row.id))} total=${page.count}`,
        );
      }
    }
  }

  await expectDenied(
    "anon.insert.player_auto_snapshots",
    await timedQuery(
      "anon.insert",
      anon.from("player_auto_snapshots").insert({
        player_id: "9900211",
        club_id: "1",
        club_name: "Hack FC",
        fetched_at: new Date().toISOString(),
      }),
    ),
  );
  await expectDenied(
    "anon.rpc.record_player_auto_snapshot",
    await timedQuery(
      "anon.rpc",
      anon.rpc("record_player_auto_snapshot", {
        p_player_id: "9900211",
        p_club_id: "1",
        p_club_name: "Hack FC",
        p_contract_expires: null,
        p_is_retired: false,
        p_joined: null,
        p_fetched_at: new Date().toISOString(),
      }),
    ),
  );
  const errCol = await timedQuery(
    "anon.last_error",
    anon.from("player_auto_snapshots").select("player_id, last_error, last_error_at").eq("player_id", "9900211"),
  );
  if (errCol.error && isDenied(errCol.error)) pass("anon.last_error_hidden", errCol.error.code ?? "denied");
  else if (Array.isArray(errCol.data) && errCol.data.every((row) => row.last_error == null && !("last_error" in row))) {
    pass("anon.last_error_hidden", "column absent");
  } else if (errCol.error) fail("anon.last_error_hidden", errText(errCol.error));
  else fail("anon.last_error_hidden", "last_error visible");

  const agentPassword = usersEnv.TEST_AGENT_PASSWORD || "";
  const agentEmail = usersEnv.TEST_AGENT_EMAIL || "test-agent@example.com";
  if (!agentPassword) {
    skip("agent.write_denied", "TEST_AGENT_PASSWORD missing");
  } else {
    const auth = clientFor();
    const signed = await auth.auth.signInWithPassword({ email: agentEmail, password: agentPassword });
    if (signed.error || !signed.data.session) {
      skip("agent.write_denied", redact(signed.error?.message || "no session"));
    } else {
      const agent = clientFor(signed.data.session.access_token);
      await expectDenied(
        "agent.insert.player_auto_snapshots",
        await timedQuery(
          "agent.insert",
          agent.from("player_auto_snapshots").insert({
            player_id: "9900211",
            club_id: "1",
            club_name: "Hack FC",
            fetched_at: new Date().toISOString(),
          }),
        ),
      );
      await expectDenied(
        "agent.rpc.record_player_auto_snapshot",
        await timedQuery(
          "agent.rpc",
          agent.rpc("record_player_auto_snapshot", {
            p_player_id: "9900211",
            p_club_id: "1",
            p_club_name: "Hack FC",
            p_contract_expires: null,
            p_is_retired: false,
            p_joined: null,
            p_fetched_at: new Date().toISOString(),
          }),
        ),
      );
    }
  }

  try {
    const app = await fetch(`${APP}/api/players?ids=${SYNTHETIC_IDS.join(",")}`);
    if (!app.ok) skip("app.ids", `http ${app.status} on ${APP}`);
    else {
      const body = await app.json();
      const players = body.players ?? [];
      if (!players.length) skip("app.ids", "empty; SQL seed or stale preview");
      else {
        const mapped = Object.fromEntries(players.map((player) => [player.id, player]));
        const ok =
          mapped["9900211"]?.filterBucket === "other" &&
          mapped["9900211"]?.autoRefresh?.clubName === "Abha Club" &&
          mapped["9900211"]?.autoRefresh?.contractExpires == null &&
          mapped["9900212"]?.filterBucket === "other" &&
          mapped["9900214"]?.filterBucket === "no_club" &&
          mapped["9900215"]?.filterBucket === "other";
        if (ok) pass("app.ids", `http ${app.status} overlay on preview`);
        else fail("app.ids", "preview payload missing overlay fields");
      }
    }
  } catch {
    skip("app.ids", `preview not reachable at ${APP}`);
  }
} finally {
  const failed = results.filter((row) => row.status === "FAIL").length;
  const passed = results.filter((row) => row.status === "PASS").length;
  const skipped = results.filter((row) => row.status === "SKIP").length;
  console.log(`SUMMARY\tpass=${passed} fail=${failed} skip=${skipped}`);
  if (failed) process.exit(1);
}
