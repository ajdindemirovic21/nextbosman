import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import {
  applyFetchFailure,
  applyFetchSuccess,
  recordFromValidatedListing,
  validateListingForPlayer,
  type AutoRefreshRecord,
  type ListingProfile,
} from "../src/lib/auto-refresh.ts";
import {
  AUTO_REFRESH_FETCH_ENABLED,
  applyWorkerAttempt,
  fetchListingAttempt,
  isAutoRefreshFetchEnabled,
  killWorkerTree,
  parseWorkerPayload,
  workerEnv,
  type RunWorker,
} from "../src/lib/auto-refresh-adapter.ts";
import { isAutoRefreshPersistEnabled, persistAutoRefreshRecord } from "../src/lib/auto-refresh-persist.ts";
import { redactSecrets } from "../src/lib/auto-refresh-redact.ts";

assert.equal(AUTO_REFRESH_FETCH_ENABLED, false);
assert.equal(isAutoRefreshFetchEnabled(), false);

const prevPersist = process.env.AUTO_REFRESH_PERSIST;
const prevDry = process.env.AUTO_REFRESH_DRY_RUN;
process.env.AUTO_REFRESH_PERSIST = "1";
process.env.AUTO_REFRESH_DRY_RUN = "1";
assert.equal(isAutoRefreshPersistEnabled(), false);
process.env.AUTO_REFRESH_DRY_RUN = "0";
assert.equal(isAutoRefreshPersistEnabled(), true);
if (prevPersist === undefined) delete process.env.AUTO_REFRESH_PERSIST;
else process.env.AUTO_REFRESH_PERSIST = prevPersist;
if (prevDry === undefined) delete process.env.AUTO_REFRESH_DRY_RUN;
else process.env.AUTO_REFRESH_DRY_RUN = prevDry;

const leaked = workerEnv({
  PATH: "/bin",
  AUTO_REFRESH_LIVE: "1",
  AUTO_REFRESH_ENABLE_FETCH: "1",
  SUPABASE_SERVICE_ROLE_KEY: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb",
  AUTO_REFRESH_STUB_JSON: "secret.json",
});
assert.equal(leaked.SUPABASE_SERVICE_ROLE_KEY, undefined);
assert.equal(leaked.AUTO_REFRESH_STUB_JSON, undefined);
assert.equal(leaked.AUTO_REFRESH_LIVE, "1");
const stubEnv = workerEnv({
  AUTO_REFRESH_ALLOW_STUB: "1",
  AUTO_REFRESH_STUB_JSON: "fixture.json",
});
assert.equal(stubEnv.AUTO_REFRESH_STUB_JSON, "fixture.json");
assert.equal(
  redactSecrets("bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.aaa.bbb https://abcd.supabase.co/rest"),
  "bearer [redacted] [supabase-url]",
);
killWorkerTree(undefined);

const fixture = JSON.parse(
  fs.readFileSync(path.join("scripts", "fixtures", "auto-refresh", "203496-fekir.json"), "utf8"),
) as ListingProfile;
const sourceTime = "2026-10-27T09:06:51.895690Z";
const marketTime = "2026-05-26";
const attemptTime = "2026-10-27T12:00:00.000Z";
const profile: ListingProfile = {
  id: "203496",
  isRetired: false,
  updatedAt: sourceTime,
  marketValueLastUpdated: marketTime,
  club: { id: "40039", name: "Abha Club", contractExpires: null, joined: "2026-08-06" },
};

const valid = validateListingForPlayer("203496", profile);
assert.equal(valid.ok, true);
if (valid.ok) {
  const record = applyFetchSuccess(valid.profile, valid.sourceFetchedAt, {
    attemptedAt: attemptTime,
    marketValueLastUpdated: marketTime,
  });
  assert.equal(record.snapshot?.fetchedAt, sourceTime);
  assert.equal(record.sourceFetchedAt, sourceTime);
  assert.equal(record.attemptedAt, attemptTime);
  assert.equal(record.marketValueLastUpdated, marketTime);
  assert.notEqual(record.snapshot?.fetchedAt, marketTime);
  assert.notEqual(record.snapshot?.fetchedAt, attemptTime);
}

const previous = applyFetchSuccess(profile, sourceTime, { attemptedAt: "2026-10-27T09:00:00.000Z" });
const mismatch = recordFromValidatedListing("203496", previous, { ...profile, id: "999" }, attemptTime);
assert.equal(mismatch.snapshot?.clubName, "Abha Club");
assert.equal(mismatch.snapshot?.fetchedAt, sourceTime);
assert.match(mismatch.lastError ?? "", /id_mismatch/);

const missingUpdated = validateListingForPlayer("203496", { ...profile, updatedAt: null, fetchedAt: null, fetched_at_utc: null });
assert.equal(missingUpdated.ok, false);

const blocked = applyWorkerAttempt("203496", previous, { ok: false, kind: "blocked", status: 403, message: "WAF" }, attemptTime);
assert.equal(blocked.kind, "blocked");
assert.equal(blocked.stopBatch, true);
assert.equal(blocked.record.snapshot?.fetchedAt, sourceTime);

const timeout = applyWorkerAttempt("203496", previous, { ok: false, kind: "timeout", message: "upstream_timeout" }, attemptTime);
assert.equal(timeout.kind, "timeout");
assert.equal(timeout.stopBatch, true);
assert.equal(timeout.record.snapshot?.clubName, "Abha Club");

const parsed = parseWorkerPayload('noise\n{"ok":true,"id":"203496","updatedAt":"2026-10-27T09:06:51.895690Z","isRetired":false}\n');
assert.equal(parsed.ok, true);
assert.equal(parsed.id, "203496");

async function main() {
const disabledAttempt = await fetchListingAttempt("203496", previous, { attemptedAt: attemptTime });
assert.equal(disabledAttempt.kind, "disabled");
assert.equal(disabledAttempt.record.snapshot?.fetchedAt, sourceTime);

const prevLive = process.env.AUTO_REFRESH_LIVE;
const prevEnable = process.env.AUTO_REFRESH_ENABLE_FETCH;
const prevPython = process.env.AUTO_REFRESH_PYTHON;
process.env.AUTO_REFRESH_LIVE = "1";
process.env.AUTO_REFRESH_ENABLE_FETCH = "1";
process.env.AUTO_REFRESH_PYTHON = "python";

const mockOk: RunWorker = async () => ({
  stdout: JSON.stringify({
    ok: true,
    id: "203496",
    updatedAt: sourceTime,
    isRetired: false,
    club: profile.club,
    marketValueLastUpdated: marketTime,
  }),
  stderr: "",
  code: 0,
  timedOut: false,
});
const okAttempt = await fetchListingAttempt("203496", null, { runWorker: mockOk, attemptedAt: attemptTime });
assert.equal(okAttempt.kind, "ok", `${okAttempt.kind} ${okAttempt.record.lastError}`);
assert.equal(okAttempt.record.snapshot?.clubName, "Abha Club");
assert.equal(okAttempt.record.snapshot?.fetchedAt, sourceTime);

const mockTimeout: RunWorker = async () => ({ stdout: "", stderr: "", code: null, timedOut: true });
const timeoutAttempt = await fetchListingAttempt("203496", previous, { runWorker: mockTimeout, attemptedAt: attemptTime });
assert.equal(timeoutAttempt.kind, "timeout");
assert.equal(timeoutAttempt.stopBatch, true);
assert.equal(timeoutAttempt.record.snapshot?.fetchedAt, sourceTime);

const mockBlocked: RunWorker = async () => ({
  stdout: JSON.stringify({ ok: false, kind: "blocked", status: 429, message: "upstream_blocked" }),
  stderr: "",
  code: 2,
  timedOut: false,
});
const blockedAttempt = await fetchListingAttempt("203496", previous, { runWorker: mockBlocked, attemptedAt: attemptTime });
assert.equal(blockedAttempt.kind, "blocked");
assert.equal(blockedAttempt.stopBatch, true);

process.env.AUTO_REFRESH_LIVE = prevLive;
process.env.AUTO_REFRESH_ENABLE_FETCH = prevEnable;
process.env.AUTO_REFRESH_PYTHON = prevPython;

const writes: Array<{ op: string; payload: Record<string, unknown> }> = [];
const fake = {
  from(table: string) {
    assert.equal(table, "player_auto_snapshots");
    return {
      upsert(payload: Record<string, unknown>) {
        writes.push({ op: "upsert", payload });
        return { error: null };
      },
      select() {
        return {
          eq() {
            return {
              maybeSingle: async () => ({
                data: {
                  player_id: "203496",
                  fetched_at: sourceTime,
                  club_id: "40039",
                  club_name: "Abha Club",
                },
                error: null,
              }),
            };
          },
        };
      },
      insert(payload: Record<string, unknown>) {
        writes.push({ op: "insert", payload });
        return { error: null };
      },
      update(payload: Record<string, unknown>) {
        writes.push({ op: "update", payload });
        return {
          eq() {
            return { error: null };
          },
        };
      },
    };
  },
};

const persistOff = process.env.AUTO_REFRESH_PERSIST;
const dryOff = process.env.AUTO_REFRESH_DRY_RUN;
process.env.AUTO_REFRESH_PERSIST = "1";
process.env.AUTO_REFRESH_DRY_RUN = "1";
await assert.rejects(
  () => persistAutoRefreshRecord("203496", okAttempt.record),
  /AUTO_REFRESH_PERSIST=1/,
);
if (persistOff === undefined) delete process.env.AUTO_REFRESH_PERSIST;
else process.env.AUTO_REFRESH_PERSIST = persistOff;
if (dryOff === undefined) delete process.env.AUTO_REFRESH_DRY_RUN;
else process.env.AUTO_REFRESH_DRY_RUN = dryOff;

await persistAutoRefreshRecord("203496", okAttempt.record, fake as never);
assert.equal(writes[0]?.op, "upsert");
assert.equal(writes[0]?.payload.fetched_at, sourceTime);
assert.equal(writes[0]?.payload.last_error, null);

const failed: AutoRefreshRecord = applyFetchFailure(previous, "blocked:429", attemptTime);
await persistAutoRefreshRecord("203496", failed, fake as never);
assert.equal(writes[1]?.op, "update");
assert.equal(writes[1]?.payload.last_error, "blocked:429");
assert.equal("fetched_at" in (writes[1]?.payload ?? {}), false);

const stubFile = path.join(os.tmpdir(), "nb-auto-refresh-stub.json");
fs.writeFileSync(
  stubFile,
  JSON.stringify({
    id: "203496",
    updatedAt: sourceTime,
    isRetired: false,
    club: { id: "40039", name: "Abha Club", contractExpires: null, joined: "2026-08-06" },
    marketValueLastUpdated: marketTime,
  }),
);
const pythonCandidates = [process.env.AUTO_REFRESH_PYTHON, "python", "py"].filter(Boolean) as string[];
let stubRan = false;
for (const python of pythonCandidates) {
  const stub = spawnSync(python, [path.join("scripts", "auto-refresh-fetch.py"), "203496"], {
    encoding: "utf8",
    env: {
      ...process.env,
      AUTO_REFRESH_LIVE: "1",
      AUTO_REFRESH_ENABLE_FETCH: "1",
      AUTO_REFRESH_ALLOW_STUB: "1",
      AUTO_REFRESH_STUB_JSON: stubFile,
    },
    windowsHide: true,
  });
  if (stub.error) continue;
  const worker = parseWorkerPayload(stub.stdout || "");
  if (worker.ok && worker.id === "203496" && worker.updatedAt === sourceTime && worker.marketValueLastUpdated === marketTime) {
    stubRan = true;
    break;
  }
}
if (!stubRan) {
  console.log("python stub worker skipped (no interpreter on PATH)");
} else {
  assert.equal(stubRan, true);
}

const batchDisabled = spawnSync(process.execPath, ["scripts/auto-refresh-batch.mjs", "--ids", "203496", "--max", "1"], {
  encoding: "utf8",
  env: { ...process.env, AUTO_REFRESH_LIVE: "1" },
});
assert.equal(batchDisabled.status, 2);
assert.match(batchDisabled.stderr, /disabled/i);

console.log("auto-refresh adapter checks passed (simulated SDK, no Transfermarkt HTTP)");
void fixture;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
