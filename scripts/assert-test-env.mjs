/**
 * Use only .env.test.local. Abort if the test project URL matches production.
 * Prints host equality, never URL or key values.
 */
import fs from "fs";
import path from "path";

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

function urlHost(raw) {
  if (!raw) return null;
  try {
    return new URL(raw).host.toLowerCase();
  } catch {
    return null;
  }
}

const root = process.cwd();
const testPath = path.join(root, ".env.test.local");
const prodPath = path.join(root, ".env.local");

if (!fs.existsSync(testPath)) {
  console.error("Missing .env.test.local");
  process.exit(1);
}

const test = loadEnvFile(testPath);
const prod = loadEnvFile(prodPath);
const testHost = urlHost(test.NEXT_PUBLIC_SUPABASE_URL);
const prodHost = urlHost(prod.NEXT_PUBLIC_SUPABASE_URL);
const publishable = test.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || test.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!testHost) {
  console.error("Test env: NEXT_PUBLIC_SUPABASE_URL is missing or not a URL.");
  process.exit(1);
}
if (!publishable) {
  console.error("Test env: publishable/anon key is missing.");
  process.exit(1);
}
if (!prodHost) {
  console.error("Cannot compare: .env.local has no NEXT_PUBLIC_SUPABASE_URL.");
  process.exit(1);
}
if (testHost === prodHost) {
  console.error("ABORT: test project URL host matches production. Refusing to use these settings.");
  process.exit(1);
}

console.log("Test env file: .env.test.local");
console.log("Test URL host differs from production.");
console.log("Publishable key is present (value not printed).");
console.log("Do not load .env.local for this procedure.");
