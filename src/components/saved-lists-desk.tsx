"use client";

import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import type { Player } from "@/data/mock-players";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { QuickShare } from "@/components/quick-share";
import {
  filterSavedLists,
  nextListAfterDelete,
  savedListsPath,
  searchPathFromFilters,
} from "@/lib/list-search";
import { formatListOption } from "@/lib/list-title";
import { playerSearchPath } from "@/lib/player-link";
import { uniquePlayerIds } from "@/lib/player-ids";
import { sharedListPath } from "@/lib/share-token";
import type { SavedList } from "@/lib/supabase/types";

type Props = {
  lang: Locale;
  dict: Dictionary;
};

type LoadState = "loading" | "ok" | "auth" | "error";

const LIST_SEARCH_MIN = 6;

async function loadPlayersByIds(ids: string[]): Promise<Record<string, Player>> {
  const byId: Record<string, Player> = {};
  const unique = uniquePlayerIds(ids);
  const chunkSize = 200;
  for (let i = 0; i < unique.length; i += chunkSize) {
    const chunk = unique.slice(i, i + chunkSize);
    const playersRes = await fetch(`/api/players?ids=${encodeURIComponent(chunk.join(","))}`);
    const playersBody = (await playersRes.json()) as { players?: Player[] };
    if (!playersRes.ok) throw new Error("load");
    for (const player of playersBody.players ?? []) {
      byId[player.id] = player;
    }
  }
  return byId;
}

export function SavedListsDesk({ lang, dict }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const urlListId = searchParams.get("list")?.trim() || "";
  const [lists, setLists] = useState<SavedList[]>([]);
  const [playersById, setPlayersById] = useState<Record<string, Player>>({});
  const [state, setState] = useState<LoadState>("loading");
  const [notice, setNotice] = useState<string | null>(null);
  const [noticeError, setNoticeError] = useState(false);
  const [query, setQuery] = useState("");
  const [failedLoadId, setFailedLoadId] = useState<string | null>(null);
  const pickerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLElement>(null);
  const skipScroll = useRef(true);

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
        if (!cancelled) {
          setLists(body.lists ?? []);
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

  const selected = useMemo(
    () => lists.find((list) => list.id === urlListId) ?? null,
    [lists, urlListId],
  );
  const missing = state === "ok" && lists.length > 0 && Boolean(urlListId) && !selected;
  const empty = state === "ok" && lists.length === 0;
  const filtered = useMemo(() => filterSavedLists(lists, query), [lists, query]);
  const pickerLists = useMemo(() => {
    if (!selected || filtered.some((list) => list.id === selected.id)) return filtered;
    return [selected, ...filtered];
  }, [filtered, selected]);
  const showSearch = lists.length >= LIST_SEARCH_MIN;

  useEffect(() => {
    if (state !== "ok" || lists.length === 0 || urlListId) return;
    router.replace(savedListsPath(lang, lists[0].id), { scroll: false });
  }, [state, lists, urlListId, lang, router]);

  useEffect(() => {
    if (missing) skipScroll.current = false;
  }, [missing]);

  const membersPending = Boolean(
    selected &&
      failedLoadId !== selected.id &&
      uniquePlayerIds(selected.playerIds).some((id) => !playersById[id]),
  );

  useEffect(() => {
    if (!selected) return;
    const needed = uniquePlayerIds(selected.playerIds).filter((id) => !playersById[id]);
    if (!needed.length) return;
    let cancelled = false;
    loadPlayersByIds(needed)
      .then((byId) => {
        if (cancelled) return;
        setPlayersById((current) => ({ ...current, ...byId }));
      })
      .catch(() => {
        if (!cancelled) {
          setFailedLoadId(selected.id);
          setNotice(dict.account.loadFailed);
          setNoticeError(true);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [selected, playersById, dict.account.loadFailed]);

  const selectedId = selected?.id;
  useEffect(() => {
    if (!selectedId) return;
    if (skipScroll.current) {
      skipScroll.current = false;
      return;
    }
    contentRef.current?.scrollIntoView({ block: "start" });
  }, [selectedId]);

  useLayoutEffect(() => {
    const el = pickerRef.current;
    if (!el) return;
    const apply = () => {
      document.documentElement.style.setProperty("--list-picker-height", `${el.offsetHeight}px`);
    };
    apply();
    const observer = new ResizeObserver(apply);
    observer.observe(el);
    return () => {
      observer.disconnect();
      document.documentElement.style.setProperty("--list-picker-height", "0px");
    };
  }, [showSearch, empty, state]);

  function goToList(id: string, mode: "push" | "replace") {
    const path = savedListsPath(lang, id);
    if (mode === "replace") router.replace(path, { scroll: false });
    else router.push(path, { scroll: false });
  }

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
      {state === "ok" && lists.length > 0 ? (
        <div ref={pickerRef} className="list-picker">
          <label className="grid gap-1">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">
              {dict.account.myLists}
            </span>
            {showSearch ? (
              <input
                className="min-h-11 rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-white md:max-w-xl"
                value={query}
                autoComplete="off"
                placeholder={dict.account.findListPlaceholder}
                aria-label={dict.account.findList}
                onChange={(event) => setQuery(event.target.value)}
              />
            ) : null}
            <select
              className="min-h-11 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-white md:max-w-xl"
              value={selected?.id ?? ""}
              aria-label={dict.account.myLists}
              onChange={(event) => {
                const id = event.target.value;
                if (id) goToList(id, "push");
              }}
            >
              {missing ? <option value="">{dict.account.selectList}</option> : null}
              {pickerLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {formatListOption(list, dict.account.players)}
                </option>
              ))}
            </select>
          </label>
          {showSearch && query.trim() && filtered.length === 0 ? (
            <p className="mt-2 text-sm text-slate-400">{dict.account.noMatchingLists}</p>
          ) : null}
        </div>
      ) : null}
      <section
        ref={contentRef}
        className="list-content"
      >
        {missing ? (
          <p className="lede" role="status">
            {dict.account.listNotFound}
          </p>
        ) : null}
        {selected ? (
          <ul className="saved-lists">
            <SavedListCard
              list={selected}
              playersById={playersById}
              membersLoading={membersPending}
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
                const next = nextListAfterDelete(lists, selected.id);
                setLists((current) => current.filter((item) => item.id !== selected.id));
                setNotice(dict.account.deletedList);
                setNoticeError(false);
                if (next) goToList(next.id, "replace");
                else router.replace(savedListsPath(lang), { scroll: false });
              }}
              onError={(message) => {
                setNotice(message);
                setNoticeError(true);
              }}
            />
          </ul>
        ) : null}
      </section>
    </main>
  );
}

function SavedListCard({
  list,
  playersById,
  membersLoading,
  lang,
  dict,
  onUpdated,
  onDeleted,
  onError,
}: {
  list: SavedList;
  playersById: Record<string, Player>;
  membersLoading: boolean;
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
        ) : membersLoading ? (
          <li className="text-sm text-slate-500">…</li>
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
