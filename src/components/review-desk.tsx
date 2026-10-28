"use client";

import { useState } from "react";
import type { Player } from "@/data/mock-players";
import type { CatalogSearchHit } from "@/lib/catalog-search";
import type { Dictionary } from "@/i18n/get-dictionary";
import { catalogSearchReady, normalizeCatalogSearch, playerFromSearchHit } from "@/lib/catalog-search";
import { formatListedClub, contractPrimary } from "@/lib/contract-display";
import { isPlayerId } from "@/lib/player-ids";
import {
  validateReviewDraft,
  type CheckStatus,
  type ClubMode,
  type FieldMode,
  type ReviewDraft,
} from "@/lib/player-review";

type HistoryRow = {
  id: string;
  kind: string;
  created_at: string;
  created_by: string;
  check_status: string | null;
  public_note: string | null;
  private_note: string | null;
  active: boolean;
};

type ReviewRow = {
  player_id: string;
  active: boolean;
  head_revision_id: string;
  check_status: CheckStatus;
  club_mode: ClubMode;
  club_value: string | null;
  contract_mode: FieldMode;
  contract_value: string | null;
  source_url: string;
  event_at: string | null;
  public_note: string;
};

type Props = {
  dict: Dictionary;
  locale: string;
};

const emptyDraft: ReviewDraft = {
  checkStatus: "unknown",
  clubMode: "unknown",
  clubValue: "",
  contractMode: "unknown",
  contractValue: "",
  sourceUrl: "",
  eventAt: "",
  publicNote: "",
  privateNote: "",
};

export function ReviewDesk({ dict, locale }: Props) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<CatalogSearchHit[]>([]);
  const [searched, setSearched] = useState(false);
  const [playerId, setPlayerId] = useState("");
  const [player, setPlayer] = useState<Player | null>(null);
  const [review, setReview] = useState<ReviewRow | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [draft, setDraft] = useState<ReviewDraft>(emptyDraft);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  function loadErrorMessage(status: number, error: string | undefined) {
    if (status === 403 || error === "Forbidden") return dict.review.forbidden;
    if (status === 401) return dict.review.needSignIn;
    if (status === 400 || error === "Invalid player") return dict.review.invalidPlayerId;
    if (status === 404 || error === "Not found") return dict.review.notInCatalog;
    return dict.review.loadFailed;
  }

  async function load(id = playerId) {
    const nextId = id.trim();
    if (!isPlayerId(nextId)) {
      setMessage(dict.review.invalidPlayerId);
      return;
    }
    setBusy(true);
    setMessage("");
    setPlayerId(nextId);
    let res: Response;
    try {
      res = await fetch(`/api/admin/player-reviews?playerId=${encodeURIComponent(nextId)}`);
    } catch {
      setBusy(false);
      setPlayer(null);
      setReview(null);
      setHistory([]);
      setMessage(dict.review.loadFailed);
      return;
    }
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setPlayer(null);
      setReview(null);
      setHistory([]);
      setMessage(loadErrorMessage(res.status, body.error));
      return;
    }
    const nextPlayer = body.player as Player;
    const nextReview = (body.review ?? null) as ReviewRow | null;
    setPlayer(nextPlayer);
    setReview(nextReview);
    setHistory((body.history ?? []) as HistoryRow[]);
    setDraft(
      nextReview
        ? {
            checkStatus: nextReview.check_status,
            clubMode: nextReview.check_status === "no_club" ? "none" : nextReview.club_mode,
            clubValue: nextReview.club_value ?? "",
            contractMode: nextReview.contract_mode,
            contractValue: nextReview.contract_value?.slice(0, 10) ?? "",
            sourceUrl: nextReview.source_url,
            eventAt: nextReview.event_at?.slice(0, 10) ?? "",
            publicNote: nextReview.public_note ?? "",
            privateNote: "",
          }
        : emptyDraft,
    );
  }

  async function apply() {
    if (!player) return;
    const nextDraft: ReviewDraft =
      draft.checkStatus === "no_club" ? { ...draft, clubMode: "none", clubValue: "" } : draft;
    const invalid = validateReviewDraft(nextDraft, player);
    if (invalid) {
      setMessage(dict.review.invalid);
      return;
    }
    setBusy(true);
    setMessage("");
    const res = await fetch("/api/admin/player-reviews", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId: player.id,
        expectedHeadRevisionId: review?.head_revision_id ?? null,
        draft: nextDraft,
      }),
    });
    const body = await res.json();
    setBusy(false);
    if (res.status === 409) {
      setMessage(dict.review.conflict);
      return;
    }
    if (!res.ok) {
      setMessage(dict.review.saveFailed);
      return;
    }
    setMessage(dict.review.saved);
    void load(player.id);
    return body;
  }

  async function searchCatalog() {
    const value = normalizeCatalogSearch(query);
    if (!catalogSearchReady(value)) {
      setHits([]);
      setSearched(false);
      setMessage(dict.review.searchTooShort);
      return;
    }
    setBusy(true);
    setMessage("");
    setSearched(true);
    let res: Response;
    try {
      res = await fetch(`/api/admin/player-reviews/search?q=${encodeURIComponent(value)}`);
    } catch {
      setBusy(false);
      setHits([]);
      setMessage(dict.review.searchFailed);
      return;
    }
    const body = await res.json().catch(() => ({}));
    setBusy(false);
    if (!res.ok) {
      setHits([]);
      if (res.status === 403 || body.error === "Forbidden") setMessage(dict.review.forbidden);
      else if (res.status === 401) setMessage(dict.review.needSignIn);
      else setMessage(dict.review.searchFailed);
      return;
    }
    const nextHits = (body.players ?? []) as CatalogSearchHit[];
    setHits(nextHits);
    if (!nextHits.length) setMessage(dict.review.noMatches);
  }

  async function deactivate() {
    if (!player || !review) return;
    setBusy(true);
    const res = await fetch("/api/admin/player-reviews/deactivate", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId: player.id,
        expectedHeadRevisionId: review.head_revision_id,
        privateNote: draft.privateNote,
      }),
    });
    setBusy(false);
    if (res.status === 409) {
      setMessage(dict.review.conflict);
      return;
    }
    if (!res.ok) {
      setMessage(dict.review.saveFailed);
      return;
    }
    setMessage(dict.review.deactivated);
    void load(player.id);
  }

  async function rollback(revisionId: string) {
    if (!player || !review) return;
    setBusy(true);
    const res = await fetch("/api/admin/player-reviews/rollback", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        playerId: player.id,
        revisionId,
        expectedHeadRevisionId: review.head_revision_id,
      }),
    });
    setBusy(false);
    if (res.status === 409) {
      setMessage(dict.review.conflict);
      return;
    }
    if (!res.ok) {
      setMessage(dict.review.saveFailed);
      return;
    }
    setMessage(dict.review.rolledBack);
    void load(player.id);
  }

  const clubLocked = draft.checkStatus === "no_club";

  return (
    <div className="grid gap-6">
      <form
        className="grid gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void searchCatalog();
        }}
      >
        <label className="grid gap-1 text-sm">
          {dict.review.searchLabel}
          <input
            className="min-h-11 w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setSearched(false);
            }}
            autoComplete="off"
            enterKeyHint="search"
          />
        </label>
        <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
          <button type="submit" className="btn-primary min-h-11 w-full sm:w-fit" disabled={busy}>
            {dict.review.search}
          </button>
          <button
            type="button"
            className="btn-secondary min-h-11 w-full sm:w-fit"
            disabled={busy}
            onClick={() => void load(normalizeCatalogSearch(query))}
          >
            {dict.review.load}
          </button>
        </div>
        {searched && hits.length ? (
          <ul className="grid list-none gap-2 p-0" aria-label={dict.review.results}>
            {hits.map((hit) => (
              <li key={hit.id}>
                <button
                  type="button"
                  className="grid min-h-11 w-full gap-0.5 rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-left"
                  disabled={busy}
                  onClick={() => {
                    setQuery(hit.id);
                    void load(hit.id);
                  }}
                >
                  <span className="font-semibold text-white">{hit.name}</span>
                  <span className="text-sm text-slate-400">
                    {hit.position} · {formatListedClub(playerFromSearchHit(hit), dict)} · {hit.id}
                  </span>
                </button>
              </li>
            ))}
          </ul>
        ) : null}
      </form>

      {player ? (
        <section className="grid gap-4 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4">
          <div>
            <h2 className="text-xl font-bold text-white">{player.name}</h2>
            <p className="text-sm text-slate-400">
              {player.position} · {player.age} · {formatListedClub(player, dict)}
            </p>
            <p className="text-sm text-slate-500">{contractPrimary(player, dict, locale)}</p>
            <p className="mt-2 text-xs text-slate-500">{dict.review.catalogHint}</p>
          </div>

          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold">{dict.review.checkStatus}</legend>
            {(["no_club", "under_contract", "unknown"] as const).map((status) => (
              <label key={status} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="checkStatus"
                  checked={draft.checkStatus === status}
                  onChange={() =>
                    setDraft((current) => ({
                      ...current,
                      checkStatus: status,
                      clubMode: status === "no_club" ? "none" : current.clubMode === "none" ? "unknown" : current.clubMode,
                    }))
                  }
                />
                {dict.review[`status_${status}`]}
              </label>
            ))}
          </fieldset>

          {clubLocked ? (
            <p className="text-sm text-slate-400">{dict.review.noClubForcesNone}</p>
          ) : (
            <fieldset className="grid gap-2">
              <legend className="text-sm font-semibold">{dict.review.clubMode}</legend>
              {(["keep", "set", "unknown"] as const).map((mode) => (
                <label key={mode} className="flex items-center gap-2 text-sm">
                  <input
                    type="radio"
                    name="clubMode"
                    checked={draft.clubMode === mode}
                    onChange={() => setDraft((current) => ({ ...current, clubMode: mode }))}
                  />
                  {dict.review[`mode_${mode}`]}
                </label>
              ))}
              {draft.clubMode === "set" ? (
                <input
                  className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
                  value={draft.clubValue}
                  onChange={(event) => setDraft((current) => ({ ...current, clubValue: event.target.value }))}
                  placeholder={dict.review.clubValue}
                />
              ) : null}
            </fieldset>
          )}

          <fieldset className="grid gap-2">
            <legend className="text-sm font-semibold">{dict.review.contractMode}</legend>
            {(["keep", "set", "unknown"] as const).map((mode) => (
              <label key={mode} className="flex items-center gap-2 text-sm">
                <input
                  type="radio"
                  name="contractMode"
                  checked={draft.contractMode === mode}
                  onChange={() => setDraft((current) => ({ ...current, contractMode: mode }))}
                />
                {dict.review[`mode_${mode}`]}
              </label>
            ))}
            {draft.contractMode === "set" ? (
              <input
                type="date"
                className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
                value={draft.contractValue}
                onChange={(event) => setDraft((current) => ({ ...current, contractValue: event.target.value }))}
              />
            ) : null}
          </fieldset>

          <label className="grid gap-1 text-sm">
            {dict.review.sourceUrl}
            <input
              className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
              value={draft.sourceUrl}
              onChange={(event) => setDraft((current) => ({ ...current, sourceUrl: event.target.value }))}
              placeholder="https://"
            />
          </label>
          <label className="grid gap-1 text-sm">
            {dict.review.eventAt}
            <input
              type="date"
              className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
              value={draft.eventAt}
              onChange={(event) => setDraft((current) => ({ ...current, eventAt: event.target.value }))}
            />
          </label>
          <label className="grid gap-1 text-sm">
            {dict.review.publicNote}
            <textarea
              className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
              value={draft.publicNote}
              onChange={(event) => setDraft((current) => ({ ...current, publicNote: event.target.value }))}
              rows={3}
            />
          </label>
          <label className="grid gap-1 text-sm">
            {dict.review.privateNote}
            <textarea
              className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
              value={draft.privateNote}
              onChange={(event) => setDraft((current) => ({ ...current, privateNote: event.target.value }))}
              rows={2}
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void apply()}>
              {dict.review.save}
            </button>
            <button type="button" className="btn-secondary" disabled={busy || !review} onClick={() => void deactivate()}>
              {dict.review.deactivate}
            </button>
          </div>
        </section>
      ) : null}

      {history.length ? (
        <section className="grid gap-2">
          <h3 className="text-lg font-semibold text-white">{dict.review.history}</h3>
          <ul className="grid list-none gap-2 p-0">
            {history.map((row) => (
              <li key={row.id} className="rounded-xl border border-slate-800 px-3 py-2 text-sm text-slate-300">
                <p>
                  {row.kind} · {row.created_at.slice(0, 19)} · {row.check_status ?? "—"} ·{" "}
                  {row.active ? dict.review.active : dict.review.inactive}
                </p>
                {row.public_note ? <p className="text-slate-400">{row.public_note}</p> : null}
                {row.private_note ? <p className="text-slate-500">{row.private_note}</p> : null}
                <button
                  type="button"
                  className="btn-text mt-1"
                  disabled={busy || !review}
                  onClick={() => void rollback(row.id)}
                >
                  {dict.review.rollback}
                </button>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {message ? (
        <p className="agent-msg" role="status">
          {message}
        </p>
      ) : null}
    </div>
  );
}
