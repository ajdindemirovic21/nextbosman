/**
 * Server/script adapter for Transfermarkt listing refresh.
 * Do not import from client components. Python SDK stays outside Next and the browser.
 * Fetch is off unless AUTO_REFRESH_LIVE=1 and AUTO_REFRESH_ENABLE_FETCH=1.
 */
import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { isPlayerId } from "@/lib/player-ids";
import {
  applyFetchFailure,
  recordFromValidatedListing,
  type AutoRefreshRecord,
  type ListingProfile,
} from "@/lib/auto-refresh";

export const AUTO_REFRESH_FETCH_ENABLED = false;
export const AUTO_REFRESH_CONCURRENCY = 1;
export const AUTO_REFRESH_TIMEOUT_MS = 15_000;
export const AUTO_REFRESH_MAX_BATCH = 5;

export type FetchKind = "ok" | "blocked" | "timeout" | "not_found" | "invalid" | "error" | "disabled";

export type WorkerResult = {
  ok?: boolean;
  kind?: FetchKind | string;
  status?: number | null;
  message?: string;
  id?: string;
  updatedAt?: string | null;
  isRetired?: boolean | null;
  club?: ListingProfile["club"];
  marketValueLastUpdated?: string | null;
};

export type FetchAttempt = {
  playerId: string;
  kind: FetchKind;
  attemptedAt: string;
  record: AutoRefreshRecord;
  stopBatch: boolean;
  status?: number | null;
};

export class UpstreamBlockedError extends Error {
  readonly status: number;
  constructor(status: number, message: string) {
    super(message);
    this.name = "UpstreamBlockedError";
    this.status = status;
  }
}

export function isAutoRefreshFetchEnabled() {
  return process.env.AUTO_REFRESH_LIVE === "1" && process.env.AUTO_REFRESH_ENABLE_FETCH === "1";
}

export function assertAutoRefreshFetchEnabled() {
  if (!isAutoRefreshFetchEnabled()) {
    throw new Error(
      "Automatic listing fetch is disabled until explicitly enabled. Do not run this on user search.",
    );
  }
}

export function pythonInterpreterPath() {
  return process.env.AUTO_REFRESH_PYTHON?.trim() || "";
}

export function fetchScriptPath() {
  return (
    process.env.AUTO_REFRESH_FETCH_SCRIPT?.trim() ||
    path.join(process.cwd(), "scripts", "auto-refresh-fetch.py")
  );
}

function parseTimeoutMs() {
  const raw = Number(process.env.AUTO_REFRESH_TIMEOUT_MS);
  if (Number.isFinite(raw) && raw >= 1000) return Math.min(raw, 60_000);
  return AUTO_REFRESH_TIMEOUT_MS;
}

const WORKER_ENV_ALLOW = new Set([
  "PATH",
  "PATHEXT",
  "SystemRoot",
  "SYSTEMROOT",
  "WINDIR",
  "ComSpec",
  "TEMP",
  "TMP",
  "HOME",
  "USERPROFILE",
  "PYTHONUTF8",
  "PYTHONIOENCODING",
  "AUTO_REFRESH_LIVE",
  "AUTO_REFRESH_ENABLE_FETCH",
  "AUTO_REFRESH_TIMEOUT_SEC",
  "AUTO_REFRESH_TIMEOUT_MS",
]);

export function workerEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { PYTHONUTF8: "1", NODE_ENV: base.NODE_ENV };
  for (const key of WORKER_ENV_ALLOW) {
    if (base[key]) out[key] = base[key];
  }
  if (base.AUTO_REFRESH_ALLOW_STUB === "1" && base.AUTO_REFRESH_STUB_JSON) {
    out.AUTO_REFRESH_ALLOW_STUB = "1";
    out.AUTO_REFRESH_STUB_JSON = base.AUTO_REFRESH_STUB_JSON;
  }
  return out;
}

export function killWorkerTree(pid: number | undefined) {
  if (!pid) return;
  if (process.platform === "win32") {
    spawnSync("taskkill", ["/PID", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" });
    return;
  }
  try {
    process.kill(pid, "SIGKILL");
  } catch {
    /* already gone */
  }
}

export function parseWorkerPayload(stdout: string): WorkerResult {
  const text = stdout.trim();
  try {
    return JSON.parse(text) as WorkerResult;
  } catch {
    const start = text.indexOf("{");
    const end = text.lastIndexOf("}");
    if (start < 0 || end <= start) return { ok: false, kind: "invalid", message: "non_json_stdout" };
    try {
      return JSON.parse(text.slice(start, end + 1)) as WorkerResult;
    } catch {
      return { ok: false, kind: "invalid", message: "invalid_json_stdout" };
    }
  }
}

export function classifyWorkerResult(result: WorkerResult): FetchKind {
  if (result.kind === "blocked" || result.status === 403 || result.status === 429) return "blocked";
  if (result.kind === "timeout") return "timeout";
  if (result.kind === "not_found") return "not_found";
  if (result.kind === "disabled") return "disabled";
  if (result.ok === true) return "ok";
  if (result.kind === "invalid") return "invalid";
  return "error";
}

export function workerResultFromStubFile(file: string, playerId: string): WorkerResult {
  const raw = JSON.parse(fs.readFileSync(file, "utf8")) as Record<string, unknown> & {
    club?: Record<string, unknown>;
    marketValueDetails?: { last_updated?: string };
    market_value_details?: { last_updated?: string };
  };
  const club = raw.club ?? {};
  const details = raw.marketValueDetails ?? raw.market_value_details ?? {};
  return {
    ok: true,
    id: String(raw.id ?? playerId),
    updatedAt: String(raw.updatedAt ?? raw.updated_at ?? raw.fetched_at_utc ?? ""),
    isRetired: raw.isRetired === true || raw.is_retired === true,
    club: {
      id: (club.id ?? raw.club_id) as string | null,
      name: (club.name ?? raw.club_name) as string | null,
      contractExpires: (club.contractExpires ?? club.contract_expires ?? raw.contractExpires) as string | null,
      joined: (club.joined ?? raw.joined) as string | null,
    },
    marketValueLastUpdated: (raw.marketValueLastUpdated ?? details.last_updated ?? null) as string | null,
  };
}

export function listingFromWorker(result: WorkerResult): ListingProfile {
  return {
    id: result.id,
    isRetired: result.isRetired === true,
    updatedAt: result.updatedAt ?? null,
    marketValueLastUpdated: result.marketValueLastUpdated ?? null,
    club: result.club ?? null,
  };
}

export function applyWorkerAttempt(
  playerId: string,
  previous: AutoRefreshRecord | null,
  result: WorkerResult,
  attemptedAt: string,
): FetchAttempt {
  const kind = classifyWorkerResult(result);
  const stopBatch = kind === "blocked" || kind === "timeout";
  if (kind !== "ok") {
    const status = result.status ?? null;
    const error = result.message || kind;
    return {
      playerId,
      kind,
      attemptedAt,
      status,
      stopBatch,
      record: applyFetchFailure(previous, `${kind}:${error}`, attemptedAt),
    };
  }
  const record = recordFromValidatedListing(playerId, previous, listingFromWorker(result), attemptedAt);
  if (record.lastError) {
    return {
      playerId,
      kind: "invalid",
      attemptedAt,
      stopBatch: false,
      record,
    };
  }
  return { playerId, kind: "ok", attemptedAt, stopBatch: false, record };
}

export type RunWorker = (args: {
  python: string;
  script: string;
  playerId: string;
  timeoutMs: number;
  env: NodeJS.ProcessEnv;
}) => Promise<{ stdout: string; stderr: string; code: number | null; timedOut: boolean }>;

export const defaultRunWorker: RunWorker = ({ python, script, playerId, timeoutMs, env }) =>
  new Promise((resolve) => {
    const child = spawn(python, [script, playerId], {
      env: workerEnv(env),
      windowsHide: true,
    });
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      killWorkerTree(child.pid);
    }, timeoutMs);
    child.stdout.on("data", (chunk) => {
      stdout += String(chunk);
    });
    child.stderr.on("data", (chunk) => {
      stderr += String(chunk);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve({ stdout, stderr, code, timedOut });
    });
    child.on("error", (error) => {
      clearTimeout(timer);
      resolve({ stdout, stderr: `${stderr}${error.message}`, code: 1, timedOut });
    });
  });

export async function fetchListingAttempt(
  playerId: string,
  previous: AutoRefreshRecord | null,
  options?: { runWorker?: RunWorker; attemptedAt?: string },
): Promise<FetchAttempt> {
  const attemptedAt = options?.attemptedAt ?? new Date().toISOString();
  if (!isPlayerId(playerId)) {
    return {
      playerId,
      kind: "invalid",
      attemptedAt,
      stopBatch: false,
      record: applyFetchFailure(previous, "invalid_player_id", attemptedAt),
    };
  }
  if (!isAutoRefreshFetchEnabled()) {
    return {
      playerId,
      kind: "disabled",
      attemptedAt,
      stopBatch: true,
      record: applyFetchFailure(previous, "disabled", attemptedAt),
    };
  }
  const stubFile = process.env.AUTO_REFRESH_ALLOW_STUB === "1" ? process.env.AUTO_REFRESH_STUB_JSON?.trim() : "";
  if (stubFile) {
    const payload = workerResultFromStubFile(stubFile, playerId);
    return applyWorkerAttempt(playerId, previous, payload, attemptedAt);
  }
  const python = pythonInterpreterPath();
  if (!python) {
    return {
      playerId,
      kind: "error",
      attemptedAt,
      stopBatch: true,
      record: applyFetchFailure(previous, "missing_AUTO_REFRESH_PYTHON", attemptedAt),
    };
  }
  const runWorker = options?.runWorker ?? defaultRunWorker;
  const worker = await runWorker({
    python,
    script: fetchScriptPath(),
    playerId,
    timeoutMs: parseTimeoutMs(),
    env: process.env,
  });
  if (worker.timedOut) {
    return {
      playerId,
      kind: "timeout",
      attemptedAt,
      stopBatch: true,
      record: applyFetchFailure(previous, "timeout", attemptedAt),
    };
  }
  const payload = parseWorkerPayload(worker.stdout);
  return applyWorkerAttempt(playerId, previous, payload, attemptedAt);
}

export async function fetchListingProfile(
  playerId: string,
  options?: { runWorker?: RunWorker },
): Promise<ListingProfile> {
  assertAutoRefreshFetchEnabled();
  const attempt = await fetchListingAttempt(playerId, null, options);
  if (attempt.kind === "blocked") {
    throw new UpstreamBlockedError(attempt.status ?? 0, attempt.record.lastError || "blocked");
  }
  if (attempt.kind !== "ok" || !attempt.record.snapshot) {
    throw new Error(attempt.record.lastError || attempt.kind);
  }
  return listingFromWorker({
    ok: true,
    id: playerId,
    updatedAt: attempt.record.sourceFetchedAt,
    isRetired: attempt.record.snapshot.isRetired,
    club: {
      id: attempt.record.snapshot.clubId,
      name: attempt.record.snapshot.clubName,
      contractExpires: attempt.record.snapshot.contractExpires,
      joined: attempt.record.snapshot.joined,
    },
    marketValueLastUpdated: attempt.record.marketValueLastUpdated,
  });
}
