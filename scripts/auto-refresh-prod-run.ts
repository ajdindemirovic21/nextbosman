/**
 * Manual production listing refresh. Separate from the test runner.
 * Default: fetch disabled, dry-run, no persist.
 *
 * Allowed source use is not yet settled. Do not treat the SDK MIT license as Transfermarkt data rights.
 *
 * Dry-run (no database write):
 *
 *   Set-Location <repo>
 *   $env:AUTO_REFRESH_LIVE = "1"
 *   $env:AUTO_REFRESH_ENABLE_FETCH = "1"
 *   $env:AUTO_REFRESH_DRY_RUN = "1"
 *   $env:AUTO_REFRESH_TIMEOUT_MS = "45000"
 *   $env:AUTO_REFRESH_TIMEOUT_SEC = "45"
 *   $env:AUTO_REFRESH_PYTHON = "C:\Users\Korisnik\eval-transfermarkt-api\.venv\Scripts\python.exe"
 *   Remove-Item Env:AUTO_REFRESH_PERSIST -ErrorAction SilentlyContinue
 *   Remove-Item Env:AUTO_REFRESH_ALLOW_STUB, Env:AUTO_REFRESH_STUB_JSON -ErrorAction SilentlyContinue
 *   npx.cmd tsx scripts\auto-refresh-prod-run.ts --ids 203496 --max 1 --dry-run
 *
 * After reviewing scripts\fixtures\auto-refresh\prod-saved\<id>.json, persist without a new fetch:
 * see scripts\auto-refresh-prod-persist-saved.ts
 *
 * Fetch+persist in the same session still requires --confirm-production and AUTO_REFRESH_PERSIST=1.
 * Prefer persist-saved after review instead of fetching again.
 */
import fs from "node:fs";
import path from "node:path";
import {
  AUTO_REFRESH_CONCURRENCY,
  AUTO_REFRESH_MAX_BATCH,
  fetchListingAttempt,
  isAutoRefreshFetchEnabled,
  workerEnv,
} from "../src/lib/auto-refresh-adapter.ts";
import { persistAutoRefreshRecord } from "../src/lib/auto-refresh-persist.ts";
import { redactSecrets } from "../src/lib/auto-refresh-redact.ts";
import { isPlayerId, uniquePlayerIds } from "../src/lib/player-ids.ts";
import {
  applyProdRefreshPublicEnv,
  applyProdRefreshServiceRole,
  assertProdRefreshEnv,
  prodRefreshIsDryRun,
  prodRefreshPersistAllowed,
  prodRefreshRoot,
  refuseProdStub,
} from "./auto-refresh-prod-guard.mjs";

const SNAPSHOT_DIR = path.join("scripts", "fixtures", "auto-refresh", "prod-saved");

function parseFlag(argv: string[], name: string) {
  const eq = argv.find((arg) => arg.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const idx = argv.indexOf(name);
  if (idx >= 0) return argv[idx + 1] ?? "";
  return "";
}

function fail(payload: Record<string, unknown>, code = 2): never {
  console.error(JSON.stringify(payload));
  process.exit(code);
}

export function saveValidatedProdSnapshot(
  playerId: string,
  attempt: Awaited<ReturnType<typeof fetchListingAttempt>>,
  destDir = path.join(prodRefreshRoot(), SNAPSHOT_DIR),
) {
  if (attempt.kind !== "ok" || !attempt.record.snapshot) return null;
  fs.mkdirSync(destDir, { recursive: true });
  const dest = path.join(destDir, `${playerId}.json`);
  const body = {
    simulated: false,
    origin: "production worker + validateListingForPlayer",
    playerId,
    attemptedAt: attempt.attemptedAt,
    sourceFetchedAt: attempt.record.sourceFetchedAt ?? null,
    marketValueLastUpdated: attempt.record.marketValueLastUpdated ?? null,
    snapshot: {
      fetchedAt: attempt.record.snapshot.fetchedAt,
      clubId: attempt.record.snapshot.clubId,
      clubName: attempt.record.snapshot.clubName,
      contractExpires: attempt.record.snapshot.contractExpires,
      isRetired: attempt.record.snapshot.isRetired,
      joined: attempt.record.snapshot.joined,
    },
  };
  fs.writeFileSync(dest, `${JSON.stringify(body, null, 2)}\n`);
  return dest.replaceAll("\\", "/");
}

async function main() {
  const argv = process.argv.slice(2);
  const stub = refuseProdStub(process.env);
  if (!stub.ok) fail({ ok: false, reason: stub.reason });
  delete process.env.AUTO_REFRESH_ALLOW_STUB;
  delete process.env.AUTO_REFRESH_STUB_JSON;

  const asserted = assertProdRefreshEnv();
  if (!asserted.ok) fail({ ok: false, reason: asserted.reason });
  applyProdRefreshPublicEnv(asserted.refresh);
  console.log("Production refresh env file: .env.prod-refresh.local");
  console.log("Host matches independent .env.local URL (values not printed).");
  console.log("Keys from .env.local were not loaded.");

  const ids = uniquePlayerIds(
    String(parseFlag(argv, "--ids") || "")
      .split(",")
      .filter(isPlayerId),
  );
  const max = Number(parseFlag(argv, "--max"));
  const dryRun = prodRefreshIsDryRun(argv);
  if (dryRun) process.env.AUTO_REFRESH_DRY_RUN = "1";
  const persist = prodRefreshPersistAllowed(argv);

  if (process.env.AUTO_REFRESH_PERSIST === "1" && !argv.includes("--confirm-production")) {
    fail({
      ok: false,
      reason: "Production persist requires --confirm-production in addition to AUTO_REFRESH_PERSIST=1.",
    });
  }

  if (!isAutoRefreshFetchEnabled()) {
    fail({ ok: false, disabled: true, dryRun: true, persist: false });
  }
  if (!ids.length || !Number.isInteger(max) || max < 1 || max > AUTO_REFRESH_MAX_BATCH || ids.length > max) {
    fail({
      ok: false,
      reason: "Explicit --ids and --max are required. Batch limited to 5. Full-catalog fetch is refused.",
    });
  }
  if (!process.env.AUTO_REFRESH_PYTHON?.trim()) {
    fail({ ok: false, reason: "Set AUTO_REFRESH_PYTHON to the isolated venv interpreter." });
  }

  const workerKeys = workerEnv(process.env);
  if (workerKeys.SUPABASE_SERVICE_ROLE_KEY || workerKeys.SUPABASE_SECRET_KEY) {
    fail({ ok: false, reason: "Service-role must not reach the Python worker." });
  }

  const results = [];
  for (const playerId of ids) {
    const attempt = await fetchListingAttempt(playerId, null);
    const saved = saveValidatedProdSnapshot(playerId, attempt);
    const row = {
      playerId,
      kind: attempt.kind,
      stopBatch: attempt.stopBatch,
      attemptedAt: attempt.attemptedAt,
      sourceFetchedAt: attempt.record.sourceFetchedAt ?? null,
      snapshotFetchedAt: attempt.record.snapshot?.fetchedAt ?? null,
      snapshot: attempt.record.snapshot ?? null,
      savedSnapshot: saved,
      lastError: attempt.record.lastError ? redactSecrets(attempt.record.lastError) : null,
      persisted: false,
      catalogWritten: false,
      reviewWritten: false,
    };
    if (persist && attempt.kind === "ok" && attempt.record.snapshot && !attempt.record.lastError) {
      const service = applyProdRefreshServiceRole(asserted.refresh);
      if (!service.ok) fail({ ok: false, reason: service.reason });
      try {
        await persistAutoRefreshRecord(playerId, attempt.record);
        row.persisted = true;
      } catch (error) {
        row.lastError = redactSecrets(error instanceof Error ? error.message : "persist_failed");
      }
      delete process.env.SUPABASE_SERVICE_ROLE_KEY;
      delete process.env.SUPABASE_SECRET_KEY;
    }
    results.push(row);
    if (attempt.stopBatch) break;
  }

  console.log(
    JSON.stringify(
      {
        ok: results.every((row) => row.kind === "ok" || row.kind === "not_found" || row.kind === "invalid"),
        target: "production",
        dryRun,
        persist,
        concurrency: AUTO_REFRESH_CONCURRENCY,
        retries: 0,
        writes: { player_auto_snapshots: persist, players: false, player_reviews: false },
        results,
      },
      null,
      2,
    ),
  );

  if (results.some((row) => row.kind === "blocked" || row.kind === "timeout" || row.kind === "disabled")) {
    process.exit(2);
  }
}

const invokedDirectly = /auto-refresh-prod-run\.(ts|js|mjs)$/i.test(path.basename(process.argv[1] || ""));
if (invokedDirectly) {
  main().catch((error) => {
    const message = redactSecrets(error instanceof Error ? error.message : String(error));
    console.error(JSON.stringify({ ok: false, error: message }));
    process.exit(1);
  });
}
