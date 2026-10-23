"use client";

import { useState } from "react";
import type { Player } from "@/data/mock-players";
import type { Dictionary } from "@/i18n/get-dictionary";
import { formatListedClub, contractPrimary } from "@/lib/contract-display";
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
  const [playerId, setPlayerId] = useState("");
  const [player, setPlayer] = useState<Player | null>(null);
  const [review, setReview] = useState<ReviewRow | null>(null);
  const [history, setHistory] = useState<HistoryRow[]>([]);
  const [draft, setDraft] = useState<ReviewDraft>(emptyDraft);
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  async function load() {
    setBusy(true);
    setMessage("");
    const res = await fetch(`/api/admin/player-reviews?playerId=${encodeURIComponent(playerId.trim())}`);
    const body = await res.json();
    setBusy(false);
    if (!res.ok) {
      setPlayer(null);
      setReview(null);
      setHistory([]);
      setMessage(body.error === "Forbidden" ? dict.review.forbidden : dict.review.loadFailed);
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
    void load();
    return body;
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
    void load();
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
    void load();
  }

  const clubLocked = draft.checkStatus === "no_club";

  return (
    <div className="grid gap-6">
      <form
        className="grid gap-3 rounded-2xl border border-slate-800/80 bg-slate-900/70 p-4"
        onSubmit={(event) => {
          event.preventDefault();
          void load();
        }}
      >
        <label className="grid gap-1 text-sm">
          {dict.review.playerId}
          <input
            className="rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-2 text-slate-100"
            value={playerId}
            onChange={(event) => setPlayerId(event.target.value)}
            required
          />
        </label>
        <button type="submit" className="btn-primary w-fit" disabled={busy}>
          {dict.review.load}
        </button>
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
