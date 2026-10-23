/**
 * After PT409 patch on TEST: stale head and parallel first-create.
 * No write retries. Timeout is FAIL, not a passing security check.
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const STALE_ID = "9900111";
const PARALLEL_ID = "9900112";
const FETCH_MS = 8000;
const SOURCE = "https://example.com/nextbosman-test-review";
const PRIVATE_NOTE = "conflict-probe-private";

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
  return String(value ?? "")
    .replace(/bearer\s+[a-z0-9._-]+/gi, "bearer [redacted]")
    .replace(/eyj[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+/gi, "[jwt]");
}

function applyArgs(playerId, expectedHead) {
  return {
    p_player_id: playerId,
    p_check_status: "no_club",
    p_club_mode: "none",
    p_club_value: null,
    p_contract_mode: "unknown",
    p_contract_value: null,
    p_source_url: SOURCE,
    p_event_at: null,
    p_public_note: "conflict probe",
    p_private_note: PRIVATE_NOTE,
    p_expected_head_revision_id: expectedHead,
  };
}

let httpCalls = 0;
function fetchOnce(input, init = {}) {
  httpCalls += 1;
  let pathOnly = String(input);
  try {
    const parsed = new URL(input, "https://invalid.example");
    pathOnly = `${init.method || "GET"} ${parsed.pathname}`;
  } catch {
    pathOnly = String(init.method || "GET");
  }
  console.log(`HTTP #${httpCalls} ${pathOnly}`);
  const controller = new AbortController();
  const timer = setTimeout(() => {
    console.log(`HTTP #${httpCalls} client abort after ${FETCH_MS}ms`);
    controller.abort();
  }, FETCH_MS);
  timer.unref?.();
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function isTimeout(error) {
  return /abort/i.test(`${error?.name ?? ""} ${error?.message ?? ""}`);
}

function isConflict(error, status) {
  const code = String(error?.code ?? "");
  const text = `${code} ${error?.message ?? ""}`.toLowerCase();
  return status === 409 || code === "PT409" || text.includes("pt409") || text.includes("revision_conflict");
}

const results = [];
function record(status, name, detail) {
  results.push({ status, name, detail });
  console.log(`${status}\t${name}${detail ? ` — ${detail}` : ""}`);
}

async function main() {
  const root = process.cwd();
  const test = loadEnvFile(path.join(root, ".env.test.local"));
  const prod = loadEnvFile(path.join(root, ".env.local"));
  const users = loadEnvFile(path.join(root, ".env.test.users.local"));
  if (urlHost(test.NEXT_PUBLIC_SUPABASE_URL) === urlHost(prod.NEXT_PUBLIC_SUPABASE_URL)) {
    console.error("ABORT: test URL host matches production.");
    return 1;
  }
  const url = test.NEXT_PUBLIC_SUPABASE_URL;
  const key = test.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || test.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key || !users.TEST_ADMIN_PASSWORD) {
    console.error("ABORT: test URL, key, or admin password missing.");
    return 1;
  }

  const anon = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchOnce },
  });
  const authClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchOnce },
  });
  const signed = await authClient.auth.signInWithPassword({
    email: users.TEST_ADMIN_EMAIL || "test-admin@example.com",
    password: users.TEST_ADMIN_PASSWORD,
  });
  if (!signed.data.session) {
    console.error("Admin sign-in failed (secret not printed).");
    return 1;
  }
  const token = signed.data.session.access_token;
  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchOnce, headers: { Authorization: `Bearer ${token}` } },
  });

  async function rpcApply(args) {
    const started = Date.now();
    try {
      const response = await fetchOnce(new URL("/rest/v1/rpc/apply_player_review", url), {
        method: "POST",
        headers: {
          apikey: key,
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(args),
      });
      const text = await response.text();
      let data = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = null;
      }
      const error = response.ok
        ? null
        : { code: data?.code, message: data?.message || text.slice(0, 180) };
      return { status: response.status, data, error, ms: Date.now() - started, timeout: false };
    } catch (error) {
      return { status: null, data: null, error, ms: Date.now() - started, timeout: isTimeout(error) };
    }
  }

  const historyBefore = await admin.rpc("admin_player_review_history", { p_player_id: STALE_ID });
  const beforeCount = Array.isArray(historyBefore.data) ? historyBefore.data.length : 0;
  const currentBefore = await admin.rpc("admin_player_review_current", { p_player_id: STALE_ID });
  const rowBefore = Array.isArray(currentBefore.data) ? currentBefore.data[0] : currentBefore.data;
  const headBefore = rowBefore?.head_revision_id ?? null;
  if (!headBefore) {
    record("FAIL", "stale.head_present", "9900111 has no overlay head to conflict against");
  } else {
    const stale = await rpcApply(applyArgs(STALE_ID, null));
    if (stale.timeout) {
      record("FAIL", "stale.http_409", `client_timeout ${stale.ms}ms; expected HTTP 409 PT409`);
    } else if (stale.status === 409 && isConflict(stale.error, stale.status)) {
      record("PASS", "stale.http_409", `status=409 code=${stale.error?.code ?? "?"} ${stale.ms}ms`);
    } else {
      record("FAIL", "stale.http_409", `status=${stale.status} code=${stale.error?.code ?? "ok"} ${stale.ms}ms ${redact(stale.error?.message).slice(0, 120)}`);
    }

    const historyAfter = await admin.rpc("admin_player_review_history", { p_player_id: STALE_ID });
    const afterCount = Array.isArray(historyAfter.data) ? historyAfter.data.length : -1;
    const currentAfter = await admin.rpc("admin_player_review_current", { p_player_id: STALE_ID });
    const rowAfter = Array.isArray(currentAfter.data) ? currentAfter.data[0] : currentAfter.data;
    if (afterCount === beforeCount && rowAfter?.head_revision_id === headBefore) {
      record("PASS", "stale.no_data_change", `revisions=${afterCount} head unchanged`);
    } else {
      record("FAIL", "stale.no_data_change", `revisions ${beforeCount}->${afterCount} head changed=${rowAfter?.head_revision_id !== headBefore}`);
    }
  }

  const parallelState = await anon.from("players_effective").select("id, review_active").eq("id", PARALLEL_ID).maybeSingle();
  if (!parallelState.data) {
    record("FAIL", "parallel.player", "9900112 missing");
  } else if (parallelState.data.review_active === true) {
    record("FAIL", "parallel.player", "9900112 already has overlay; not overwriting");
  } else {
    const histBeforeP = await admin.rpc("admin_player_review_history", { p_player_id: PARALLEL_ID });
    const countBeforeP = Array.isArray(histBeforeP.data) ? histBeforeP.data.length : 0;
    const [a, b] = await Promise.all([
      rpcApply(applyArgs(PARALLEL_ID, null)),
      rpcApply(applyArgs(PARALLEL_ID, null)),
    ]);
    const ok = [a, b].filter((row) => row.status === 200 && row.data?.head_revision_id).length;
    const conflict = [a, b].filter((row) => isConflict(row.error, row.status)).length;
    const timeouts = [a, b].filter((row) => row.timeout).length;
    if (ok === 1 && conflict === 1 && timeouts === 0) {
      record("PASS", "parallel.one_ok_one_409", `status ${a.status}/${b.status} ${a.ms}ms/${b.ms}ms`);
    } else {
      record("FAIL", "parallel.one_ok_one_409", `ok=${ok} conflict=${conflict} timeouts=${timeouts} status=${a.status}/${b.status} ${a.ms}ms/${b.ms}ms`);
    }
    const histAfterP = await admin.rpc("admin_player_review_history", { p_player_id: PARALLEL_ID });
    const countAfterP = Array.isArray(histAfterP.data) ? histAfterP.data.length : -1;
    if (ok === 1 && countAfterP === countBeforeP + 1) {
      record("PASS", "parallel.one_revision", `revisions ${countBeforeP}->${countAfterP}`);
    } else if (timeouts) {
      record("FAIL", "parallel.one_revision", `timeout; revisions ${countBeforeP}->${countAfterP}`);
    } else {
      record("FAIL", "parallel.one_revision", `revisions ${countBeforeP}->${countAfterP} ok=${ok}`);
    }
  }

  const passed = results.filter((row) => row.status === "PASS").length;
  const failed = results.filter((row) => row.status === "FAIL").length;
  console.log(`summary pass=${passed} fail=${failed}`);
  return failed ? 1 : 0;
}

process.exitCode = await main();
