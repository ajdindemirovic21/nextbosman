"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { createBrowserSupabase } from "@/lib/supabase/client";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";

type Props = {
  lang: Locale;
  dict: Dictionary;
  embedded?: boolean;
};

export function AgentMenu({ lang, dict, embedded }: Props) {
  const [user, setUser] = useState<User | null>(null);
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function openPanel() {
    setOpen(true);
    setMessage("");
  }

  useEffect(() => {
    if (!isSupabaseConfigured()) return;
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(({ data }) => setUser(data.user ?? null));
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  async function submit(mode: "in" | "up") {
    setBusy(true);
    setMessage("");
    const supabase = createBrowserSupabase();
    const { data, error } =
      mode === "in"
        ? await supabase.auth.signInWithPassword({ email, password })
        : await supabase.auth.signUp({ email, password });
    setBusy(false);
    if (error) {
      setMessage(error.message);
      return;
    }
    if (data.session) {
      setUser(data.session.user);
      setOpen(false);
      setPassword("");
      return;
    }
    setMessage(dict.account.confirm);
  }

  async function signOut() {
    await createBrowserSupabase().auth.signOut();
    setUser(null);
  }

  if (user) {
    return (
      <div className={embedded ? "grid gap-3" : "agent-menu"}>
        <Link
          className={
            embedded
              ? "whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-slate-300 no-underline"
              : "!hidden whitespace-nowrap rounded-lg px-3 py-1.5 text-sm text-slate-300 no-underline transition hover:bg-slate-800/60 hover:text-white md:!inline-flex"
          }
          href={`/${lang}/lists`}
        >
          {dict.nav.lists}
        </Link>
        {embedded ? (
          <p className="truncate text-xs text-slate-400">{user.email}</p>
        ) : (
          <span className="hidden max-w-[9rem] truncate text-xs text-slate-400 sm:inline">
            {user.email}
          </span>
        )}
        <button
          type="button"
          className="shrink-0 whitespace-nowrap rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-3 py-1.5 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/20"
          onClick={() => void signOut()}
        >
          {dict.account.signOut}
        </button>
      </div>
    );
  }

  const showForm = embedded || open;

  return (
    <div className={embedded ? "grid gap-3" : "agent-menu"}>
      {embedded ? null : (
        <>
          <button
            type="button"
            className="min-h-10 shrink-0 whitespace-nowrap rounded-lg border border-emerald-500/60 bg-emerald-500/10 px-3 py-2 text-sm font-medium text-emerald-400 transition hover:bg-emerald-500/20"
            onClick={() => (open ? setOpen(false) : openPanel())}
          >
            {dict.account.signIn}
          </button>
          <button
            type="button"
            className="min-h-10 shrink-0 whitespace-nowrap rounded-lg border border-slate-500 bg-slate-800 px-3 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            onClick={() => (open ? setOpen(false) : openPanel())}
          >
            {dict.account.signUp}
          </button>
        </>
      )}
      {showForm ? (
        <form
          className={
            embedded
              ? "grid gap-3"
              : "agent-panel rounded-2xl border border-slate-800/80 bg-slate-900/70 shadow-xl backdrop-blur-md"
          }
          onSubmit={(event) => {
            event.preventDefault();
            void submit("in");
          }}
        >
          <label>
            {dict.account.email}
            <input
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              required
            />
          </label>
          <label>
            {dict.account.password}
            <input
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100 focus:border-emerald-500 focus:outline-none"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
            />
          </label>
          {message ? <p className="agent-msg">{message}</p> : null}
          <div className="agent-actions">
            <button type="submit" disabled={busy}>
              {dict.account.signIn}
            </button>
            <button type="button" disabled={busy} onClick={() => void submit("up")}>
              {dict.account.signUp}
            </button>
          </div>
          <p className="agent-hint">{dict.account.confirm}</p>
        </form>
      ) : null}
    </div>
  );
}
