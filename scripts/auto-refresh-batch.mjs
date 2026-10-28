/**
 * Manual limited-batch listing refresh. Not an HTTP route. Not invoked by search.
 *
 * PowerShell dry-run, one ID, no database write, no persist flag:
 *
 *   Set-Location <repo>
 *   $env:AUTO_REFRESH_LIVE = "1"
 *   $env:AUTO_REFRESH_ENABLE_FETCH = "1"
 *   $env:AUTO_REFRESH_DRY_RUN = "1"
 *   $env:AUTO_REFRESH_PYTHON = "<isolated-venv>\\python.exe"
 *   Remove-Item Env:AUTO_REFRESH_PERSIST -ErrorAction SilentlyContinue
 *   Remove-Item Env:AUTO_REFRESH_STUB_JSON -ErrorAction SilentlyContinue
 *   npx tsx scripts\auto-refresh-run.ts --ids 203496 --max 1 --dry-run
 *
 * Writes require a separate AUTO_REFRESH_PERSIST=1 and must not be combined with dry-run.
 * Source terms are a separate question from the SDK MIT license.
 */
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { applyTestSupabaseEnv, runAssertTestEnv } from "./auto-refresh-guard.mjs";

const AUTO_REFRESH_CONCURRENCY = 1;
const AUTO_REFRESH_TIMEOUT_MS = 15_000;
const AUTO_REFRESH_MAX_BATCH = 5;

function parseFlag(argv, name) {
  const eq = argv.find((arg) => arg.startsWith(`${name}=`));
  if (eq) return eq.slice(name.length + 1);
  const idx = argv.indexOf(name);
  if (idx >= 0) return argv[idx + 1] ?? "";
  return "";
}

function parseIds(argv) {
  return String(parseFlag(argv, "--ids") || "")
    .split(",")
    .map((id) => id.trim())
    .filter(Boolean);
}

runAssertTestEnv();
applyTestSupabaseEnv();

const argv = process.argv.slice(2);
const ids = parseIds(argv);
const maxRaw = parseFlag(argv, "--max");
const live = process.env.AUTO_REFRESH_LIVE === "1" && process.env.AUTO_REFRESH_ENABLE_FETCH === "1";

if (!live) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        disabled: true,
        reason: "Automatic listing fetch is off until AUTO_REFRESH_LIVE=1 and AUTO_REFRESH_ENABLE_FETCH=1.",
        concurrency: AUTO_REFRESH_CONCURRENCY,
        timeoutMs: AUTO_REFRESH_TIMEOUT_MS,
        retries: 0,
        idsRequested: ids,
      },
      null,
      2,
    ),
  );
  process.exit(2);
}

const max = Number(maxRaw);
if (!ids.length || !Number.isInteger(max) || max < 1) {
  console.error(
    JSON.stringify({
      ok: false,
      reason: "Explicit --ids and --max are required. Full-catalog fetch is refused.",
    }),
  );
  process.exit(2);
}
if (max > AUTO_REFRESH_MAX_BATCH || ids.length > max) {
  console.error(
    JSON.stringify({
      ok: false,
      reason: `Batch limited to --max <= ${AUTO_REFRESH_MAX_BATCH} and ids.length <= max.`,
      ids: ids.length,
      max,
    }),
  );
  process.exit(2);
}
if (!process.env.AUTO_REFRESH_PYTHON?.trim()) {
  console.error(JSON.stringify({ ok: false, reason: "Set AUTO_REFRESH_PYTHON to the isolated venv interpreter." }));
  process.exit(2);
}

const require = createRequire(import.meta.url);
let tsx;
try {
  tsx = require.resolve("tsx/cli");
} catch {
  console.error(JSON.stringify({ ok: false, reason: "tsx is required to run the TypeScript adapter from this script." }));
  process.exit(2);
}

const runner = path.join(path.dirname(fileURLToPath(import.meta.url)), "auto-refresh-run.ts");
const result = spawnSync(process.execPath, [tsx, runner, ...argv], {
  stdio: "inherit",
  env: process.env,
  windowsHide: true,
});
process.exit(result.status ?? 1);
