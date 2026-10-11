"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Player } from "@/data/mock-players";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { searchPathFromFilters } from "@/lib/list-search";
import { playerSearchPath } from "@/lib/player-link";
import { uniquePlayerIds } from "@/lib/player-ids";
import type { SavedList } from "@/lib/supabase/types";

type Props = {
  lang: Locale;
  dict: Dictionary;
};

type LoadState = "loading" | "ok" | "auth" | "error";

export function SavedListsDesk({ lang, dict }: Props) {
  const [lists, setLists] = useState<SavedList[]>([]);
  const [playersById, setPlayersById] = useState<Record<string, Player>>({});
  const [state, setState] = useState<LoadState>("loading");

  useEffect(() => {
    let cancelled = false;
    fetch("/api/saved-lists")
      .then(async (res) => {
        const body = (await res.json()) as { lists?: SavedList[]; error?: string };
        if (res.status === 401) {
          if (!cancelled) setState("auth");
          return;
        }
        if (!res.ok) throw new Error(body.error || dict.account.loadFailed);
        const nextLists = body.lists ?? [];
        const ids = uniquePlayerIds(nextLists.flatMap((list) => list.playerIds));
        const byId: Record<string, Player> = {};
        const chunkSize = 200;
        for (let i = 0; i < ids.length; i += chunkSize) {
          const chunk = ids.slice(i, i + chunkSize);
          const playersRes = await fetch(`/api/players?ids=${encodeURIComponent(chunk.join(","))}`);
          const playersBody = (await playersRes.json()) as { players?: Player[] };
          if (!playersRes.ok) throw new Error(dict.account.loadFailed);
          for (const player of playersBody.players ?? []) {
            byId[player.id] = player;
          }
        }
        if (!cancelled) {
          setLists(nextLists);
          setPlayersById(byId);
          setState("ok");
        }
      })
      .catch(() => {
        if (!cancelled) setState("error");
      });
    return () => {
      cancelled = true;
    };
  }, [dict.account.loadFailed]);

  const empty = state === "ok" && lists.length === 0;

  return (
    <main className="page">
      <section className="hero hero-compact">
        <p className="kicker text-xs font-semibold uppercase tracking-wider text-emerald-400">
          {dict.nav.lists}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">{dict.account.title}</h1>
        {state === "auth" ? <p className="lede">{dict.account.needAccount}</p> : null}
        {state === "error" ? (
          <p className="agent-msg" role="alert">
            {dict.account.loadFailed}
          </p>
        ) : null}
        {empty ? <p className="lede">{dict.account.empty}</p> : null}
      </section>
      {state === "loading" ? <p className="text-sm text-slate-400">…</p> : null}
      <ul className="saved-lists">
        {lists.map((list) => (
          <SavedListCard
            key={list.id}
            list={list}
            playersById={playersById}
            lang={lang}
            dict={dict}
          />
        ))}
      </ul>
    </main>
  );
}

function SavedListCard({
  list,
  playersById,
  lang,
  dict,
}: {
  list: SavedList;
  playersById: Record<string, Player>;
  lang: Locale;
  dict: Dictionary;
}) {
  const ids = useMemo(() => uniquePlayerIds(list.playerIds), [list.playerIds]);
  const repeatHref = searchPathFromFilters(lang, list.filters);

  return (
    <li>
      <h2>{list.title}</h2>
      <p>
        {list.clubName ? `${list.clubName} · ` : ""}
        {dict.account.players.replace("{count}", String(ids.length))}
      </p>
      {list.queryText ? <p className="break-words text-sm text-slate-500">{list.queryText}</p> : null}
      <ul className="mt-3 grid list-none gap-2 p-0">
        {ids.length === 0 ? (
          <li className="text-sm text-slate-500">{dict.account.emptyMembers}</li>
        ) : (
          ids.map((id) => {
            const player = playersById[id];
            if (!player) {
              return (
                <li key={id} className="text-sm text-slate-400">
                  {dict.account.playerMissing}
                </li>
              );
            }
            return (
              <li key={id}>
                <Link
                  className="text-sm font-semibold text-emerald-400 no-underline"
                  href={playerSearchPath(lang, player.id)}
                >
                  {player.name}
                </Link>
                <span className="ml-2 text-xs text-slate-500">{player.position}</span>
              </li>
            );
          })
        )}
      </ul>
      <p className="mt-4">
        <Link className="text-sm font-semibold text-emerald-400 no-underline" href={repeatHref}>
          {dict.account.repeatSearch}
        </Link>
      </p>
    </li>
  );
}
