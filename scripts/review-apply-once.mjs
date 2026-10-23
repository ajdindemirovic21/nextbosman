/**
 * One controlled apply_player_review on TEST player 9900099.
 * No retries. After client timeout, only reads. Never service-role.
 */
import fs from "fs";
import path from "path";
import { createClient } from "@supabase/supabase-js";

const PLAYER_ID = "9900099";
const FETCH_MS = 30000;
const SOURCE = "https://example.com/nextbosman-test-review";
const PRIVATE_NOTE = "isolated-apply-private";

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
  const isRpc = /\/rpc\//.test(pathOnly);
  console.log(`HTTP #${httpCalls} ${pathOnly}${isRpc ? " (rpc)" : ""}`);
  const controller = new AbortController();
  const timer = setTimeout(() => {
    console.log(`HTTP #${httpCalls} client abort after ${FETCH_MS}ms`);
    controller.abort();
  }, FETCH_MS);
  timer.unref?.();
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
}

function isClientTimeout(error) {
  const text = `${error?.name ?? ""} ${error?.message ?? ""}`;
  return /abort/i.test(text) || error?.name === "AbortError";
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
  if (!url || !key) {
    console.error("ABORT: test URL or publishable key missing.");
    return 1;
  }

  const args = {
    p_player_id: PLAYER_ID,
    p_check_status: "no_club",
    p_club_mode: "none",
    p_club_value: null,
    p_contract_mode: "unknown",
    p_contract_value: null,
    p_source_url: SOURCE,
    p_event_at: null,
    p_public_note: "isolated apply public note",
    p_private_note: PRIVATE_NOTE,
    p_expected_head_revision_id: null,
  };
  const body = JSON.stringify(args);
  const parsedBody = JSON.parse(body);

  console.log("RPC args keys:", Object.keys(parsedBody).join(","));
  console.log(
    "RPC null keys:",
    Object.entries(parsedBody)
      .filter(([, v]) => v == null)
      .map(([k]) => k)
      .join(",") || "(none)",
  );
  console.log("JSON keeps p_expected_head_revision_id null:", parsedBody.p_expected_head_revision_id === null);
  console.log(`Client abort after ${FETCH_MS}ms; apply POST will not be retried.`);
  console.log("While this waits, run supabase/sql/test-project-sessions-during-apply.sql in the TEST SQL editor.");

  const anon = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchOnce },
  });

  const existing = await anon
    .from("players_effective")
    .select("id, review_active, filter_bucket, check_status")
    .eq("id", PLAYER_ID)
    .maybeSingle();
  if (existing.error) {
    console.error("READ players_effective error:", redact(existing.error.message));
    return 1;
  }
  if (!existing.data) {
    console.error(
      `Player ${PLAYER_ID} is missing. Run supabase/sql/test-project-isolated-player.sql in the TEST SQL editor, then re-run this script.`,
    );
    return 2;
  }
  console.log(
    `Pre-apply read: id=${existing.data.id} review_active=${existing.data.review_active} bucket=${existing.data.filter_bucket} check_status=${existing.data.check_status}`,
  );
  if (existing.data.review_active === true) {
    console.error("Isolated player already has an active overlay. Aborting without apply.");
    return 3;
  }

  if (!users.TEST_ADMIN_PASSWORD) {
    console.error("Fill TEST_ADMIN_PASSWORD in .env.test.users.local");
    return 1;
  }

  const authClient = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: fetchOnce },
  });
  const signStarted = Date.now();
  const signed = await authClient.auth.signInWithPassword({
    email: users.TEST_ADMIN_EMAIL || "test-admin@example.com",
    password: users.TEST_ADMIN_PASSWORD,
  });
  console.log(`signIn ${Date.now() - signStarted}ms code=${signed.error?.code ?? "ok"}`);
  if (!signed.data.session) {
    console.error("Admin sign-in failed (secret not printed).");
    return 1;
  }

  const admin = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: {
      fetch: fetchOnce,
      headers: { Authorization: `Bearer ${signed.data.session.access_token}` },
    },
  });

  const applyStarted = Date.now();
  const httpBeforeApply = httpCalls;
  let apply = { data: null, error: null, status: null };
  try {
    const response = await fetchOnce(new URL("/rest/v1/rpc/apply_player_review", url), {
      method: "POST",
      headers: {
        apikey: key,
        Authorization: `Bearer ${signed.data.session.access_token}`,
        "Content-Type": "application/json",
      },
      body,
    });
    const text = await response.text();
    let data = null;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      data = null;
    }
    if (!response.ok) {
      apply = {
        data: null,
        status: response.status,
        error: {
          name: "PostgrestError",
          code: data?.code,
          message: data?.message || text.slice(0, 180),
        },
      };
    } else {
      apply = { data, status: response.status, error: null };
    }
  } catch (error) {
    apply = { data: null, status: null, error };
  }
  const applyMs = Date.now() - applyStarted;
  const applyHttp = httpCalls - httpBeforeApply;
  const clientTimeout = isClientTimeout(apply.error);
  console.log(
    `APPLY done ms=${applyMs} clientTimeout=${clientTimeout} applyHttp=${applyHttp} status=${apply.status ?? "none"} code=${apply.error?.code ?? "ok"} head=${apply.data?.head_revision_id ? "yes" : "no"} message=${redact(apply.error?.message).slice(0, 180) || "none"}`,
  );
  console.log("No second apply will be sent.");

  await new Promise((resolve) => setTimeout(resolve, 2000));

  let afterAnon;
  try {
    afterAnon = await anon
      .from("players_effective")
      .select("id, review_active, filter_bucket, check_status, public_note")
      .eq("id", PLAYER_ID)
      .maybeSingle();
  } catch (error) {
    afterAnon = { data: null, error };
  }
  console.log(
    `Post-apply anon read: error=${afterAnon.error ? redact(afterAnon.error.message).slice(0, 120) : "none"} review_active=${afterAnon.data?.review_active} bucket=${afterAnon.data?.filter_bucket} check_status=${afterAnon.data?.check_status}`,
  );

  let current;
  try {
    current = await admin.rpc("admin_player_review_current", { p_player_id: PLAYER_ID });
  } catch (error) {
    current = { data: null, error };
  }
  const row = Array.isArray(current.data) ? current.data[0] : current.data;
  console.log(
    `Post-apply admin current: error=${current.error ? redact(current.error.message).slice(0, 120) : "none"} active=${row?.active ?? "none"} has_head=${row?.head_revision_id ? "yes" : "no"}`,
  );

  if (clientTimeout && row?.active === true) {
    console.log("CONCLUSION: client timed out; server write is present.");
  } else if (clientTimeout && !row) {
    console.log("CONCLUSION: client timed out; server has no overlay row yet (or RPC still running).");
  } else if (!apply.error && row?.active === true) {
    console.log("CONCLUSION: client received success; overlay is active.");
  }
  return 0;
}

process.exitCode = await main();
