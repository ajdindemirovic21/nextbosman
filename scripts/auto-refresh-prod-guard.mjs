/**
 * Bind production listing refresh to .env.prod-refresh.local only.
 * .env.local is read only to pin the URL host independently of AUTO_REFRESH_PROD_HOST.
 * Never copy .env.local or .env.test.local keys into process.env.
 * Never print key values.
 */
import fs from "node:fs";
import path from "node:path";
import { loadEnvFile } from "./auto-refresh-guard.mjs";

export const PROD_REFRESH_ENV_FILE = ".env.prod-refresh.local";

const SECRET_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "FOOTBALL_DATA_API_KEY",
];

export function urlHost(raw) {
  if (!raw) return null;
  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    return null;
  }
}

export function prodRefreshRoot(cwd = process.cwd()) {
  const hook = process.env.AUTO_REFRESH_PROD_ENV_ROOT?.trim();
  return hook || cwd;
}

export function loadProdRefreshFile(root = prodRefreshRoot()) {
  return loadEnvFile(path.join(root, PROD_REFRESH_ENV_FILE));
}

export function assertProdRefreshEnv(root = prodRefreshRoot()) {
  const file = path.join(root, PROD_REFRESH_ENV_FILE);
  if (!fs.existsSync(file)) {
    return {
      ok: false,
      reason: "Missing .env.prod-refresh.local. Do not load .env.local keys for production refresh.",
    };
  }
  const refresh = loadProdRefreshFile(root);
  const appLocal = loadEnvFile(path.join(root, ".env.local"));
  const test = loadEnvFile(path.join(process.cwd(), ".env.test.local"));
  const host = urlHost(refresh.NEXT_PUBLIC_SUPABASE_URL);
  const pinned = String(refresh.AUTO_REFRESH_PROD_HOST || "")
    .trim()
    .toLowerCase();
  const appHost = urlHost(appLocal.NEXT_PUBLIC_SUPABASE_URL);
  const testHost = urlHost(test.NEXT_PUBLIC_SUPABASE_URL);
  if (!host || !pinned) {
    return { ok: false, reason: "AUTO_REFRESH_PROD_HOST and NEXT_PUBLIC_SUPABASE_URL are required." };
  }
  if (pinned.includes("your_production") || pinned.includes("example.com")) {
    return { ok: false, reason: "AUTO_REFRESH_PROD_HOST is still a placeholder." };
  }
  if (host !== pinned) {
    return { ok: false, reason: "Production refresh URL host does not match AUTO_REFRESH_PROD_HOST." };
  }
  if (!appHost) {
    return {
      ok: false,
      reason: "Cannot verify production host: .env.local URL is missing (read-only check, keys are not loaded).",
    };
  }
  if (host !== appHost) {
    return {
      ok: false,
      reason: "Production refresh host does not match the independent .env.local URL host.",
    };
  }
  if (testHost && host === testHost) {
    return { ok: false, reason: "Production refresh host matches the test project." };
  }
  return { ok: true, refresh, host };
}

export function clearSecretEnv(env = process.env) {
  for (const key of SECRET_ENV) delete env[key];
}

export function applyProdRefreshPublicEnv(refresh, env = process.env) {
  clearSecretEnv(env);
  if (refresh.NEXT_PUBLIC_SUPABASE_URL) env.NEXT_PUBLIC_SUPABASE_URL = refresh.NEXT_PUBLIC_SUPABASE_URL;
  if (refresh.NEXT_PUBLIC_SUPABASE_ANON_KEY) env.NEXT_PUBLIC_SUPABASE_ANON_KEY = refresh.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (refresh.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = refresh.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  }
}

export function applyProdRefreshServiceRole(refresh, env = process.env) {
  const service = String(refresh.SUPABASE_SERVICE_ROLE_KEY || refresh.SUPABASE_SECRET_KEY || "").trim();
  const anon = String(refresh.NEXT_PUBLIC_SUPABASE_ANON_KEY || refresh.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || "").trim();
  if (!service) return { ok: false, reason: "Snapshot persist requires a service-role key in .env.prod-refresh.local." };
  if (anon && service === anon) return { ok: false, reason: "Service-role key matches the public key." };
  env.SUPABASE_SERVICE_ROLE_KEY = service;
  return { ok: true };
}

export function prodRefreshIsDryRun(argv, env = process.env) {
  if (argv.includes("--dry-run") || env.AUTO_REFRESH_DRY_RUN === "1") return true;
  const persistRequested = env.AUTO_REFRESH_PERSIST === "1" && argv.includes("--confirm-production");
  return !persistRequested;
}

export function prodRefreshPersistAllowed(argv, env = process.env) {
  return (
    env.AUTO_REFRESH_PERSIST === "1" &&
    argv.includes("--confirm-production") &&
    !prodRefreshIsDryRun(argv, env)
  );
}

export function refuseProdStub(env = process.env) {
  if (env.AUTO_REFRESH_ALLOW_STUB === "1" || env.AUTO_REFRESH_STUB_JSON?.trim()) {
    return {
      ok: false,
      reason: "Simulated fixtures and AUTO_REFRESH_STUB_JSON are forbidden in production refresh.",
    };
  }
  return { ok: true };
}
