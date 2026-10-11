import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { supabaseAnonKey, supabaseUrl } from "@/lib/supabase/env";

export type AuthCookie = {
  name: string;
  value: string;
  options?: Parameters<NextResponse["cookies"]["set"]>[2];
};

export function createRouteSupabase(request: NextRequest, jar: AuthCookie[]) {
  return createServerClient(supabaseUrl(), supabaseAnonKey(), {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        jar.push(...(cookiesToSet as AuthCookie[]));
      },
    },
  });
}

export function withAuthCookies(response: NextResponse, jar: AuthCookie[]) {
  for (const { name, value, options } of jar) {
    response.cookies.set(name, value, options);
  }
  return response;
}
