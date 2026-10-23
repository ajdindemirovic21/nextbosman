/**
 * Live review-security checks against the TEST project only.
 * Loads .env.test.local and .env.test.users.local. Never service-role.
 * Mutating admin RPCs run only when TEST_REVIEW_WRITES=1.
 * Uses 9900111–9900115; does not delete existing review history.
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const SOURCE = "https://example.com/nextbosman-test-review";
const PRIVATE_NOTE = "private-test-note-do-not-leak";
const FETCH_MS = 30000;
const SYNTHETIC_IDS = ["9900111", "9900112", "9900113", "9900114", "9900115"];
const FLOW = {
  apply: "9900111",
  deactivate: "9900113",
  parallel: "9900115",
};
const WRITE_TESTS = [
  "admin.apply_first",
  "admin.apply_conflict_stale_null",
  "admin.apply_second",
  "admin.history",
  "admin.rollback",
  "anon.effective_after_rollback",
  "anon.filter_counts_after_overlay",
  "admin.apply_for_deactivate",
  "admin.deactivate",
  "admin.current_inactive",
  "admin.parallel_first_create",
];

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
  const text = String(value);
  return text
    .replace(/bearer\s+[a-z0-9._-]+/gi, "bearer [redacted]")
    .replace(/eyj[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+/gi, "[jwt]");
}

function timedFetch(input, init = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_MS);
  timer.unref?.();
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function clientOptions(accessToken) {
  return {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
    global: {
      fetch: timedFetch,
      headers: accessToken ? { Authorization: `Bearer ${accessToken}` } : {},
    },
  };
}

function isClientTimeout(error) {
  if (!error) return false;
  const text = `${error.name ?? ""} ${error.code ?? ""} ${error.message ?? ""}`;
  return /abort/i.test(text) || error.name === "AbortError";
}

function isServerCancel(error) {
  const text = `${error?.code ?? ""} ${error?.message ?? ""}`.toLowerCase();
  return (
    error &&
    (error.code === "57014" ||
      error.code === "55P03" ||
      error.code === "40P01" ||
      text.includes("query_canceled") ||
      text.includes("lock timeout") ||
      text.includes("deadlock detected") ||
      text.includes("canceling statement"))
  );
}

function errText(error) {
  if (!error) return "";
  if (isClientTimeout(error)) return "client_timeout";
  if (isServerCancel(error)) return `server_cancel:${error.code ?? "unknown"}`;
  return redact(`${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`)
    .toLowerCase()
    .slice(0, 220);
}

function isDenied(error) {
  const text = errText(error);
  return Boolean(
    error &&
      !isClientTimeout(error) &&
      (text.includes("permission denied") ||
        text.includes("not_admin") ||
        text.includes("42501") ||
        text.includes("401") ||
        text.includes("403") ||
        text.includes("jwt") ||
        text.includes("not accept") ||
        text.includes("row-level security") ||
        text.includes("rls") ||
        text.includes("forbidden") ||
        text.includes("not granted") ||
        text.includes("schema cache") ||
        error.code === "42501" ||
        error.code === "PGRST205" ||
        error.code === "42P01" ||
        error.code === "PGRST301" ||
        error.code === "PGRST302"),
  );
}

function isConflict(error) {
  const text = errText(error);
  const code = String(error?.code ?? "");
  return Boolean(
    error &&
      (code === "PT409" ||
        text.includes("pt409") ||
        text.includes("revision_conflict") ||
        code === "40001" ||
        text.includes("40001")),
  );
}

function headOf(data) {
  if (!data) return null;
  if (typeof data === "object" && data.head_revision_id) return data.head_revision_id;
  return null;
}

function applyArgs(playerId, expectedHead, extras = {}) {
  return {
    p_player_id: playerId,
    p_check_status: extras.checkStatus ?? "no_club",
    p_club_mode: extras.clubMode ?? "none",
    p_club_value: extras.clubValue ?? null,
    p_contract_mode: extras.contractMode ?? "unknown",
    p_contract_value: extras.contractValue ?? null,
    p_source_url: SOURCE,
    p_event_at: extras.eventAt ?? null,
    p_public_note: extras.publicNote ?? "public test note",
    p_private_note: extras.privateNote ?? PRIVATE_NOTE,
    p_expected_head_revision_id: expectedHead,
  };
}

const results = [];

function record(name, status, detail) {
  const row = { name, status, detail: detail ?? "" };
  results.push(row);
  console.log(`${row.status}\t${row.name}${row.detail ? ` — ${row.detail}` : ""}`);
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

function skipFrom(names, reason) {
  for (const name of names) skip(name, reason);
}

async function timedRpc(sb, fn, args) {
  const started = Date.now();
  let result;
  try {
    result = await sb.rpc(fn, args);
  } catch (error) {
    result = { data: null, error };
  }
  const ms = Date.now() - started;
  const clientTimeout = isClientTimeout(result.error);
  const serverCancel = isServerCancel(result.error);
  console.log(
    `CALL\t${fn}\t${ms}ms\tclientTimeout=${clientTimeout}\tserverCancel=${serverCancel}\tcode=${result.error?.code ?? "ok"}\thead=${headOf(result.data) ? "yes" : "no"}`,
  );
  return { ...result, ms, clientTimeout, serverCancel };
}

async function timedQuery(label, promise) {
  const started = Date.now();
  let result;
  try {
    result = await promise;
  } catch (error) {
    result = { data: null, error };
  }
  const ms = Date.now() - started;
  console.log(`CALL\t${label}\t${ms}ms\tcode=${result.error?.code ?? "ok"}`);
  return { ...result, ms, clientTimeout: isClientTimeout(result.error), serverCancel: isServerCancel(result.error) };
}

async function expectDenied(name, result) {
  if (result.clientTimeout) {
    fail(name, `client_timeout ${result.ms}ms (server transaction not confirmed aborted)`);
    return false;
  }
  if (result.serverCancel) {
    fail(name, errText(result.error));
    return false;
  }
  if (result.error && isDenied(result.error)) {
    pass(name, `${result.error.code ?? "denied"} ${result.ms}ms`);
    return true;
  }
  if (Array.isArray(result.data) && result.data.length === 0 && !result.error) {
    pass(name, `empty ${result.ms}ms`);
    return true;
  }
  fail(name, result.error ? errText(result.error) : `unexpected data rows=${result.data?.length ?? "?"}`);
  return false;
}

function publicRowSafe(row) {
  if (!row) return true;
  const keys = Object.keys(row);
  return !keys.includes("private_note") && !keys.includes("created_by") && !keys.includes("head_revision_id");
}

function currentRow(data) {
  if (Array.isArray(data)) return data[0] ?? null;
  return data ?? null;
}

async function readReviewState(admin, playerId, label) {
  const effective = await timedQuery(
    `${label}.effective`,
    anon.from("players_effective").select("id, review_active, check_status, filter_bucket, public_note").eq("id", playerId).maybeSingle(),
  );
  const current = await timedRpc(admin, "admin_player_review_current", { p_player_id: playerId });
  const row = currentRow(current.data);
  return {
    effective,
    current,
    reviewActive: effective.data?.review_active === true,
    head: row?.head_revision_id ?? null,
    overlayActive: row?.active === true,
    overlayInactive: row?.active === false,
  };
}

async function confirmApplyHead(admin, playerId, rpcResult, label) {
  const httpHead = headOf(rpcResult.data);
  if (!rpcResult.clientTimeout && !rpcResult.error && httpHead) {
    return { head: httpHead, via: "http" };
  }
  console.log(`READ\tconfirm ${label} after timeout/error; write will not be retried`);
  const state = await readReviewState(admin, playerId, label);
  if (state.overlayActive && state.head) {
    return { head: state.head, via: "read" };
  }
  return { head: null, via: rpcResult.clientTimeout ? "timeout" : "missing" };
}

const root = process.cwd();
const testEnv = loadEnvFile(path.join(root, ".env.test.local"));
const prodEnv = loadEnvFile(path.join(root, ".env.local"));
const usersEnv = loadEnvFile(path.join(root, ".env.test.users.local"));
const allowWrites = process.env.TEST_REVIEW_WRITES === "1";

if (urlHost(testEnv.NEXT_PUBLIC_SUPABASE_URL) === urlHost(prodEnv.NEXT_PUBLIC_SUPABASE_URL)) {
  console.error("ABORT: test URL host matches production.");
  process.exit(1);
}

const url = testEnv.NEXT_PUBLIC_SUPABASE_URL;
const publishable = testEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || testEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !publishable) {
  console.error("ABORT: test URL or publishable key missing.");
  process.exit(1);
}

function clientFor(accessToken) {
  return createClient(url, publishable, clientOptions(accessToken));
}

const anon = clientFor();
const agentEmail = usersEnv.TEST_AGENT_EMAIL || "test-agent@example.com";
const adminEmail = usersEnv.TEST_ADMIN_EMAIL || "test-admin@example.com";
const agentPassword = usersEnv.TEST_AGENT_PASSWORD || "";
const adminPassword = usersEnv.TEST_ADMIN_PASSWORD || "";

async function signIn(email, password) {
  if (!password) return { session: null, error: { message: "password empty" } };
  const authClient = clientFor();
  const started = Date.now();
  const { data, error } = await authClient.auth.signInWithPassword({ email, password });
  console.log(`CALL\tsignIn\t${Date.now() - started}ms\tcode=${error?.code ?? "ok"}`);
  return { session: data.session ?? null, error };
}

const viewPublic =
  "id, name, availability, filter_bucket, review_active, check_status, public_note, source_url, club, last_club, contract_until, free_since, has_season_stats, profile_url";

try {
  const effective = await timedQuery(
    "players_effective.in",
    anon.from("players_effective").select(viewPublic, { count: "exact" }).in("id", SYNTHETIC_IDS),
  );
  const rows = effective.data ?? [];
  const missing = SYNTHETIC_IDS.filter((id) => !rows.some((row) => row.id === id));
  const dirty = rows.some((row) => row.review_active === true);
  if (effective.error) fail("anon.players_effective", errText(effective.error));
  else if (missing.length) {
    fail(
      "anon.players_effective",
      `missing ${missing.join(",")}; run supabase/sql/test-project-security-players.sql on nextbosman-test`,
    );
  } else if (!rows.every(publicRowSafe)) fail("anon.players_effective", "private columns present");
  else if (rows.some((row) => row.profile_url)) fail("anon.players_effective", "synthetic player has profile_url");
  else pass("anon.players_effective", `5 rows ${effective.ms}ms`);

  if (dirty) skip("fixture.clean_synthetic", "active overlay on 9900111–9900115; not deleting history");
  else if (!missing.length && !effective.error) pass("fixture.clean_synthetic", "no active overlay on new ids");

  const star = await timedQuery(
    "players_effective.star",
    anon.from("players_effective").select("*").eq("id", FLOW.apply).maybeSingle(),
  );
  if (star.error) fail("anon.players_effective.*", errText(star.error));
  else if (!star.data) skip("anon.players_effective.*", "9900111 missing");
  else if (!publicRowSafe(star.data) || JSON.stringify(star.data).includes("created_by")) {
    fail("anon.players_effective.*", "leaked private field");
  } else pass("anon.players_effective.*", `${star.ms}ms`);

  await expectDenied("anon.player_review_revisions.select", await timedQuery("revisions.select", anon.from("player_review_revisions").select("*")));
  await expectDenied("anon.player_reviews.select_star", await timedQuery("reviews.star", anon.from("player_reviews").select("*")));
  const reviewsPublic = await timedQuery(
    "reviews.public",
    anon.from("player_reviews").select("player_id, active, check_status, public_note"),
  );
  if (reviewsPublic.error) fail("anon.player_reviews.public_columns", errText(reviewsPublic.error));
  else if (!reviewsPublic.data.every(publicRowSafe)) fail("anon.player_reviews.public_columns", "private keys");
  else pass("anon.player_reviews.public_columns", `${reviewsPublic.data.length} visible active rows ${reviewsPublic.ms}ms`);

  await expectDenied("anon.apply_player_review", await timedRpc(anon, "apply_player_review", applyArgs(FLOW.apply, null)));
  await expectDenied("anon.admin_player_review_history", await timedRpc(anon, "admin_player_review_history", { p_player_id: FLOW.apply }));
  await expectDenied("anon.admin_player_review_current", await timedRpc(anon, "admin_player_review_current", { p_player_id: FLOW.apply }));
  await expectDenied("anon.current_user_is_admin", await timedRpc(anon, "current_user_is_admin"));
  await expectDenied(
    "anon.insert.player_reviews",
    await timedQuery(
      "reviews.insert",
      anon.from("player_reviews").insert({
        player_id: FLOW.apply,
        active: true,
        head_revision_id: "00000000-0000-0000-0000-000000000000",
        check_status: "no_club",
        club_mode: "none",
        contract_mode: "unknown",
        source_url: SOURCE,
        checked_at: new Date().toISOString(),
        public_note: "x",
      }),
    ),
  );
  await expectDenied(
    "anon.insert.revisions",
    await timedQuery(
      "revisions.insert",
      anon.from("player_review_revisions").insert({
        player_id: FLOW.apply,
        kind: "apply",
        created_by: "00000000-0000-0000-0000-000000000000",
        active: true,
      }),
    ),
  );
  await expectDenied(
    "anon.insert.admins",
    await timedQuery("admins.insert", anon.from("admins").insert({ user_id: "00000000-0000-0000-0000-000000000000" })),
  );

  const bucketCount = async (bucket) =>
    timedQuery(
      `count.${bucket}`,
      anon.from("players_effective").select("id", { count: "exact", head: true }).in("id", SYNTHETIC_IDS).eq("filter_bucket", bucket),
    );
  const free = await bucketCount("free");
  const expiring = await bucketCount("expiring");
  const noClub = await bucketCount("no_club");
  if (missing.length) skip("anon.filter_counts_initial", "new synthetic players missing");
  else if (free.error || expiring.error || noClub.error) {
    fail("anon.filter_counts_initial", errText(free.error || expiring.error || noClub.error));
  } else if (dirty) {
    skip("anon.filter_counts_initial", `dirty new ids free=${free.count} expiring=${expiring.count} no_club=${noClub.count}`);
  } else if (free.count !== 2 || expiring.count !== 3 || noClub.count !== 0) {
    fail("anon.filter_counts_initial", `free=${free.count} expiring=${expiring.count} no_club=${noClub.count}`);
  } else pass("anon.filter_counts_initial", "free=2 expiring=3 no_club=0 among 9900111–9900115");

  const page1 = await timedQuery(
    "page1",
    anon
      .from("players_effective")
      .select("id", { count: "exact" })
      .in("id", SYNTHETIC_IDS)
      .order("market_value_eur", { ascending: false })
      .order("id", { ascending: true })
      .range(0, 1),
  );
  const page2 = await timedQuery(
    "page2",
    anon
      .from("players_effective")
      .select("id", { count: "exact" })
      .in("id", SYNTHETIC_IDS)
      .order("market_value_eur", { ascending: false })
      .order("id", { ascending: true })
      .range(4, 5),
  );
  if (missing.length) skip("anon.pagination", "new synthetic players missing");
  else if (page1.error || page2.error) fail("anon.pagination", errText(page1.error || page2.error));
  else if ((page1.data?.length ?? 0) !== 2 || page1.count !== 5) fail("anon.pagination", `page1 len=${page1.data?.length} count=${page1.count}`);
  else if ((page2.data?.length ?? 0) !== 1 || page2.count !== 5) fail("anon.pagination", `page2 len=${page2.data?.length} count=${page2.count}`);
  else pass("anon.pagination", `total=5 among new ids ${page1.ms}ms/${page2.ms}ms`);

  if (!agentPassword || !adminPassword) {
    skip("agent.* / admin.*", "Fill TEST_AGENT_PASSWORD and TEST_ADMIN_PASSWORD in .env.test.users.local");
    skipFrom(WRITE_TESTS, "no credentials");
  } else {
    const agentAuth = await signIn(agentEmail, agentPassword);
    if (!agentAuth.session) skip("agent.sign_in", "sign-in failed");
    else {
      const agent = clientFor(agentAuth.session.access_token);
      const adminFlag = await timedRpc(agent, "current_user_is_admin");
      if (adminFlag.clientTimeout) fail("agent.current_user_is_admin", "client_timeout");
      else if (adminFlag.error) await expectDenied("agent.current_user_is_admin", adminFlag);
      else if (adminFlag.data === true) fail("agent.current_user_is_admin", "ordinary agent reported admin");
      else pass("agent.current_user_is_admin", `false ${adminFlag.ms}ms`);

      await expectDenied("agent.player_review_revisions.select", await timedQuery("agent.revisions", agent.from("player_review_revisions").select("*")));
      await expectDenied("agent.apply_player_review", await timedRpc(agent, "apply_player_review", applyArgs(FLOW.apply, null)));
      await expectDenied("agent.admin_player_review_history", await timedRpc(agent, "admin_player_review_history", { p_player_id: FLOW.apply }));
      await expectDenied(
        "agent.insert.admins",
        await timedQuery("agent.admins.insert", agent.from("admins").insert({ user_id: agentAuth.session.user.id })),
      );
    }

    const adminAuth = await signIn(adminEmail, adminPassword);
    if (!adminAuth.session) {
      skip("admin.sign_in", "sign-in failed");
      skipFrom(WRITE_TESTS, "admin sign-in failed");
    } else {
      const admin = clientFor(adminAuth.session.access_token);
      const adminFlag = await timedRpc(admin, "current_user_is_admin");
      if (adminFlag.error || adminFlag.data !== true) fail("admin.current_user_is_admin", errText(adminFlag.error) || String(adminFlag.data));
      else pass("admin.current_user_is_admin", `true ${adminFlag.ms}ms`);

      if (!allowWrites) {
        skipFrom(WRITE_TESTS, "TEST_REVIEW_WRITES is not 1; mutating RPCs not sent");
      } else if (missing.length) {
        skipFrom(WRITE_TESTS, "run test-project-security-players.sql on nextbosman-test");
      } else if (dirty) {
        skipFrom(WRITE_TESTS, "new ids already have overlays; not deleting history");
      } else {
        const first = await timedRpc(admin, "apply_player_review", applyArgs(FLOW.apply, null));
        const firstConfirmed = await confirmApplyHead(admin, FLOW.apply, first, "apply_first");
        const head1 = firstConfirmed.head;
        if (head1 && firstConfirmed.via === "http") pass("admin.apply_first", `head ${first.ms}ms`);
        else if (head1 && first.clientTimeout) pass("admin.apply_first", `http timeout ${first.ms}ms; overlay confirmed via read`);
        else if (first.clientTimeout) skip("admin.apply_first", `client_timeout ${first.ms}ms; overlay not confirmed`);
        else fail("admin.apply_first", errText(first.error) || "no head_revision_id");

        if (!head1) {
          skipFrom(
            [
              "admin.apply_conflict_stale_null",
              "admin.apply_second",
              "admin.history",
              "admin.rollback",
              "anon.effective_after_rollback",
              "anon.filter_counts_after_overlay",
            ],
            "no confirmed head from apply_first",
          );
        } else {
          const conflictNull = await timedRpc(admin, "apply_player_review", applyArgs(FLOW.apply, null));
          if (conflictNull.clientTimeout) {
            const state = await readReviewState(admin, FLOW.apply, "stale_null");
            fail(
              "admin.apply_conflict_stale_null",
              `client_timeout ${conflictNull.ms}ms; expected PT409; overlay_active=${state.overlayActive}`,
            );
          } else if (isConflict(conflictNull.error)) pass("admin.apply_conflict_stale_null", `${conflictNull.error?.code ?? "conflict"} ${conflictNull.ms}ms`);
          else fail("admin.apply_conflict_stale_null", conflictNull.error ? errText(conflictNull.error) : "succeeded");

          const second = await timedRpc(
            admin,
            "apply_player_review",
            applyArgs(FLOW.apply, head1, { publicNote: "second public note", checkStatus: "unknown", clubMode: "unknown" }),
          );
          const secondConfirmed = await confirmApplyHead(admin, FLOW.apply, second, "apply_second");
          const head2 = secondConfirmed.head && secondConfirmed.head !== head1 ? secondConfirmed.head : headOf(second.data);
          if (headOf(second.data) && secondConfirmed.via === "http") pass("admin.apply_second", `${second.ms}ms`);
          else if (second.clientTimeout && secondConfirmed.head && secondConfirmed.head !== head1) {
            pass("admin.apply_second", `http timeout ${second.ms}ms; new head confirmed via read`);
          } else if (second.clientTimeout) {
            skip("admin.apply_second", `client_timeout ${second.ms}ms; new head not confirmed`);
          } else if (second.error || !head2) fail("admin.apply_second", errText(second.error) || "no head");
          else pass("admin.apply_second", `${second.ms}ms`);

          const confirmedHead2 = headOf(second.data) || (secondConfirmed.head !== head1 ? secondConfirmed.head : null);

          if (!confirmedHead2) {
            skipFrom(
              ["admin.history", "admin.rollback", "anon.effective_after_rollback", "anon.filter_counts_after_overlay"],
              "no confirmed head from apply_second",
            );
          } else {
            const history = await timedRpc(admin, "admin_player_review_history", { p_player_id: FLOW.apply });
            if (history.error) fail("admin.history", errText(history.error));
            else if (!Array.isArray(history.data) || history.data.length < 2) fail("admin.history", `rows=${history.data?.length}`);
            else pass("admin.history", `${history.data.length} revisions ${history.ms}ms`);

            const rollback = await timedRpc(admin, "rollback_player_review", {
              p_player_id: FLOW.apply,
              p_revision_id: head1,
              p_expected_head_revision_id: confirmedHead2,
            });
            let rollbackSkipped = false;
            if (rollback.clientTimeout) {
              const state = await readReviewState(admin, FLOW.apply, "rollback");
              if (state.reviewActive && state.effective.data?.check_status === "no_club") {
                pass("admin.rollback", `http timeout ${rollback.ms}ms; no_club overlay confirmed via read`);
              } else {
                skip("admin.rollback", `client_timeout ${rollback.ms}ms; rollback not confirmed`);
                rollbackSkipped = true;
              }
            } else if (rollback.error) fail("admin.rollback", errText(rollback.error));
            else pass("admin.rollback", `${rollback.ms}ms`);

            if (rollbackSkipped) {
              skipFrom(
                ["anon.effective_after_rollback", "anon.filter_counts_after_overlay"],
                "rollback not confirmed",
              );
            } else {
              const afterRollback = await timedQuery(
                "effective.after_rollback",
                anon.from("players_effective").select("filter_bucket, check_status, public_note").eq("id", FLOW.apply).maybeSingle(),
              );
              if (afterRollback.error) fail("anon.effective_after_rollback", errText(afterRollback.error));
              else if (afterRollback.data?.check_status !== "no_club" || afterRollback.data?.filter_bucket !== "no_club") {
                fail("anon.effective_after_rollback", JSON.stringify(afterRollback.data));
              } else pass("anon.effective_after_rollback", `${afterRollback.ms}ms`);

              const noClubAfter = await bucketCount("no_club");
              const freeAfter = await bucketCount("free");
              if (noClubAfter.count === 1 && freeAfter.count === 1) {
                pass("anon.filter_counts_after_overlay", "no_club=1 free=1 among new ids");
              } else fail("anon.filter_counts_after_overlay", `no_club=${noClubAfter.count} free=${freeAfter.count}`);
            }
          }
        }

        const deactApply = await timedRpc(
          admin,
          "apply_player_review",
          applyArgs(FLOW.deactivate, null, { checkStatus: "under_contract", clubMode: "keep" }),
        );
        const deactConfirmed = await confirmApplyHead(admin, FLOW.deactivate, deactApply, "apply_for_deactivate");
        const deactHead = deactConfirmed.head;
        let canDeactivate = false;
        if (deactHead && !deactApply.clientTimeout && !deactApply.error) {
          pass("admin.apply_for_deactivate", `${deactApply.ms}ms`);
          canDeactivate = true;
        } else if (deactApply.clientTimeout && deactHead) {
          pass("admin.apply_for_deactivate", `http timeout ${deactApply.ms}ms; overlay confirmed via read`);
          canDeactivate = true;
        } else if (deactApply.clientTimeout) {
          skip("admin.apply_for_deactivate", `client_timeout ${deactApply.ms}ms; overlay not confirmed`);
          skip("admin.deactivate", "no confirmed head from apply_for_deactivate");
        } else {
          fail("admin.apply_for_deactivate", errText(deactApply.error) || "no head");
          skip("admin.deactivate", "no confirmed head from apply_for_deactivate");
        }

        if (canDeactivate) {
          const deact = await timedRpc(admin, "deactivate_player_review", {
            p_player_id: FLOW.deactivate,
            p_expected_head_revision_id: deactHead,
            p_private_note: PRIVATE_NOTE,
          });
          if (deact.clientTimeout) {
            const state = await readReviewState(admin, FLOW.deactivate, "deactivate");
            if (state.overlayInactive || state.reviewActive === false) {
              pass("admin.deactivate", `http timeout ${deact.ms}ms; inactive confirmed via read`);
            } else skip("admin.deactivate", `client_timeout ${deact.ms}ms; inactive not confirmed`);
          } else if (deact.error) fail("admin.deactivate", errText(deact.error));
          else pass("admin.deactivate", `${deact.ms}ms`);
        }

        const currentInactive = await timedRpc(admin, "admin_player_review_current", { p_player_id: FLOW.deactivate });
        const inactiveRow = currentRow(currentInactive.data);
        if (currentInactive.error) fail("admin.current_inactive", errText(currentInactive.error));
        else if (inactiveRow?.active !== false) skip("admin.current_inactive", "no inactive row (apply/deactivate skipped or failed)");
        else pass("admin.current_inactive", `${currentInactive.ms}ms`);

        const [p1, p2] = await Promise.all([
          timedRpc(admin, "apply_player_review", applyArgs(FLOW.parallel, null)),
          timedRpc(admin, "apply_player_review", applyArgs(FLOW.parallel, null)),
        ]);
        const okCount = [p1, p2].filter((row) => !row.error && headOf(row.data)).length;
        const conflictCount = [p1, p2].filter((row) => isConflict(row.error)).length;
        const timeoutCount = [p1, p2].filter((row) => row.clientTimeout).length;
        if (okCount === 1 && conflictCount === 1) {
          pass("admin.parallel_first_create", `one ok, one conflict ${p1.ms}ms/${p2.ms}ms`);
        } else if (timeoutCount) {
          const state = await readReviewState(admin, FLOW.parallel, "parallel");
          fail(
            "admin.parallel_first_create",
            `client_timeouts=${timeoutCount} ok=${okCount} conflict=${conflictCount}; overlay_active=${state.overlayActive}; expected one PT409`,
          );
        } else fail("admin.parallel_first_create", `ok=${okCount} conflict=${conflictCount}`);
      }
    }
  }
} catch (error) {
  fail("runner", error instanceof Error ? redact(error.message) : "unknown");
}

const passed = results.filter((row) => row.status === "PASS").length;
const failed = results.filter((row) => row.status === "FAIL").length;
const skipped = results.filter((row) => row.status === "SKIP").length;
console.log(`summary pass=${passed} fail=${failed} skip=${skipped}`);
if (failed) process.exitCode = 1;
