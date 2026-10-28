import { searchCatalogPlayers } from "@/data/catalog";
import { catalogSearchReady, normalizeCatalogSearch } from "@/lib/catalog-search";
import { requireAdmin } from "@/lib/supabase/require-admin";
import { NextRequest } from "next/server";

export async function GET(request: NextRequest) {
  const { admin, unconfigured, user } = await requireAdmin();
  if (unconfigured) return Response.json({ error: "Supabase is not configured" }, { status: 503 });
  if (!user) return Response.json({ error: "Sign in required" }, { status: 401 });
  if (!admin) return Response.json({ error: "Forbidden" }, { status: 403 });

  const query = normalizeCatalogSearch(request.nextUrl.searchParams.get("q") ?? "");
  if (!catalogSearchReady(query)) {
    return Response.json({ error: "Invalid query" }, { status: 400 });
  }

  try {
    const players = await searchCatalogPlayers(query);
    return Response.json({ players });
  } catch {
    return Response.json({ error: "Search failed" }, { status: 500 });
  }
}
