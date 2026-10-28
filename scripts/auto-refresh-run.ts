/**
 * Sequential listing refresh. Manual script only. Test project env required.
 */
import fs from "node:fs";
import path from "node:path";
import {
  AUTO_REFRESH_CONCURRENCY,
  AUTO_REFRESH_MAX_BATCH,
  fetchListingAttempt,
  isAutoRefreshFetchEnabled,
} from "../src/lib/auto-refresh-adapter.ts";
import { isAutoRefreshPersistEnabled, persistAutoRefreshRecord } from "../src/lib/auto-refresh-persist.ts";
import { redactSecrets } from "../src/lib/auto-refresh-redact.ts";
import { isPlayerId, uniquePlayerIds } from "../src/lib/player-ids.ts";
import { applyTestSupabaseEnv, runAssertTestEnv } from "./auto-refresh-guard.mjs";

function parseFlag(argv: string[], name: string) {
  const eq = argv.find((arg) => arg.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const idx = argv.indexOf(name);
  if (idx >= 0) return argv[idx + 1] ?? "";
  return "";
}

async function main() {
  runAssertTestEnv();
  applyTestSupabaseEnv();

  const argv = process.argv.slice(2);
  const ids = uniquePlayerIds(
    String(parseFlag(argv, "--ids") || "")
      .split(",")
      .filter(isPlayerId),
  );
  const max = Number(parseFlag(argv, "--max"));
  const dryRun = process.env.AUTO_REFRESH_DRY_RUN === "1" || argv.includes("--dry-run");
  if (dryRun) process.env.AUTO_REFRESH_DRY_RUN = "1";

  if (!isAutoRefreshFetchEnabled()) {
    console.error(JSON.stringify({ ok: false, disabled: true }));
    process.exit(2);
  }
  if (!ids.length || !Number.isInteger(max) || max < 1 || max > AUTO_REFRESH_MAX_BATCH || ids.length > max) {
    console.error(
      JSON.stringify({
        ok: false,
        reason: "Explicit --ids and --max are required. Full-catalog fetch is refused.",
      }),
    );
    process.exit(2);
  }
  const stubAllowed = process.env.AUTO_REFRESH_ALLOW_STUB === "1" && Boolean(process.env.AUTO_REFRESH_STUB_JSON?.trim());
  if (!stubAllowed && !process.env.AUTO_REFRESH_PYTHON?.trim()) {
    console.error(JSON.stringify({ ok: false, reason: "Set AUTO_REFRESH_PYTHON to the isolated venv interpreter." }));
    process.exit(2);
  }

  const persist = isAutoRefreshPersistEnabled();
  const savePath = parseFlag(argv, "--save-snapshot");
  const results = [];
  for (const playerId of ids) {
    const attempt = await fetchListingAttempt(playerId, null);
    const snapshot = attempt.record.snapshot
      ? {
          fetchedAt: attempt.record.snapshot.fetchedAt,
          clubId: attempt.record.snapshot.clubId,
          clubName: attempt.record.snapshot.clubName,
          contractExpires: attempt.record.snapshot.contractExpires,
          isRetired: attempt.record.snapshot.isRetired,
          joined: attempt.record.snapshot.joined,
        }
      : null;
    if (savePath && attempt.kind === "ok" && snapshot) {
      const dest = path.resolve(savePath);
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      fs.writeFileSync(
        dest,
        `${JSON.stringify(
          {
            simulated: false,
            origin: "live worker + validateListingForPlayer",
            playerId,
            attemptedAt: attempt.attemptedAt,
            sourceFetchedAt: attempt.record.sourceFetchedAt ?? null,
            marketValueLastUpdated: attempt.record.marketValueLastUpdated ?? null,
            snapshot,
          },
          null,
          2,
        )}\n`,
      );
    }
    const row = {
      playerId,
      kind: attempt.kind,
      stopBatch: attempt.stopBatch,
      attemptedAt: attempt.attemptedAt,
      sourceFetchedAt: attempt.record.sourceFetchedAt ?? null,
      marketValueLastUpdated: attempt.record.marketValueLastUpdated ?? null,
      snapshotFetchedAt: attempt.record.snapshot?.fetchedAt ?? null,
      snapshot,
      lastError: attempt.record.lastError ? redactSecrets(attempt.record.lastError) : null,
      persisted: false,
    };
    if (persist && attempt.kind !== "disabled") {
      try {
        await persistAutoRefreshRecord(playerId, attempt.record);
        row.persisted = true;
      } catch (error) {
        row.lastError = redactSecrets(error instanceof Error ? error.message : "persist_failed");
      }
    }
    results.push(row);
    if (attempt.stopBatch) break;
  }

  console.log(
    JSON.stringify(
      {
        ok: results.every((row) => row.kind === "ok" || row.kind === "not_found" || row.kind === "invalid"),
        dryRun,
        persist,
        concurrency: AUTO_REFRESH_CONCURRENCY,
        retries: 0,
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

main().catch((error) => {
  const message = redactSecrets(error instanceof Error ? error.message : String(error));
  console.error(JSON.stringify({ ok: false, error: message }));
  process.exit(1);
});
