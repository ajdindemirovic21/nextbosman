"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import type { User } from "@supabase/supabase-js";
import { GoogleSignIn } from "@/components/google-sign-in";
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
  const [authReady, setAuthReady] = useState(!isSupabaseConfigured());
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  function openPanel() {
    setOpen(true);
    setMessage("");
  }

  useEffect(() => {
    if (!isSupabaseConfigured()) {
      setAuthReady(true);
      return;
    }
    const supabase = createBrowserSupabase();
    supabase.auth.getUser().then(({ data }) => {
      setUser(data.user ?? null);
      setAuthReady(true);
    });
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
      setAuthReady(true);
    });
    return () => data.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    if (!open || embedded) return;
    function onPointer(event: MouseEvent) {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointer);
    document.addEventListener("keydown", onKey);
    const first = rootRef.current?.querySelector<HTMLElement>("button, input");
    queueMicrotask(() => first?.focus());
    return () => {
      document.removeEventListener("mousedown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, embedded]);

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

  if (!authReady) {
    return embedded ? (
      <p className="text-sm text-slate-400">{dict.nav.profile}</p>
    ) : (
      <div className="agent-menu min-h-10 w-10" aria-hidden />
    );
  }

  if (user) {
    const meta = user.user_metadata ?? {};
    const name = String(meta.full_name || meta.name || user.email || "Agent");
    const photo = String(meta.avatar_url || meta.picture || "");
    const initial = name.slice(0, 1).toUpperCase();

    return (
      <div className={embedded ? "grid gap-3" : "agent-menu"}>
        <span className="inline-flex min-w-0 max-w-[10rem] items-center gap-2 sm:max-w-[12rem]">
          {photo ? (
            <img
              src={photo}
              alt=""
              width={28}
              height={28}
              className="h-7 w-7 shrink-0 rounded-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/20 text-xs font-semibold text-emerald-300">
              {initial}
            </span>
          )}
          <span className="hidden min-w-0 truncate text-sm text-slate-100 lg:inline" title={user.email ?? name}>
            {name}
          </span>
        </span>
        {embedded ? (
          <Link className="btn-text" href={`/${lang}/lists`}>
            {dict.nav.lists}
          </Link>
        ) : null}
        <button type="button" className="btn-secondary shrink-0" onClick={() => void signOut()}>
          {dict.account.signOut}
        </button>
        {embedded ? null : (
          <Link className="btn-text hidden xl:inline" href={`/${lang}/support`}>
            {dict.nav.support}
          </Link>
        )}
      </div>
    );
  }

  const showForm = embedded || open;

  return (
    <div ref={rootRef} className={embedded ? "grid gap-3" : "agent-menu"}>
      {embedded ? null : (
        <>
          <Link className="btn-text hidden xl:inline" href={`/${lang}/support`}>
            {dict.nav.support}
          </Link>
          <button
            type="button"
            className="btn-primary min-h-10 shrink-0 px-3 py-2 text-sm"
            aria-expanded={open}
            aria-haspopup="dialog"
            aria-controls="sign-in-dialog"
            onClick={() => (open ? setOpen(false) : openPanel())}
          >
            {dict.account.signIn}
          </button>
        </>
      )}
      {showForm ? (
        <form
          id={embedded ? undefined : "sign-in-dialog"}
          role={embedded ? undefined : "dialog"}
          aria-label={dict.account.signIn}
          className={
            embedded
              ? "grid gap-3"
              : "agent-panel rounded-2xl border border-slate-800/80 bg-slate-900/95 shadow-xl backdrop-blur-md"
          }
          onSubmit={(event) => {
            event.preventDefault();
            void submit("in");
          }}
        >
          {embedded ? null : (
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-semibold text-white">{dict.account.signIn}</p>
              <button type="button" className="btn-secondary px-3 py-1.5 text-sm" onClick={() => setOpen(false)}>
                {dict.profile.close}
              </button>
            </div>
          )}
          <GoogleSignIn lang={lang} dict={dict} />
          <label>
            {dict.account.email}
            <input
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100 focus-visible:border-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
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
              className="w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100 focus-visible:border-emerald-500 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              required
              minLength={6}
            />
          </label>
          {message ? <p className="agent-msg" role="alert">{message}</p> : null}
          <div className="agent-actions">
            <button type="submit" className="btn-primary" disabled={busy}>
              {dict.account.signIn}
            </button>
            <button type="button" className="btn-secondary" disabled={busy} onClick={() => void submit("up")}>
              {dict.account.signUp}
            </button>
          </div>
          <Link className="btn-text" href={`/${lang}/support`}>
            {dict.nav.support}
          </Link>
        </form>
      ) : null}
    </div>
  );
}
