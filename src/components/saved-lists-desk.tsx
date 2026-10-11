"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import type { Player } from "@/data/mock-players";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { QuickShare } from "@/components/quick-share";
import { searchPathFromFilters } from "@/lib/list-search";
import { playerSearchPath } from "@/lib/player-link";
import { uniquePlayerIds } from "@/lib/player-ids";
import { sharedListPath } from "@/lib/share-token";
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
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeError, setNoticeError] = useState(false);

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
        {notice ? (
          <p className={noticeError ? "agent-msg" : "text-sm text-emerald-400"} role={noticeError ? "alert" : "status"}>
            {notice}
          </p>
        ) : null}
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
            onUpdated={(next, message) => {
              setLists((current) => current.map((item) => (item.id === next.id ? next : item)));
              if (message) {
                setNotice(message);
                setNoticeError(false);
              }
            }}
            onDeleted={() => {
              setLists((current) => current.filter((item) => item.id !== list.id));
              setNotice(dict.account.deletedList);
              setNoticeError(false);
            }}
            onError={(message) => {
              setNotice(message);
              setNoticeError(true);
            }}
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
  onUpdated,
  onDeleted,
  onError,
}: {
  list: SavedList;
  playersById: Record<string, Player>;
  lang: Locale;
  dict: Dictionary;
  onUpdated: (list: SavedList, message?: string) => void;
  onDeleted: () => void;
  onError: (message: string) => void;
}) {
  const ids = useMemo(() => uniquePlayerIds(list.playerIds), [list.playerIds]);
  const repeatHref = searchPathFromFilters(lang, list.filters);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const busy = busyId !== null;

  async function removePlayer(playerId: string) {
    if (busy) return;
    setBusyId(playerId);
    try {
      const res = await fetch(`/api/saved-lists/${encodeURIComponent(list.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ removePlayerId: playerId }),
      });
      if (res.status === 401) {
        onError(dict.account.needAccount);
        return;
      }
      if (!res.ok) {
        onError(dict.account.updateFailed);
        return;
      }
      const body = (await res.json()) as { list?: SavedList };
      if (body.list) onUpdated(body.list, dict.account.removedPlayer);
    } catch {
      onError(dict.account.updateFailed);
    } finally {
      setBusyId(null);
    }
  }

  async function setSharing(share: boolean) {
    if (busy) return;
    setBusyId("share");
    try {
      const res = await fetch(`/api/saved-lists/${encodeURIComponent(list.id)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ share }),
      });
      if (res.status === 401) {
        onError(dict.account.needAccount);
        return;
      }
      if (!res.ok) {
        onError(dict.account.shareFailed);
        return;
      }
      const body = (await res.json()) as { list?: SavedList };
      if (body.list) onUpdated(body.list, share ? dict.account.shareEnabled : dict.account.shareDisabled);
    } catch {
      onError(dict.account.shareFailed);
    } finally {
      setBusyId(null);
    }
  }

  async function deleteList() {
    if (busy) return;
    setBusyId("delete");
    try {
      const res = await fetch(`/api/saved-lists/${encodeURIComponent(list.id)}`, { method: "DELETE" });
      if (res.status === 401) {
        onError(dict.account.needAccount);
        return;
      }
      if (!res.ok) {
        onError(dict.account.deleteFailed);
        return;
      }
      onDeleted();
    } catch {
      onError(dict.account.deleteFailed);
    } finally {
      setBusyId(null);
    }
  }

  return (
    <li>
      <h2>{list.title}</h2>
      <p>
        {list.clubName ? `${list.clubName} · ` : ""}
        {dict.account.players.replace("{count}", String(ids.length))}
      </p>
      {list.queryText ? <p className="break-words text-sm text-slate-500">{list.queryText}</p> : null}
      <p className="mt-3 text-sm text-slate-400">{dict.account.shareWarning}</p>
      {list.shareToken ? (
        <>
          <p className="text-sm text-amber-200/90">{dict.account.shareAnyone}</p>
          <div className="mt-2 max-w-md">
            <QuickShare dict={dict} path={sharedListPath(lang, list.shareToken)} text={list.title} />
          </div>
        </>
      ) : null}
      <ul className="mt-3 grid list-none gap-2 p-0">
        {ids.length === 0 ? (
          <li className="text-sm text-slate-500">{dict.account.emptyMembers}</li>
        ) : (
          ids.map((id) => {
            const player = playersById[id];
            return (
              <li key={id} className="flex flex-wrap items-center justify-between gap-2">
                <span>
                  {player ? (
                    <>
                      <Link
                        className="text-sm font-semibold text-emerald-400 no-underline"
                        href={playerSearchPath(lang, player.id)}
                      >
                        {player.name}
                      </Link>
                      <span className="ml-2 text-xs text-slate-500">{player.position}</span>
                    </>
                  ) : (
                    <span className="text-sm text-slate-400">{dict.account.playerMissing}</span>
                  )}
                </span>
                <button
                  type="button"
                  className="save-list"
                  disabled={busy}
                  onClick={() => void removePlayer(id)}
                >
                  {busyId === id ? dict.account.removing : dict.account.removePlayer}
                </button>
              </li>
            );
          })
        )}
      </ul>
      <p className="mt-4 flex flex-wrap items-center gap-3">
        <Link className="text-sm font-semibold text-emerald-400 no-underline" href={repeatHref}>
          {dict.account.repeatSearch}
        </Link>
        <button
          type="button"
          className="save-list"
          disabled={busy}
          onClick={() => void setSharing(!list.shareToken)}
        >
          {busyId === "share"
            ? dict.account.sharing
            : list.shareToken
              ? dict.account.shareOff
              : dict.account.shareOn}
        </button>
        {confirmDelete ? (
          <>
            <span className="text-sm text-slate-300">
              {dict.account.deleteConfirm.replace("{title}", list.title)}
            </span>
            <button type="button" className="save-list" disabled={busy} onClick={() => setConfirmDelete(false)}>
              {dict.account.cancel}
            </button>
            <button type="button" className="save-list" disabled={busy} onClick={() => void deleteList()}>
              {busyId === "delete" ? dict.account.deleting : dict.account.confirmDelete}
            </button>
          </>
        ) : (
          <button type="button" className="save-list" disabled={busy} onClick={() => setConfirmDelete(true)}>
            {dict.account.deleteList}
          </button>
        )}
      </p>
    </li>
  );
}
