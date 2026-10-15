"use client";

import { useEffect, useId, useMemo, useState } from "react";
import { ListFields } from "@/components/list-fields";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatListOption } from "@/lib/list-title";
import type { SavedList, SavedListFilters } from "@/lib/supabase/types";

type Props = {
  playerId: string;
  playerName: string;
  lists: SavedList[];
  listId: string;
  onListIdChange: (id: string) => void;
  signedOut: boolean;
  dict: Dictionary;
  onListUpdated: (list: SavedList) => void;
  suggestedTitle: string;
  suggestedClub: string;
  filters?: SavedListFilters;
  queryText?: string | null;
  compact?: boolean;
};

type AddState = "idle" | "saving" | "added" | "created" | "already" | "auth" | "empty" | "title" | "error";
type Mode = "existing" | "new";

export function AddToSavedList({
  playerId,
  playerName,
  lists,
  listId,
  onListIdChange,
  signedOut,
  dict,
  onListUpdated,
  suggestedTitle,
  suggestedClub,
  filters,
  queryText,
  compact = false,
}: Props) {
  const modeName = useId();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>(lists.length ? "existing" : "new");
  const [state, setState] = useState<AddState>("idle");
  const [newTitle, setNewTitle] = useState(suggestedTitle);
  const [newClub, setNewClub] = useState(suggestedClub);

  useEffect(() => {
    setState("idle");
    setOpen(false);
    setMode(listId && lists.some((list) => list.id === listId) ? "existing" : lists.length ? "existing" : "new");
  }, [playerId]);

  const selected = useMemo(() => lists.find((list) => list.id === listId) ?? null, [lists, listId]);
  const already = Boolean(selected?.playerIds.includes(playerId));
  const busy = state === "saving";
  const destinationTitle = mode === "new" ? newTitle.trim() : selected?.title ?? "";

  function openPanel() {
    setOpen(true);
    setState("idle");
    setMode(listId && lists.some((list) => list.id === listId) ? "existing" : lists.length ? "existing" : "new");
    if (state !== "error" && state !== "title") {
      setNewTitle(suggestedTitle);
      setNewClub(suggestedClub);
    }
  }

  async function confirm() {
    if (busy) return;
    if (signedOut) {
      setState("auth");
      return;
    }
    if (mode === "existing") {
      if (!selected) {
        setState("empty");
        return;
      }
      if (already) {
        setState("already");
        return;
      }
      setState("saving");
      try {
        const res = await fetch(`/api/saved-lists/${encodeURIComponent(selected.id)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ addPlayerId: playerId }),
        });
        if (res.status === 401) {
          setState("auth");
          return;
        }
        if (!res.ok) {
          setState("error");
          return;
        }
        const body = (await res.json()) as { list?: SavedList; alreadyMember?: boolean };
        if (body.list) onListUpdated(body.list);
        onListIdChange(selected.id);
        setState(body.alreadyMember ? "already" : "added");
        setOpen(false);
      } catch {
        setState("error");
      }
      return;
    }

    const title = newTitle.trim();
    if (!title) {
      setState("title");
      return;
    }
    setState("saving");
    try {
      const res = await fetch("/api/saved-lists", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title,
          clubName: newClub.trim() || null,
          queryText: queryText || null,
          filters: filters ?? {},
          playerIds: [playerId],
        }),
      });
      if (res.status === 401) {
        setState("auth");
        return;
      }
      if (!res.ok) {
        setState("error");
        return;
      }
      const body = (await res.json()) as { list?: SavedList };
      if (body.list) {
        onListUpdated(body.list);
        onListIdChange(body.list.id);
      }
      setState("created");
      setOpen(false);
    } catch {
      setState("error");
    }
  }

  const message =
    state === "auth"
      ? dict.account.needAccount
      : state === "empty"
        ? dict.account.chooseList
        : state === "title"
          ? dict.account.titleRequired
          : state === "already" || (open && already && mode === "existing")
            ? dict.account.alreadyInList
            : state === "added"
              ? dict.account.addedToList.replace("{list}", selected?.title ?? destinationTitle)
              : state === "created"
                ? dict.account.createdList.replace("{list}", destinationTitle)
                : state === "error"
                  ? dict.account.updateFailed
                  : null;

  const confirmLabel =
    mode === "new"
      ? dict.account.confirmCreatePlayer.replace("{player}", playerName).replace("{list}", newTitle.trim() || "—")
      : dict.account.confirmAdd.replace("{player}", playerName).replace("{list}", selected?.title ?? "—");

  return (
    <div className={compact ? "grid min-w-0 gap-1" : "grid min-w-0 gap-2"}>
      {open ? (
        <div
          className="grid gap-3 rounded-xl border border-slate-800 bg-slate-950 p-3"
          role="dialog"
          aria-label={dict.account.addToList}
        >
          <p className="text-sm font-semibold text-white">{playerName}</p>
          {lists.length > 0 ? (
            <fieldset className="grid gap-2">
              <legend className="sr-only">{dict.account.addToList}</legend>
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="radio"
                  name={modeName}
                  checked={mode === "existing"}
                  disabled={busy}
                  onChange={() => setMode("existing")}
                />
                {dict.account.useExistingList}
              </label>
              <select
                className="min-h-11 w-full min-w-0 rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-white"
                value={selected?.id ?? ""}
                disabled={busy || mode !== "existing"}
                onChange={(event) => onListIdChange(event.target.value)}
              >
                <option value="">{dict.account.chooseList}</option>
                {lists.map((list) => (
                  <option key={list.id} value={list.id}>
                    {formatListOption(list, dict.account.players)}
                  </option>
                ))}
              </select>
              <label className="flex items-center gap-2 text-sm text-slate-200">
                <input
                  type="radio"
                  name={modeName}
                  checked={mode === "new"}
                  disabled={busy}
                  onChange={() => setMode("new")}
                />
                {dict.account.createNewList}
              </label>
            </fieldset>
          ) : (
            <p className="text-sm text-slate-300">{dict.account.createNewList}</p>
          )}
          {mode === "new" ? (
            <ListFields
              dict={dict}
              title={newTitle}
              club={newClub}
              disabled={busy}
              onTitleChange={setNewTitle}
              onClubChange={setNewClub}
            />
          ) : null}
          <p className="text-sm text-slate-300">{confirmLabel}</p>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="save-list min-h-11" disabled={busy} onClick={() => void confirm()}>
              {busy
                ? mode === "new"
                  ? dict.account.creating
                  : dict.account.addingToList
                : dict.account.confirmAction}
            </button>
            <button
              type="button"
              className="btn-ghost min-h-11"
              disabled={busy}
              onClick={() => {
                if (busy) return;
                setOpen(false);
              }}
            >
              {dict.account.cancel}
            </button>
          </div>
        </div>
      ) : (
        <button type="button" className={`save-list ${compact ? "min-h-9" : "min-h-11 w-full"}`} onClick={openPanel}>
          {dict.account.addToList}
        </button>
      )}
      {message ? (
        <p
          className={
            state === "already" || (open && already && mode === "existing") || state === "added" || state === "created"
              ? "text-sm text-emerald-400"
              : "agent-msg"
          }
          role="status"
        >
          {message}
        </p>
      ) : null}
    </div>
  );
}
