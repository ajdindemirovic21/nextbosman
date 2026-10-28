/**
 * Persist a reviewed production snapshot without a new Transfermarkt call.
 * Default dry-run. Writes require AUTO_REFRESH_PERSIST=1 and --confirm-production.
 *
 * Allowed source use is not yet settled.
 *
 * Does not call Transfermarkt and does not use AUTO_REFRESH_PYTHON.
 *
 * Dry-run validate (no write):
 *
 *   Set-Location C:\Users\Korisnik\NextBosman
 *   $env:AUTO_REFRESH_PERSIST = "0"
 *   $env:AUTO_REFRESH_DRY_RUN = "1"
 *   Remove-Item Env:AUTO_REFRESH_ALLOW_STUB, Env:AUTO_REFRESH_STUB_JSON, Env:AUTO_REFRESH_LIVE, Env:AUTO_REFRESH_ENABLE_FETCH -ErrorAction SilentlyContinue
 *   npx.cmd tsx scripts\auto-refresh-prod-persist-saved.ts --ids 203496 --max 1 --snapshot scripts\fixtures\auto-refresh\prod-saved\203496.json --dry-run
 *
 * Persist after review:
 *
 *   $env:AUTO_REFRESH_PERSIST = "1"
 *   Remove-Item Env:AUTO_REFRESH_DRY_RUN -ErrorAction SilentlyContinue
 *   npx.cmd tsx scripts\auto-refresh-prod-persist-saved.ts --ids 203496 --max 1 --snapshot scripts\fixtures\auto-refresh\prod-saved\203496.json --confirm-production
 */
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { persistAutoRefreshRecord } from "../src/lib/auto-refresh-persist.ts";
import { redactSecrets } from "../src/lib/auto-refresh-redact.ts";
import { isPlayerId, uniquePlayerIds } from "../src/lib/player-ids.ts";
import {
  applyProdRefreshPublicEnv,
  applyProdRefreshServiceRole,
  assertProdRefreshEnv,
  prodRefreshIsDryRun,
  prodRefreshPersistAllowed,
  refuseProdStub,
} from "./auto-refresh-prod-guard.mjs";
import {
  compareIncomingFetchedAt,
  loadSavedProdSnapshotFile,
  validateSavedProdSnapshot,
} from "./auto-refresh-prod-saved.ts";

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

export async function readStoredFetchedAt(playerId: string): Promise<string | null> {
  if (process.env.AUTO_REFRESH_SAVED_SKIP_STORE_READ === "1") {
    const injected = process.env.AUTO_REFRESH_SAVED_STORED_FETCHED_AT?.trim();
    return injected || null;
  }
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim() || "";
  const anon =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?.trim() ||
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ||
    "";
  if (!url || !anon) throw new Error("Anon key required to read the current snapshot time.");
  const sb = createClient(url, anon, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error } = await sb
    .from("player_auto_snapshots")
    .select("player_id, fetched_at")
    .eq("player_id", playerId)
    .maybeSingle();
  if (error) throw error;
  return data?.fetched_at ?? null;
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
  const snapshotPath = parseFlag(argv, "--snapshot");
  const dryRun = prodRefreshIsDryRun(argv);
  if (dryRun) process.env.AUTO_REFRESH_DRY_RUN = "1";
  const persist = prodRefreshPersistAllowed(argv);

  if (process.env.AUTO_REFRESH_PERSIST === "1" && !argv.includes("--confirm-production")) {
    fail({
      ok: false,
      reason: "Production persist requires --confirm-production in addition to AUTO_REFRESH_PERSIST=1.",
    });
  }
  if (ids.length !== 1 || max !== 1) {
    fail({ ok: false, reason: "Saved-snapshot persist accepts exactly one --ids value and --max 1." });
  }
  const playerId = ids[0];
  const loaded = loadSavedProdSnapshotFile(path.resolve(snapshotPath));
  if (!loaded.ok) fail({ ok: false, reason: loaded.reason });
  const validated = validateSavedProdSnapshot(loaded.data, playerId);
  if (!validated.ok) fail({ ok: false, reason: validated.reason });

  const stored = await readStoredFetchedAt(playerId);
  const compared = compareIncomingFetchedAt(validated.record.snapshot?.fetchedAt || "", stored);
  if (!compared.ok) fail({ ok: false, reason: compared.reason, storedFetchedAt: stored });

  let persisted = false;
  if (persist && compared.action === "write") {
    const service = applyProdRefreshServiceRole(asserted.refresh);
    if (!service.ok) fail({ ok: false, reason: service.reason });
    try {
      await persistAutoRefreshRecord(playerId, validated.record);
      persisted = true;
    } catch (error) {
      fail({
        ok: false,
        reason: redactSecrets(error instanceof Error ? error.message : "persist_failed"),
      });
    }
    delete process.env.SUPABASE_SERVICE_ROLE_KEY;
    delete process.env.SUPABASE_SECRET_KEY;
  }

  console.log(
    JSON.stringify(
      {
        ok: true,
        target: "production",
        dryRun,
        persist,
        fetch: false,
        retries: 0,
        playerId,
        snapshot: validated.record.snapshot,
        storedFetchedAt: stored,
        action: compared.action,
        persisted,
        catalogWritten: false,
        reviewWritten: false,
      },
      null,
      2,
    ),
  );
}

const invokedDirectly = /auto-refresh-prod-persist-saved\.(ts|js|mjs)$/i.test(path.basename(process.argv[1] || ""));
if (invokedDirectly) {
  main().catch((error) => {
    const message = redactSecrets(error instanceof Error ? error.message : String(error));
    console.error(JSON.stringify({ ok: false, error: message }));
    process.exit(1);
  });
}
