import { requireAdmin } from "@/lib/supabase/require-admin";

export async function GET() {
  const { admin, unconfigured, user } = await requireAdmin();
  if (unconfigured) return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  return Response.json({ admin });
}
