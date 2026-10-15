"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AddToSavedList } from "@/components/add-to-saved-list";
import { HighlightsLink } from "@/components/highlights-link";
import { PlayerDrawer } from "@/components/player-drawer";
import { QuickShare } from "@/components/quick-share";
import { positions, type CatalogStatus, type Player, type Position } from "@/data/mock-players";
import type { Dictionary } from "@/i18n/get-dictionary";
import { contractNote, contractPrimary, formatListedClub } from "@/lib/contract-display";
import { formatMarketValue } from "@/lib/format";
import { positionLine } from "@/lib/player-ui";
import { briefFromWhatsApp, parseBrief, scorePlayer, type ClubBrief, type MatchResult } from "@/lib/match-brief";
import { formatMatchFact } from "@/lib/match-display";
import {
  PASTE_STORAGE_KEY,
  catalogFiltersFromPaste,
  parseWhatsAppPaste,
  pasteHasRecognizedNeeds,
  suggestedCatalogStatus,
  type PasteParse,
} from "@/lib/paste-parser";
import { playerWhatsAppShare } from "@/lib/highlights";
import { uniquePlayerIds } from "@/lib/player-ids";
import { PAGE_SIZE, parsePageParam } from "@/lib/player-page";
import { playerSearchPath, searchPathWithoutPlayer } from "@/lib/player-link";
import { formatSeasonCount } from "@/lib/season-stats";
import type { SavedList } from "@/lib/supabase/types";

type Props = {
  dict: Dictionary;
  locale: string;
  initialAvailability?: CatalogStatus;
};

const valueCaps = [500_000, 1_000_000, 2_000_000, 5_000_000] as const;
const AGE_OPTIONS = Array.from({ length: 30 }, (_, index) => index + 16);

function parseAgeState(raw: string | null): number | null {
  if (!raw || raw === "any") return null;
  const value = Number(raw);
  if (!Number.isFinite(value) || value < 15 || value > 55) return null;
  return value;
}

function statusFromSearch(raw: string | null, fallback: CatalogStatus): CatalogStatus {
  if (raw === "free" || raw === "expiring" || raw === "all") return raw;
  return fallback;
}

export function SearchDesk({ dict, locale, initialAvailability = "free" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromUrl = statusFromSearch(searchParams.get("status"), initialAvailability);
  const urlPosition = searchParams.get("position");
  const urlPositionCodes = (urlPosition ?? "")
    .split(",")
    .map((code) => code.trim())
    .filter((code): code is Position => (positions as readonly string[]).includes(code));
  const startPosition: Position | "all" =
    urlPositionCodes.length === 1 ? urlPositionCodes[0] : "all";
  const startAgeMin = parseAgeState(searchParams.get("minAge"));
  const startAgeMax = parseAgeState(searchParams.get("maxAge"));
  const urlMv = searchParams.get("maxMv");
  const startMv: number | "any" =
    urlMv && urlMv !== "any" && Number.isFinite(Number(urlMv)) ? Number(urlMv) : "any";
  const [availability, setAvailability] = useState<CatalogStatus>(fromUrl);
  const [position, setPosition] = useState<Position | "all">(startPosition);
  const [euOnly, setEuOnly] = useState(searchParams.get("eu") === "1");
  const [valueCap, setValueCap] = useState<number | "any">(startMv);
  const [ageMin, setAgeMin] = useState<number | null>(startAgeMin);
  const [ageMax, setAgeMax] = useState<number | null>(startAgeMax);
  const [nationality, setNationality] = useState(searchParams.get("nationality") || "all");
  const [briefDraft, setBriefDraft] = useState("");
  const [brief, setBrief] = useState<ClubBrief | null>(null);
  const [pasteDraft, setPasteDraft] = useState("");
  const [pasteResult, setPasteResult] = useState<PasteParse | null>(null);
  const [spotlight, setSpotlight] = useState<Player | null>(null);
  const [playerError, setPlayerError] = useState<string | null>(null);
  const [players, setPlayers] = useState<Player[]>([]);
  const [nationalities, setNationalities] = useState<string[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "auth" | "error">(
    "idle",
  );
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [savedLists, setSavedLists] = useState<SavedList[]>([]);
  const [targetListId, setTargetListId] = useState("");
  const [listsSignedOut, setListsSignedOut] = useState(false);

  function rememberList(next: SavedList) {
    setSavedLists((current) => {
      const index = current.findIndex((list) => list.id === next.id);
      if (index === -1) return [next, ...current];
      const copy = [...current];
      copy[index] = next;
      return copy;
    });
    setListsSignedOut(false);
    setTargetListId((current) => current || next.id);
  }

  useEffect(() => {
    let cancelled = false;
    fetch("/api/saved-lists")
      .then(async (res) => {
        if (cancelled) return;
        if (res.status === 401) {
          setListsSignedOut(true);
          setSavedLists([]);
          return;
        }
        if (!res.ok) return;
        const body = (await res.json()) as { lists?: SavedList[] };
        setListsSignedOut(false);
        const nextLists = body.lists ?? [];
        setSavedLists(nextLists);
        setTargetListId((current) =>
          current && nextLists.some((list) => list.id === current) ? current : (nextLists[0]?.id ?? ""),
        );
      })
      .catch(() => {
        if (!cancelled) setSavedLists([]);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    setAvailability(fromUrl);
  }, [fromUrl]);

  useEffect(() => {
    const nextPosition = searchParams.get("position");
    if (nextPosition === "all") setPosition("all");
    else if (nextPosition) {
      const codes = nextPosition
        .split(",")
        .map((code) => code.trim())
        .filter((code): code is Position => (positions as readonly string[]).includes(code));
      if (codes.length === 1) setPosition(codes[0]);
      else if (codes.length > 1) setPosition("all");
    }
    const eu = searchParams.get("eu");
    if (eu === "1") setEuOnly(true);
    else if (eu === "0") setEuOnly(false);
    const nextNationality = searchParams.get("nationality");
    if (nextNationality) setNationality(nextNationality);
    const nextMinAge = parseAgeState(searchParams.get("minAge"));
    if (searchParams.has("minAge")) setAgeMin(nextMinAge);
    const nextMaxAge = parseAgeState(searchParams.get("maxAge"));
    if (searchParams.has("maxAge")) setAgeMax(nextMaxAge);
    const nextMv = searchParams.get("maxMv");
    if (nextMv === "any") setValueCap("any");
    else if (nextMv && Number.isFinite(Number(nextMv))) setValueCap(Number(nextMv));
  }, [searchParams]);

  const matchCap = brief?.maxMv;
  const effectiveMaxMv = (() => {
    const fromUi = valueCap === "any" ? Infinity : valueCap;
    const fromBrief = matchCap ?? Infinity;
    const cap = Math.min(fromUi, fromBrief);
    return Number.isFinite(cap) ? String(cap) : "any";
  })();

  const positionFilter =
    pasteResult && pasteResult.positions.length > 0
      ? pasteResult.positions.join(",")
      : brief && brief.positions.length > 0
        ? brief.positions.join(",")
        : urlPositionCodes.length > 1
          ? urlPositionCodes.join(",")
          : position;

  const filterKey = [
    availability,
    positionFilter,
    nationality,
    String(ageMin ?? ""),
    String(ageMax ?? ""),
    euOnly || brief?.euPassport ? "1" : "0",
    effectiveMaxMv,
    brief?.raw ?? "",
  ].join("|");
  const urlPage = parsePageParam(searchParams.get("page"));
  const committedFilters = useRef(filterKey);
  const page = committedFilters.current !== filterKey ? 1 : urlPage;

  useEffect(() => {
    const filtersChanged = committedFilters.current !== filterKey;
    if (filtersChanged) {
      committedFilters.current = filterKey;
      if (searchParams.has("page") && parsePageParam(searchParams.get("page")) !== 1) {
        setLoading(true);
        setSaveState("idle");
        const nextParams = new URLSearchParams(searchParams.toString());
        nextParams.set("status", availability);
        nextParams.set("position", String(positionFilter));
        if (nationality && nationality !== "all") nextParams.set("nationality", nationality);
        else nextParams.delete("nationality");
        nextParams.set("eu", euOnly || brief?.euPassport ? "1" : "0");
        if (effectiveMaxMv !== "any") nextParams.set("maxMv", effectiveMaxMv);
        else nextParams.delete("maxMv");
        const nextMinAge = brief?.minAge ?? ageMin;
        const nextMaxAge = brief?.maxAge ?? ageMax;
        if (nextMinAge != null) nextParams.set("minAge", String(nextMinAge));
        else nextParams.delete("minAge");
        if (nextMaxAge != null) nextParams.set("maxAge", String(nextMaxAge));
        else nextParams.delete("maxAge");
        nextParams.delete("page");
        const query = nextParams.toString();
        router.replace(query ? `/${locale}/search?${query}` : `/${locale}/search`, { scroll: false });
        return;
      }
    }

    const params = new URLSearchParams({
      status: availability,
      position: positionFilter,
      nationality,
      eu: euOnly || brief?.euPassport ? "1" : "0",
      maxMv: effectiveMaxMv,
    });
    const nextMinAge = brief?.minAge ?? ageMin;
    const nextMaxAge = brief?.maxAge ?? ageMax;
    if (nextMinAge != null) params.set("minAge", String(nextMinAge));
    if (nextMaxAge != null) params.set("maxAge", String(nextMaxAge));
    params.set("page", String(filtersChanged ? 1 : urlPage));
    let cancelled = false;
    setLoading(true);
    setSaveState("idle");
    fetch(`/api/players?${params}`)
      .then((response) => response.json())
      .then((data) => {
        if (cancelled) return;
        setPlayers(data.players ?? []);
        setNationalities(data.nationalities ?? []);
        setTotal(data.total ?? 0);
      })
      .catch(() => {
        if (!cancelled) {
          setPlayers([]);
          setTotal(0);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [
    availability,
    positionFilter,
    nationality,
    ageMin,
    ageMax,
    euOnly,
    effectiveMaxMv,
    brief,
    filterKey,
    urlPage,
    locale,
    router,
    searchParams,
  ]);

  const rows = useMemo(
    () =>
      players.map((player) => ({
        player,
        match: brief ? scorePlayer(player, brief) : null,
      })),
    [players, brief],
  );

  const saveIds = useMemo(
    () => uniquePlayerIds(rows.map(({ player }) => player.id)),
    [rows],
  );

  const playerParam = searchParams.get("player")?.trim() || null;
  const listed = playerParam
    ? players.find((player) => player.id === playerParam) ?? null
    : null;
  const selected =
    listed ?? (spotlight && spotlight.id === playerParam ? spotlight : null);
  const selectedMatch = selected && brief ? scorePlayer(selected, brief) : null;
  const queryString = searchParams.toString();
  const rangeFrom = total === 0 || rows.length === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const rangeTo = total === 0 || rows.length === 0 ? 0 : rangeFrom + rows.length - 1;
  const hasPrev = page > 1;
  const hasNext = page * PAGE_SIZE < total;
  const emptyMessage =
    total === 0 ? dict.table.empty : rows.length === 0 ? dict.table.emptyPage : dict.table.empty;

  function goToPage(nextPage: number) {
    const safe = Math.max(1, nextPage);
    const params = new URLSearchParams(searchParams.toString());
    if (safe <= 1) params.delete("page");
    else params.set("page", String(safe));
    const query = params.toString();
    const path = query ? `/${locale}/search?${query}` : `/${locale}/search`;
    if (query === searchParams.toString()) return;
    router.replace(path, { scroll: false });
  }

  function openPlayer(id: string) {
    router.replace(playerSearchPath(locale, id, queryString), { scroll: false });
  }

  function closePlayer() {
    router.replace(searchPathWithoutPlayer(locale, queryString), { scroll: false });
    setSpotlight(null);
    setPlayerError(null);
  }

  useEffect(() => {
    if (!playerParam || listed) return;

    let cancelled = false;
    fetch(`/api/players/${encodeURIComponent(playerParam)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("missing");
        return response.json() as Promise<{ player: Player }>;
      })
      .then((data) => {
        if (cancelled) return;
        setSpotlight(data.player);
        setPlayerError(null);
      })
      .catch(() => {
        if (cancelled) return;
        setSpotlight(null);
        setPlayerError(dict.profile.notFound);
      });

    return () => {
      cancelled = true;
    };
  }, [playerParam, listed, dict.profile.notFound]);

  useEffect(() => {
    if (!playerParam) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      router.replace(searchPathWithoutPlayer(locale, queryString), { scroll: false });
      setSpotlight(null);
      setPlayerError(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [playerParam, locale, queryString, router]);

  function runMatch() {
    setBrief(parseBrief(briefDraft));
  }

  function clearMatch() {
    setBrief(null);
  }

  function applyWhatsAppText(text: string) {
    const parsed = parseWhatsAppPaste(text);
    setPasteDraft(text);
    setPasteResult(parsed);
    if (!pasteHasRecognizedNeeds(parsed)) return;
    const filters = catalogFiltersFromPaste(parsed);
    if (filters.positions !== "all" && filters.positions.length === 1) setPosition(filters.positions[0]);
    else if (filters.positions !== "all") setPosition("all");
    const nextStatus = suggestedCatalogStatus(parsed);
    if (nextStatus) setAvailability(nextStatus);
    setEuOnly(filters.euOnly);
    setAgeMin(filters.minAge ?? null);
    setAgeMax(filters.maxAge ?? null);
    setValueCap(filters.maxMv);
    const nextBrief = briefFromWhatsApp(text);
    setBrief(nextBrief);
  }

  function applyWhatsAppPaste() {
    applyWhatsAppText(pasteDraft);
  }

  useEffect(() => {
    const stored = sessionStorage.getItem(PASTE_STORAGE_KEY);
    if (!stored) return;
    applyWhatsAppText(stored);
    // Run once when arriving from the home paste box.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const go = () => {
      const hash = window.location.hash.replace("#", "");
      if (hash !== "paste" && hash !== "match") return;
      document.getElementById(hash)?.scrollIntoView({ behavior: "smooth", block: "start" });
    };
    go();
    window.addEventListener("hashchange", go);
    return () => window.removeEventListener("hashchange", go);
  }, []);

  return (
    <section className="desk">
      <div
        className="match-panel box-border w-full min-w-0 max-w-full rounded-2xl border border-slate-800/80 bg-slate-900/70 shadow-xl backdrop-blur-md"
        id="match"
      >
        <div className="match-copy min-w-0">
          <h2 className="break-words">{dict.match.title}</h2>
          <p className="break-words">{dict.match.hint}</p>
        </div>
        <textarea
          className="box-border min-w-0 w-full max-w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none sm:px-4"
          value={briefDraft}
          onChange={(event) => setBriefDraft(event.target.value)}
          placeholder={dict.match.placeholder}
          rows={4}
        />
        <div className="match-actions">
          <button type="button" className="btn-primary" onClick={runMatch}>
            {dict.match.apply}
          </button>
          <button type="button" className="btn-ghost" onClick={clearMatch}>
            {dict.match.clear}
          </button>
        </div>
        {brief?.club ? <p className="match-for">{dict.match.for.replace("{club}", brief.club)}</p> : null}
        {brief?.market && brief.maxMv ? (
          <p className="match-cap">{dict.match.cap.replace("{market}", brief.market)}</p>
        ) : brief?.market && brief.suggestedTypicalMv ? (
          <p className="match-cap">
            {dict.match.levelHint
              .replace("{market}", brief.market)
              .replace("{value}", formatMarketValue(brief.suggestedTypicalMv, locale))}
          </p>
        ) : brief?.market ? (
          <p className="match-cap">{dict.match.cap.replace("{market}", brief.market)}</p>
        ) : null}
      </div>

      <div
        className="paste-panel box-border w-full min-w-0 max-w-full rounded-2xl border border-slate-800/80 bg-slate-900/70 shadow-xl backdrop-blur-md"
        id="paste"
      >
        <div className="match-copy min-w-0">
          <h2 className="break-words">{dict.paste.title}</h2>
          <p className="break-words">{dict.paste.hint}</p>
        </div>
        <textarea
          className="box-border min-w-0 w-full max-w-full rounded-xl border border-slate-800 bg-slate-950/80 px-3 py-3 text-sm leading-6 text-slate-100 placeholder:text-slate-500 focus:border-emerald-500 focus:outline-none sm:px-4"
          value={pasteDraft}
          onChange={(event) => setPasteDraft(event.target.value)}
          placeholder={dict.paste.placeholder}
          rows={5}
        />
        <div className="match-actions">
          <button type="button" className="btn-primary" onClick={applyWhatsAppPaste}>
            {dict.paste.apply}
          </button>
        </div>
        {pasteResult ? <PasteResultChips dict={dict} parsed={pasteResult} /> : null}
      </div>

      <div className="status-toggle" role="tablist" aria-label="Availability">
        <button
          type="button"
          role="tab"
          aria-selected={availability === "all"}
          className={availability === "all" ? "is-active" : undefined}
          onClick={() => setAvailability("all")}
        >
          {dict.status.all}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={availability === "free"}
          className={availability === "free" ? "is-active" : undefined}
          onClick={() => setAvailability("free")}
        >
          {dict.status.free}
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={availability === "expiring"}
          className={availability === "expiring" ? "is-active" : undefined}
          onClick={() => setAvailability("expiring")}
        >
          {dict.status.expiring}
        </button>
      </div>
      <p className="mb-3 max-w-3xl break-words text-sm text-slate-400">
        {availability === "all"
          ? dict.status.allNote
          : availability === "free"
            ? dict.status.freeNote
            : dict.status.expiringNote}
      </p>

      <button
        type="button"
        className="min-h-12 w-full rounded-xl border border-slate-800 bg-slate-900/70 px-4 text-sm font-semibold text-slate-100 md:!hidden"
        onClick={() => setFiltersOpen(true)}
      >
        {dict.filters.open}
      </button>

      <div className="filters !hidden md:!grid">
        <FilterFields
          dict={dict}
          locale={locale}
          position={position}
          setPosition={setPosition}
          nationality={nationality}
          setNationality={setNationality}
          nationalities={nationalities}
          ageMin={ageMin}
          setAgeMin={setAgeMin}
          ageMax={ageMax}
          setAgeMax={setAgeMax}
          valueCap={valueCap}
          setValueCap={setValueCap}
          euOnly={euOnly}
          setEuOnly={setEuOnly}
        />
      </div>

      {filtersOpen ? (
        <div className="fixed inset-0 z-[60] md:!hidden">
          <button
            type="button"
            className="absolute inset-0 bg-slate-950/70"
            aria-label={dict.profile.close}
            onClick={() => setFiltersOpen(false)}
          />
          <div className="absolute inset-x-0 bottom-0 max-h-[85dvh] overflow-auto rounded-t-2xl border border-slate-800 bg-slate-950 p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <p className="text-sm font-semibold text-white">{dict.filters.open}</p>
              <button
                type="button"
                className="min-h-11 rounded-lg border border-emerald-500/50 px-4 text-sm font-semibold text-emerald-400"
                onClick={() => setFiltersOpen(false)}
              >
                {dict.filters.done}
              </button>
            </div>
            <div className="filters grid grid-cols-1 gap-4">
              <FilterFields
                dict={dict}
                locale={locale}
                position={position}
                setPosition={setPosition}
                nationality={nationality}
                setNationality={setNationality}
                nationalities={nationalities}
                ageMin={ageMin}
                setAgeMin={setAgeMin}
                ageMax={ageMax}
                setAgeMax={setAgeMax}
                valueCap={valueCap}
                setValueCap={setValueCap}
                euOnly={euOnly}
                setEuOnly={setEuOnly}
              />
            </div>
          </div>
        </div>
      ) : null}

      <div className="results-meta">
        <p>
          {loading
            ? "…"
            : total === 0
              ? dict.table.empty
              : rows.length === 0
                ? dict.table.emptyPage
                : dict.table.showingRange
                    .replace("{from}", String(rangeFrom))
                    .replace("{to}", String(rangeTo))
                    .replace("{total}", String(total))}
        </p>
        {loading || total === 0 ? null : (
          <div className="mb-3 flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="btn-ghost min-h-11"
              disabled={!hasPrev || loading}
              onClick={() => goToPage(page - 1)}
            >
              {dict.table.previous}
            </button>
            <span className="text-sm text-slate-400">
              {dict.table.pageLabel.replace("{page}", String(page))}
            </span>
            <button
              type="button"
              className="btn-ghost min-h-11"
              disabled={!hasNext || loading}
              onClick={() => goToPage(page + 1)}
            >
              {dict.table.next}
            </button>
          </div>
        )}
        {loading || saveIds.length === 0 ? null : (
          <p className="mb-2 max-w-xl text-sm text-slate-400" role="status">
            {total > saveIds.length
              ? dict.account.snapshotPage
                  .replace("{saved}", String(saveIds.length))
                  .replace("{total}", String(total))
              : dict.account.snapshotAll.replace("{saved}", String(saveIds.length))}
          </p>
        )}
        {savedLists.length > 0 ? (
          <label className="mb-2 grid max-w-xl gap-1 text-xs text-slate-400">
            <span>{dict.account.selectList}</span>
            <select
              className="min-h-11 rounded-lg border border-slate-800 bg-slate-950 px-3 text-sm text-white"
              value={targetListId}
              onChange={(event) => setTargetListId(event.target.value)}
            >
              {savedLists.map((list) => (
                <option key={list.id} value={list.id}>
                  {list.title}
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <button
          type="button"
          className="save-list"
          disabled={loading || rows.length === 0 || saveState === "saving"}
          onClick={async () => {
            setSaveState("saving");
            const playerIds = saveIds;
            const title =
              brief?.club ||
              (pasteResult?.positions.length
                ? `${availability} ${pasteResult.positions.join("/")}`
                : `${availability} ${position}`);
            const res = await fetch("/api/saved-lists", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                title,
                clubName: brief?.club ?? null,
                queryText: pasteDraft || briefDraft || null,
                filters: {
                  status: availability,
                  position,
                  nationality,
                  euOnly,
                  minAge: ageMin ?? undefined,
                  maxAge: ageMax ?? undefined,
                  maxMv: valueCap,
                },
                playerIds,
              }),
            });
            if (res.ok) {
              const body = (await res.json()) as { list?: SavedList };
              if (body.list) rememberList(body.list);
              setSaveState("saved");
            } else if (res.status === 401) setSaveState("auth");
            else setSaveState("error");
          }}
        >
          {saveState === "saving"
            ? dict.account.saving
            : saveState === "saved"
              ? dict.account.saved
              : dict.account.saveList}
        </button>
        <p
          className={
            saveState === "auth" || saveState === "error"
              ? "agent-msg"
              : "mt-2 max-w-xl text-sm text-slate-500"
          }
          role={saveState === "auth" || saveState === "error" ? "alert" : undefined}
        >
          {saveState === "auth"
            ? dict.account.needAccount
            : saveState === "error"
              ? dict.account.saveFailed
              : dict.table.sampleNote}
        </p>
      </div>

      {playerParam && playerError ? (
        <p className="note" role="status">
          {playerError}
        </p>
      ) : null}

      <ul className="grid gap-2 md:!hidden">
        {rows.length === 0 ? (
          <li className="empty rounded-2xl border border-slate-800 px-4 py-8">{emptyMessage}</li>
        ) : (
          rows.map(({ player, match }) => (
            <PlayerCard
              key={player.id}
              player={player}
              match={match}
              dict={dict}
              locale={locale}
              showFit={Boolean(brief)}
              sharePath={playerSearchPath(locale, player.id, queryString)}
              onOpen={() => openPlayer(player.id)}
              lists={savedLists}
              listId={targetListId}
              onListIdChange={setTargetListId}
              signedOut={listsSignedOut}
              onListUpdated={rememberList}
            />
          ))
        )}
      </ul>
      <div className="table-wrap !hidden md:!block">
        <table>
          <thead>
            <tr>
              {brief ? <th>{dict.table.fit}</th> : null}
              <th>{dict.table.player}</th>
              <th>{dict.table.age}</th>
              <th>{dict.table.position}</th>
              <th>{dict.table.club}</th>
              <th>{dict.table.league}</th>
              <th>{dict.table.country}</th>
              <th>{dict.table.contract}</th>
              <th className="num">{dict.table.apps}</th>
              <th className="num">{dict.table.marketValue}</th>
              <th>{dict.table.nationality}</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={brief ? 11 : 10} className="empty">
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map(({ player, match }) => (
                <PlayerRow
                  key={player.id}
                  player={player}
                  match={match}
                  dict={dict}
                  locale={locale}
                  showFit={Boolean(brief)}
                  onOpen={() => openPlayer(player.id)}
                  lists={savedLists}
                  listId={targetListId}
                  onListIdChange={setTargetListId}
                  signedOut={listsSignedOut}
                  onListUpdated={rememberList}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      {selected ? (
        <PlayerDrawer
          player={selected}
          dict={dict}
          locale={locale}
          match={selectedMatch}
          sharePath={playerSearchPath(locale, selected.id, queryString)}
          lists={savedLists}
          listId={targetListId}
          onListIdChange={setTargetListId}
          signedOut={listsSignedOut}
          onClose={closePlayer}
          onListUpdated={rememberList}
        />
      ) : null}
    </section>
  );
}

function PasteResultChips({ dict, parsed }: { dict: Dictionary; parsed: PasteParse }) {
  const applied: string[] = [];
  if (parsed.club) applied.push(dict.paste.club.replace("{club}", parsed.club));
  for (const code of parsed.positions) {
    applied.push(`${dict.paste.position}: ${dict.positions[code]}`);
  }
  if (parsed.euPassport) applied.push(dict.paste.eu);
  if (parsed.minAge && parsed.maxAge) {
    applied.push(
      dict.paste.ageRange.replace("{min}", String(parsed.minAge)).replace("{max}", String(parsed.maxAge)),
    );
  } else if (parsed.minAge) {
    applied.push(dict.paste.ageMin.replace("{age}", String(parsed.minAge)));
  } else if (parsed.maxAge) {
    applied.push(dict.paste.age.replace("{age}", String(parsed.maxAge)));
  }
  if (parsed.maxMv) {
    applied.push(dict.paste.marketValue.replace("{value}", formatMarketValue(parsed.maxMv, "en")));
  }
  const status = suggestedCatalogStatus(parsed);
  if (status === "all") applied.push(dict.status.all);
  if (status === "expiring") applied.push(dict.paste.expiring);

  const unverified = parsed.unverifiable.map((need) => {
    if (need === "salary") return dict.paste.salary;
    if (need === "transfer") return dict.paste.transfer;
    if (need === "loan") return dict.paste.loan;
    return dict.paste.freeUnconfirmed;
  });

  if (!applied.length && !unverified.length) {
    return (
      <ul className="paste-chips">
        <li>{dict.paste.empty}</li>
      </ul>
    );
  }

  return (
    <div className="grid gap-3">
      {applied.length ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{dict.paste.applied}</p>
          <ul className="paste-chips">
            {applied.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
      {unverified.length ? (
        <div>
          <p className="mb-1 text-xs font-semibold uppercase tracking-wider text-slate-400">{dict.paste.unverified}</p>
          <ul className="paste-chips">
            {unverified.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

function PlayerRow({
  player,
  match,
  dict,
  locale,
  showFit,
  onOpen,
  lists,
  listId,
  onListIdChange,
  signedOut,
  onListUpdated,
}: {
  player: Player;
  match: MatchResult | null;
  dict: Dictionary;
  locale: string;
  showFit: boolean;
  onOpen: () => void;
  lists: SavedList[];
  listId: string;
  onListIdChange: (id: string) => void;
  signedOut: boolean;
  onListUpdated: (list: SavedList) => void;
}) {
  return (
    <tr>
      {showFit && match ? (
        <td>
          <span className={`fit-badge fit-${match.fit}`}>{dict.match[match.fit]}</span>
          <ul className="mt-2 grid gap-1 text-xs text-slate-400">
            {match.facts.map((fact) => (
              <li key={fact.key}>
                {dict.match[
                  fact.status === "met"
                    ? "conditionMet"
                    : fact.status === "unmet"
                      ? "conditionUnmet"
                      : "conditionUnknown"
                ]}
                {": "}
                {formatMatchFact(fact, dict, locale)}
              </li>
            ))}
          </ul>
        </td>
      ) : showFit ? (
        <td>—</td>
      ) : null}
      <td className="player-col">
        <span className="player-cell">
          <button type="button" className="player-name" onClick={onOpen}>
            {player.name}
          </button>
          <span className={`pos-badge pos-${positionLine(player.position)}`}>{player.position}</span>
          <HighlightsLink playerName={player.name} dict={dict} compact />
        </span>
        <div className="mt-2">
          <AddToSavedList
            playerId={player.id}
            lists={lists}
            listId={listId}
            onListIdChange={onListIdChange}
            signedOut={signedOut}
            dict={dict}
            onListUpdated={onListUpdated}
            compact
          />
        </div>
      </td>
      <td>{player.age}</td>
      <td>
        <span className={`pos-badge pos-${positionLine(player.position)}`}>{player.position}</span>
      </td>
      <td>{formatListedClub(player, dict)}</td>
      <td>{player.league}</td>
      <td>{player.country}</td>
      <td>
        <span className="contract-cell">
          <span className="pill">{contractPrimary(player, dict, locale)}</span>
          {contractNote(player, dict) ? <span className="pill">{contractNote(player, dict)}</span> : null}
        </span>
      </td>
      <td className="num">{formatSeasonCount(player, player.appearances)}</td>
      <td className="num">{formatMarketValue(player.marketValueEur, locale)}</td>
      <td>
        {player.nationality}
        {player.euPassport ? <span className="eu">EU</span> : null}
      </td>
    </tr>
  );
}

function FilterFields({
  dict,
  locale,
  position,
  setPosition,
  nationality,
  setNationality,
  nationalities,
  ageMin,
  setAgeMin,
  ageMax,
  setAgeMax,
  valueCap,
  setValueCap,
  euOnly,
  setEuOnly,
}: {
  dict: Dictionary;
  locale: string;
  position: Position | "all";
  setPosition: (value: Position | "all") => void;
  nationality: string;
  setNationality: (value: string) => void;
  nationalities: string[];
  ageMin: number | null;
  setAgeMin: (value: number | null) => void;
  ageMax: number | null;
  setAgeMax: (value: number | null) => void;
  valueCap: number | "any";
  setValueCap: (value: number | "any") => void;
  euOnly: boolean;
  setEuOnly: (value: boolean) => void;
}) {
  return (
    <>
      <label>
        <span>{dict.filters.position}</span>
        <select
          value={position}
          onChange={(event) => setPosition(event.target.value as Position | "all")}
        >
          <option value="all">{dict.filters.allPositions}</option>
          {positions.map((code) => (
            <option key={code} value={code}>
              {dict.positions[code]}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{dict.filters.nationality}</span>
        <select value={nationality} onChange={(event) => setNationality(event.target.value)}>
          <option value="all">{dict.filters.allNationalities}</option>
          {nationalities.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>
          {dict.filters.age} · {dict.filters.minAge}
        </span>
        <select
          value={ageMin ?? "any"}
          onChange={(event) => {
            const next = event.target.value;
            setAgeMin(next === "any" ? null : Number(next));
          }}
        >
          <option value="any">{dict.filters.anyAge}</option>
          {AGE_OPTIONS.map((age) => (
            <option key={`min-${age}`} value={age}>
              {age}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>
          {dict.filters.age} · {dict.filters.maxAge}
        </span>
        <select
          value={ageMax ?? "any"}
          onChange={(event) => {
            const next = event.target.value;
            setAgeMax(next === "any" ? null : Number(next));
          }}
        >
          <option value="any">{dict.filters.anyAge}</option>
          {AGE_OPTIONS.map((age) => (
            <option key={`max-${age}`} value={age}>
              {age}
            </option>
          ))}
        </select>
      </label>
      <label>
        <span>{dict.filters.marketValue}</span>
        <select
          value={valueCap}
          onChange={(event) => {
            const next = event.target.value;
            setValueCap(next === "any" ? "any" : Number(next));
          }}
        >
          <option value="any">{dict.filters.anyValue}</option>
          {typeof valueCap === "number" && !(valueCaps as readonly number[]).includes(valueCap) ? (
            <option value={valueCap}>{formatMarketValue(valueCap, locale)}</option>
          ) : null}
          {valueCaps.map((cap) => (
            <option key={cap} value={cap}>
              {formatMarketValue(cap, locale)}
            </option>
          ))}
        </select>
      </label>
      <label className="check">
        <input
          type="checkbox"
          checked={euOnly}
          onChange={(event) => setEuOnly(event.target.checked)}
        />
        <span>{dict.filters.euPassport}</span>
      </label>
    </>
  );
}

function PlayerCard({
  player,
  match,
  dict,
  locale,
  showFit,
  sharePath,
  onOpen,
  lists,
  listId,
  onListIdChange,
  signedOut,
  onListUpdated,
}: {
  player: Player;
  match: MatchResult | null;
  dict: Dictionary;
  locale: string;
  showFit: boolean;
  sharePath: string;
  onOpen: () => void;
  lists: SavedList[];
  listId: string;
  onListIdChange: (id: string) => void;
  signedOut: boolean;
  onListUpdated: (list: SavedList) => void;
}) {
  return (
    <li className="overflow-visible rounded-2xl border border-slate-800/80 bg-slate-900/70 shadow-lg">
      <button
        type="button"
        className="flex min-h-16 w-full flex-col gap-1 px-4 py-3 text-left"
        onClick={onOpen}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 break-words font-bold text-white">{player.name}</span>
          <span className={`pos-badge pos-${positionLine(player.position)}`}>{player.position}</span>
        </span>
        <span className="break-words text-sm text-slate-400">
          {formatListedClub(player, dict)} · {player.age} · {formatMarketValue(player.marketValueEur, locale)}
        </span>
        {showFit && match ? (
          <>
            <span className={`fit-badge fit-${match.fit} w-fit`}>{dict.match[match.fit]}</span>
            <span className="grid gap-1 text-xs text-slate-400">
              {match.facts.map((fact) => (
                <span key={fact.key}>{formatMatchFact(fact, dict, locale)}</span>
              ))}
            </span>
          </>
        ) : null}
      </button>
      <div className="px-4 pb-3">
        <QuickShare
          dict={dict}
          path={sharePath}
          text={playerWhatsAppShare(player, dict, locale)}
        />
        <AddToSavedList
          playerId={player.id}
          lists={lists}
          listId={listId}
          onListIdChange={onListIdChange}
          signedOut={signedOut}
          dict={dict}
          onListUpdated={onListUpdated}
          showPicker
        />
      </div>
    </li>
  );
}
