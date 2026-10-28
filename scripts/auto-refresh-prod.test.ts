import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { applyFetchSuccess } from "../src/lib/auto-refresh.ts";
import { workerEnv } from "../src/lib/auto-refresh-adapter.ts";
import { loadEnvFile } from "./auto-refresh-guard.mjs";
import {
  applyProdRefreshPublicEnv,
  applyProdRefreshServiceRole,
  assertProdRefreshEnv,
  prodRefreshIsDryRun,
  prodRefreshPersistAllowed,
  refuseProdStub,
} from "./auto-refresh-prod-guard.mjs";
import { saveValidatedProdSnapshot } from "./auto-refresh-prod-run.ts";
import {
  compareIncomingFetchedAt,
  PROD_SNAPSHOT_ORIGIN,
  validateSavedProdSnapshot,
  type SavedProdSnapshotFile,
} from "./auto-refresh-prod-saved.ts";

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nb-prod-refresh-"));
function writeRefresh(body: string) {
  fs.writeFileSync(path.join(tmp, ".env.prod-refresh.local"), body);
}
function writeAppLocal(body: string) {
  fs.writeFileSync(path.join(tmp, ".env.local"), body);
}

writeRefresh(`AUTO_REFRESH_PROD_HOST=prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=pub
SUPABASE_SERVICE_ROLE_KEY=svc-role
`);
assert.match(String(assertProdRefreshEnv(tmp).reason), /independent \.env\.local URL is missing|Cannot verify production host/);

writeAppLocal(`NEXT_PUBLIC_SUPABASE_URL=https://other-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=do-not-load
SUPABASE_SERVICE_ROLE_KEY=do-not-load
`);
assert.match(String(assertProdRefreshEnv(tmp).reason), /independent \.env\.local URL host/);

writeAppLocal(`NEXT_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
`);
const okHost = assertProdRefreshEnv(tmp);
assert.equal(okHost.ok, true);
assert.equal(okHost.refresh?.SUPABASE_SERVICE_ROLE_KEY, "svc-role");

writeRefresh(`AUTO_REFRESH_PROD_HOST=prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://other-project.supabase.co
`);
assert.equal(assertProdRefreshEnv(tmp).ok, false);
assert.match(String(assertProdRefreshEnv(tmp).reason), /does not match AUTO_REFRESH_PROD_HOST/);

writeRefresh(`AUTO_REFRESH_PROD_HOST=YOUR_PRODUCTION_PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PRODUCTION_PROJECT.supabase.co
`);
writeAppLocal(`NEXT_PUBLIC_SUPABASE_URL=https://YOUR_PRODUCTION_PROJECT.supabase.co
`);
assert.match(String(assertProdRefreshEnv(tmp).reason), /placeholder/);

const testEnv = loadEnvFile(path.join(process.cwd(), ".env.test.local"));
if (testEnv.NEXT_PUBLIC_SUPABASE_URL) {
  const testHost = new URL(testEnv.NEXT_PUBLIC_SUPABASE_URL).host;
  writeRefresh(`AUTO_REFRESH_PROD_HOST=${testHost}
NEXT_PUBLIC_SUPABASE_URL=https://${testHost}
`);
  writeAppLocal(`NEXT_PUBLIC_SUPABASE_URL=https://${testHost}
`);
  assert.match(String(assertProdRefreshEnv(tmp).reason), /matches the test project/);
}

const missing = fs.mkdtempSync(path.join(os.tmpdir(), "nb-prod-refresh-missing-"));
assert.match(String(assertProdRefreshEnv(missing).reason), /Missing \.env\.prod-refresh\.local/);

const env: NodeJS.ProcessEnv = {
  NEXT_PUBLIC_SUPABASE_URL: "https://from-env-local.supabase.co",
  SUPABASE_SERVICE_ROLE_KEY: "from-env-local",
};
applyProdRefreshPublicEnv(
  {
    NEXT_PUBLIC_SUPABASE_URL: "https://prod-project.supabase.co",
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pub",
  },
  env,
);
assert.equal(env.NEXT_PUBLIC_SUPABASE_URL, "https://prod-project.supabase.co");
assert.equal(env.SUPABASE_SERVICE_ROLE_KEY, undefined);

const withService: NodeJS.ProcessEnv = {};
assert.equal(
  applyProdRefreshServiceRole(
    {
      SUPABASE_SERVICE_ROLE_KEY: "svc-role",
      NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pub",
    },
    withService,
  ).ok,
  true,
);
assert.equal(withService.SUPABASE_SERVICE_ROLE_KEY, "svc-role");
assert.equal(
  applyProdRefreshServiceRole(
    { SUPABASE_SERVICE_ROLE_KEY: "pub", NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: "pub" },
    {},
  ).ok,
  false,
);

assert.equal(prodRefreshIsDryRun([]), true);
assert.equal(prodRefreshIsDryRun(["--dry-run"], { AUTO_REFRESH_PERSIST: "1" }), true);
assert.equal(prodRefreshPersistAllowed(["--confirm-production"], { AUTO_REFRESH_PERSIST: "1" }), true);
assert.equal(prodRefreshPersistAllowed([], { AUTO_REFRESH_PERSIST: "1" }), false);
assert.equal(
  prodRefreshPersistAllowed(["--confirm-production", "--dry-run"], { AUTO_REFRESH_PERSIST: "1" }),
  false,
);

assert.equal(refuseProdStub({}).ok, true);
assert.match(String(refuseProdStub({ AUTO_REFRESH_ALLOW_STUB: "1" }).reason), /forbidden/);
assert.match(String(refuseProdStub({ AUTO_REFRESH_STUB_JSON: "x.json" }).reason), /forbidden/);

const leaked = workerEnv({
  AUTO_REFRESH_LIVE: "1",
  SUPABASE_SERVICE_ROLE_KEY: "svc-role",
  NEXT_PUBLIC_SUPABASE_URL: "https://prod-project.supabase.co",
});
assert.equal(leaked.SUPABASE_SERVICE_ROLE_KEY, undefined);
assert.equal(leaked.NEXT_PUBLIC_SUPABASE_URL, undefined);

const dest = path.join(tmp, "saved");
const saved = saveValidatedProdSnapshot(
  "203496",
  {
    playerId: "203496",
    kind: "ok",
    stopBatch: false,
    attemptedAt: "2026-10-28T12:00:00.000Z",
    record: applyFetchSuccess(
      {
        id: "203496",
        isRetired: false,
        updatedAt: "2026-10-28T12:00:01.000Z",
        club: { id: "1", name: "Club", contractExpires: null, joined: null },
      },
      "2026-10-28T12:00:01.000Z",
    ),
  },
  dest,
);
assert.ok(saved);
const written = JSON.parse(fs.readFileSync(path.join(dest, "203496.json"), "utf8")) as SavedProdSnapshotFile;
assert.equal(written.simulated, false);
assert.equal(written.origin, PROD_SNAPSHOT_ORIGIN);
assert.equal(written.snapshot?.clubName, "Club");

const validSaved = validateSavedProdSnapshot(written, "203496");
assert.equal(validSaved.ok, true);

function savedFail(data: SavedProdSnapshotFile, id: string, pattern: RegExp) {
  const result = validateSavedProdSnapshot(data, id);
  assert.equal(result.ok, false);
  if (!result.ok) assert.match(result.reason, pattern);
}
savedFail({ ...written, simulated: true }, "203496", /Simulated/);
savedFail(written, "34130", /does not match --ids/);
savedFail({ ...written, origin: "live worker + validateListingForPlayer" }, "203496", /origin/);
savedFail(
  {
    ...written,
    snapshot: written.snapshot ? { ...written.snapshot, fetchedAt: "" } : null,
  },
  "203496",
  /missing fetchedAt/,
);

function compareOk(incoming: string, stored: string | null, action: "write" | "already_current") {
  const result = compareIncomingFetchedAt(incoming, stored);
  assert.equal(result.ok, true);
  if (result.ok) assert.equal(result.action, action);
}
compareOk("2026-10-28T12:00:01.000Z", null, "write");
compareOk("2026-10-28T12:00:01.000Z", "2026-10-28T12:00:01", "already_current");
compareOk("2026-10-29T12:00:01.000Z", "2026-10-28T12:00:01.000Z", "write");
const olderThanStored = compareIncomingFetchedAt("2026-10-27T12:00:01.000Z", "2026-10-28T12:00:01.000Z");
assert.equal(olderThanStored.ok, false);
if (!olderThanStored.ok) assert.match(olderThanStored.reason, /older/);

writeRefresh(`AUTO_REFRESH_PROD_HOST=prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=pub
SUPABASE_SERVICE_ROLE_KEY=svc-role
`);
writeAppLocal(`NEXT_PUBLIC_SUPABASE_URL=https://prod-project.supabase.co
`);

function spawnProd(script: string, args: string[], extraEnv: NodeJS.ProcessEnv) {
  return spawnSync("npx.cmd", ["tsx", script, ...args], {
    encoding: "utf8",
    cwd: process.cwd(),
    env: { ...process.env, AUTO_REFRESH_PROD_ENV_ROOT: tmp, ...extraEnv },
    windowsHide: true,
    shell: true,
  });
}

const disabled = spawnProd("scripts/auto-refresh-prod-run.ts", ["--ids", "203496", "--max", "1"], {
  AUTO_REFRESH_LIVE: "0",
  AUTO_REFRESH_ENABLE_FETCH: "0",
});
assert.equal(disabled.status, 2);
assert.match(`${disabled.stdout}${disabled.stderr}`, /disabled/);

const noConfirm = spawnProd("scripts/auto-refresh-prod-run.ts", ["--ids", "203496", "--max", "1"], {
  AUTO_REFRESH_LIVE: "1",
  AUTO_REFRESH_ENABLE_FETCH: "1",
  AUTO_REFRESH_PERSIST: "1",
  AUTO_REFRESH_PYTHON: "python",
});
assert.equal(noConfirm.status, 2);
assert.match(`${noConfirm.stdout}${noConfirm.stderr}`, /confirm-production/);

const stubbed = spawnProd("scripts/auto-refresh-prod-run.ts", ["--ids", "203496", "--max", "1", "--dry-run"], {
  AUTO_REFRESH_LIVE: "1",
  AUTO_REFRESH_ENABLE_FETCH: "1",
  AUTO_REFRESH_ALLOW_STUB: "1",
  AUTO_REFRESH_STUB_JSON: "scripts/fixtures/auto-refresh/203496-fekir.json",
});
assert.equal(stubbed.status, 2);
assert.match(`${stubbed.stdout}${stubbed.stderr}`, /forbidden/);

const tooMany = spawnProd(
  "scripts/auto-refresh-prod-run.ts",
  ["--ids", "203496,34130,14086,203853,617060,9900211", "--max", "6", "--dry-run"],
  {
    AUTO_REFRESH_LIVE: "1",
    AUTO_REFRESH_ENABLE_FETCH: "1",
    AUTO_REFRESH_PYTHON: "python",
  },
);
assert.equal(tooMany.status, 2);
assert.match(`${tooMany.stdout}${tooMany.stderr}`, /Batch limited to 5|Explicit --ids/);

const snapshotPath = path.join(dest, "203496.json");
const persistEnv: NodeJS.ProcessEnv = {
  AUTO_REFRESH_PERSIST: "0",
  AUTO_REFRESH_DRY_RUN: "1",
  AUTO_REFRESH_SAVED_SKIP_STORE_READ: "1",
};

const simulatedPath = path.join(tmp, "simulated.json");
fs.writeFileSync(simulatedPath, `${JSON.stringify({ ...written, simulated: true }, null, 2)}\n`);
const simulated = spawnProd(
  "scripts/auto-refresh-prod-persist-saved.ts",
  ["--ids", "203496", "--max", "1", "--snapshot", simulatedPath, "--dry-run"],
  persistEnv,
);
assert.equal(simulated.status, 2);
assert.match(`${simulated.stdout}${simulated.stderr}`, /Simulated/);

const idMismatch = spawnProd(
  "scripts/auto-refresh-prod-persist-saved.ts",
  ["--ids", "34130", "--max", "1", "--snapshot", snapshotPath, "--dry-run"],
  persistEnv,
);
assert.equal(idMismatch.status, 2);
assert.match(`${idMismatch.stdout}${idMismatch.stderr}`, /does not match --ids/);

const older = spawnProd(
  "scripts/auto-refresh-prod-persist-saved.ts",
  ["--ids", "203496", "--max", "1", "--snapshot", snapshotPath, "--dry-run"],
  { ...persistEnv, AUTO_REFRESH_SAVED_STORED_FETCHED_AT: "2026-10-29T00:00:00.000Z" },
);
assert.equal(older.status, 2);
assert.match(`${older.stdout}${older.stderr}`, /older than the stored snapshot/);

const persistNoConfirm = spawnProd(
  "scripts/auto-refresh-prod-persist-saved.ts",
  ["--ids", "203496", "--max", "1", "--snapshot", snapshotPath],
  { AUTO_REFRESH_PERSIST: "1", AUTO_REFRESH_SAVED_SKIP_STORE_READ: "1" },
);
assert.equal(persistNoConfirm.status, 2);
assert.match(`${persistNoConfirm.stdout}${persistNoConfirm.stderr}`, /confirm-production/);

const dryPersist = spawnProd(
  "scripts/auto-refresh-prod-persist-saved.ts",
  ["--ids", "203496", "--max", "1", "--snapshot", snapshotPath, "--dry-run"],
  persistEnv,
);
assert.equal(dryPersist.status, 0, `${dryPersist.stdout}${dryPersist.stderr}`);
assert.match(dryPersist.stdout, /"persisted": false/);
assert.match(dryPersist.stdout, /"fetch": false/);

console.log("auto-refresh production runner checks passed (no network, no production writes)");
