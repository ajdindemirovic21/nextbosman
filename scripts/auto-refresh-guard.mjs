/**
 * Bind listing refresh to .env.test.local only. Never print key values.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const SECRET_ENV = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "FOOTBALL_DATA_API_KEY",
];

export function loadEnvFile(file) {
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

export function runAssertTestEnv(root = process.cwd()) {
  const asserted = spawnSync(process.execPath, [path.join(root, "scripts", "assert-test-env.mjs")], {
    cwd: root,
    stdio: "inherit",
    windowsHide: true,
  });
  if (asserted.status !== 0) process.exit(asserted.status ?? 1);
}

export function applyTestSupabaseEnv(root = process.cwd()) {
  const test = loadEnvFile(path.join(root, ".env.test.local"));
  const prod = loadEnvFile(path.join(root, ".env.local"));
  if (urlHost(test.NEXT_PUBLIC_SUPABASE_URL) === urlHost(prod.NEXT_PUBLIC_SUPABASE_URL)) {
    console.error("ABORT: test project URL host matches production.");
    process.exit(1);
  }
  for (const key of SECRET_ENV) {
    delete process.env[key];
  }
  if (test.NEXT_PUBLIC_SUPABASE_URL) process.env.NEXT_PUBLIC_SUPABASE_URL = test.NEXT_PUBLIC_SUPABASE_URL;
  if (test.NEXT_PUBLIC_SUPABASE_ANON_KEY) process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = test.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (test.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = test.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  }
  if (test.SUPABASE_SERVICE_ROLE_KEY) process.env.SUPABASE_SERVICE_ROLE_KEY = test.SUPABASE_SERVICE_ROLE_KEY;
  if (test.SUPABASE_SECRET_KEY) process.env.SUPABASE_SECRET_KEY = test.SUPABASE_SECRET_KEY;
}
