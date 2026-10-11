"use client";

import { useEffect, useMemo, useState } from "react";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { SavedList } from "@/lib/supabase/types";

type Props = {
  playerId: string;
  lists: SavedList[];
  listId: string;
  onListIdChange: (id: string) => void;
  signedOut: boolean;
  dict: Dictionary;
  onListUpdated: (list: SavedList) => void;
  showPicker?: boolean;
  compact?: boolean;
};

type AddState = "idle" | "saving" | "added" | "already" | "auth" | "empty" | "error";

export function AddToSavedList({
  playerId,
  lists,
  listId,
  onListIdChange,
  signedOut,
  dict,
  onListUpdated,
  showPicker = false,
  compact = false,
}: Props) {
  const [state, setState] = useState<AddState>("idle");

  useEffect(() => {
    setState("idle");
  }, [playerId, listId]);

  const selected = useMemo(() => lists.find((list) => list.id === listId) ?? lists[0] ?? null, [lists, listId]);
  const already = Boolean(selected?.playerIds.includes(playerId));
  const busy = state === "saving";

  async function add() {
    if (busy) return;
    if (signedOut) {
      setState("auth");
      return;
    }
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
      setState(body.alreadyMember ? "already" : "added");
    } catch {
      setState("error");
    }
  }

  const message =
    state === "auth"
      ? dict.account.needAccount
      : state === "empty"
        ? dict.account.noListsYet
        : already || state === "already"
          ? dict.account.alreadyInList
          : state === "added"
            ? dict.account.addedToList.replace("{list}", selected?.title ?? "")
            : state === "error"
              ? dict.account.updateFailed
              : null;

  return (
    <div className={compact ? "grid min-w-0 gap-1" : "grid min-w-0 gap-2"}>
      {showPicker && lists.length > 0 ? (
        <label className="grid gap-1 text-xs text-slate-400">
          <span>{dict.account.selectList}</span>
          <select
            className="min-h-11 w-full min-w-0 rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-white"
            value={selected?.id ?? ""}
            disabled={busy}
            onChange={(event) => {
              onListIdChange(event.target.value);
            }}
          >
            {lists.map((list) => (
              <option key={list.id} value={list.id}>
                {list.title}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <button
        type="button"
        className={`save-list ${compact ? "min-h-9" : "min-h-11 w-full"}`}
        disabled={busy}
        onClick={() => void add()}
      >
        {busy ? dict.account.addingToList : dict.account.addToList}
      </button>
      {message ? (
        <p
          className={
            already || state === "already" || state === "added"
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
