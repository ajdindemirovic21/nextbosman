"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import type { SavedList } from "@/lib/supabase/types";

type Props = {
  lang: Locale;
  dict: Dictionary;
};

export function SavedListsDesk({ lang, dict }: Props) {
  const [lists, setLists] = useState<SavedList[]>([]);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/saved-lists")
      .then(async (res) => {
        const body = (await res.json()) as { lists?: SavedList[]; error?: string };
        if (!res.ok) throw new Error(body.error || dict.account.error);
        if (!cancelled) setLists(body.lists ?? []);
      })
      .catch((err: Error) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [dict.account.error]);

  return (
    <main className="page">
      <section className="hero hero-compact">
        <p className="kicker text-xs font-semibold uppercase tracking-wider text-emerald-400">
          {dict.nav.lists}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">{dict.account.title}</h1>
        <p className="lede">{dict.account.needAccount}</p>
      </section>
      {loading ? <p className="note">…</p> : null}
      {error ? <p className="agent-msg">{error}</p> : null}
      {!loading && !error && lists.length === 0 ? <p className="lede">{dict.account.empty}</p> : null}
      <ul className="saved-lists">
        {lists.map((list) => (
          <li key={list.id}>
            <h2>{list.title}</h2>
            <p>
              {list.clubName ? `${list.clubName} · ` : ""}
              {dict.account.players.replace("{count}", String(list.playerIds.length))}
            </p>
            {list.queryText ? <p className="note">{list.queryText}</p> : null}
            <Link href={`/${lang}/search?status=${list.filters.status ?? "free"}`}>
              {dict.nav.search}
            </Link>
          </li>
        ))}
      </ul>
    </main>
  );
}
