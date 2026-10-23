/**
 * Local Next.js preview bound only to .env.test.local.
 * Does not write .env.local. Uses .next-test so production .next is left alone.
 */
import { spawn, spawnSync } from "child_process";
import fs from "fs";
import path from "path";
import { createRequire } from "module";
import { fileURLToPath } from "url";

const root = path.dirname(fileURLToPath(import.meta.url));
const repo = path.join(root, "..");
const PORT = "3010";

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

const asserted = spawnSync(process.execPath, [path.join(repo, "scripts", "assert-test-env.mjs")], {
  cwd: repo,
  stdio: "inherit",
});
if (asserted.status !== 0) process.exit(asserted.status ?? 1);

const test = loadEnvFile(path.join(repo, ".env.test.local"));
const url = test.NEXT_PUBLIC_SUPABASE_URL;
const key = test.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || test.NEXT_PUBLIC_SUPABASE_ANON_KEY;
if (!url || !key) {
  console.error("ABORT: test URL or publishable key missing.");
  process.exit(1);
}

const childEnv = { ...process.env };
for (const name of [
  "NEXT_PUBLIC_SUPABASE_URL",
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "SUPABASE_SECRET_KEY",
  "NEXT_PUBLIC_SITE_URL",
]) {
  delete childEnv[name];
}

childEnv.NEXT_PUBLIC_SUPABASE_URL = url;
if (test.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  childEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY = test.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}
if (test.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY) {
  childEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = test.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
} else if (test.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
  childEnv.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = test.NEXT_PUBLIC_SUPABASE_ANON_KEY;
}
childEnv.NEXT_PUBLIC_TEST_INSTANCE = "1";
childEnv.NEXT_PUBLIC_SITE_URL = `http://127.0.0.1:${PORT}`;
childEnv.NEXT_DIST_DIR = ".next-test";
childEnv.PORT = PORT;

const nextBin = createRequire(path.join(repo, "package.json")).resolve("next/dist/bin/next");
console.log(`Test preview: http://127.0.0.1:${PORT}/bs/review`);
console.log("Build dir: .next-test (production .next untouched)");
console.log("Env file: .env.test.local (values not printed)");

const child = spawn(process.execPath, [nextBin, "dev", "-p", PORT, "-H", "127.0.0.1"], {
  cwd: repo,
  env: childEnv,
  stdio: "inherit",
});
child.on("exit", (code) => process.exit(code ?? 1));
