const JWT = /eyj[a-z0-9_-]+\.[a-z0-9_-]+\.[a-z0-9_-]+/gi;
const BEARER = /bearer\s+[a-z0-9._-]+/gi;
const SUPABASE_URL = /https:\/\/[a-z0-9-]+\.supabase\.co[^\s"']*/gi;
const SB_KEY = /sb_(?:secret|publishable|service_role)_[a-z0-9_-]+/gi;

export function redactSecrets(text: string) {
  return String(text ?? "")
    .replace(BEARER, "bearer [redacted]")
    .replace(JWT, "[jwt]")
    .replace(SB_KEY, "[redacted]")
    .replace(SUPABASE_URL, "[supabase-url]");
}
