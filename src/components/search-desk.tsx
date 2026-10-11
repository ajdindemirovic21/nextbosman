"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { HighlightsLink } from "@/components/highlights-link";
import { PlayerDrawer } from "@/components/player-drawer";
import { QuickShare } from "@/components/quick-share";
import { positions, type Availability, type Player, type Position } from "@/data/mock-players";
import type { Dictionary } from "@/i18n/get-dictionary";
import { contractNote, contractPrimary, formatListedClub } from "@/lib/contract-display";
import { formatMarketValue } from "@/lib/format";
import { positionLine } from "@/lib/player-ui";
import { briefFromWhatsApp, isUnrealistic, parseBrief, scorePlayer, type ClubBrief, type MatchResult } from "@/lib/match-brief";
import { PASTE_STORAGE_KEY, parseWhatsAppPaste, type PasteParse } from "@/lib/paste-parser";
import { playerWhatsAppShare } from "@/lib/highlights";
import { uniquePlayerIds } from "@/lib/player-ids";
import { playerSearchPath, searchPathWithoutPlayer } from "@/lib/player-link";
import { formatSeasonCount } from "@/lib/season-stats";

type Props = {
  dict: Dictionary;
  locale: string;
  initialAvailability?: Availability;
};

const valueCaps = [500_000, 1_000_000, 2_000_000, 5_000_000] as const;

export function SearchDesk({ dict, locale, initialAvailability = "free" }: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const fromUrl = searchParams.get("status") === "expiring" ? "expiring" : initialAvailability;
  const urlPosition = searchParams.get("position");
  const startPosition: Position | "all" =
    urlPosition && (positions as readonly string[]).includes(urlPosition)
      ? (urlPosition as Position)
      : "all";
  const urlAge = Number(searchParams.get("maxAge"));
  const startAge =
    Number.isFinite(urlAge) && urlAge >= 18 && urlAge <= 40 ? urlAge : 36;
  const urlMv = searchParams.get("maxMv");
  const startMv: number | "any" =
    urlMv && urlMv !== "any" && Number.isFinite(Number(urlMv)) ? Number(urlMv) : "any";
  const [availability, setAvailability] = useState<Availability>(fromUrl);
  const [position, setPosition] = useState<Position | "all">(startPosition);
  const [euOnly, setEuOnly] = useState(searchParams.get("eu") === "1");
  const [valueCap, setValueCap] = useState<number | "any">(startMv);
  const [ageMax, setAgeMax] = useState<number>(startAge);
  const [nationality, setNationality] = useState(searchParams.get("nationality") || "all");
  const [briefDraft, setBriefDraft] = useState("");
  const [brief, setBrief] = useState<ClubBrief | null>(null);
  const [pasteDraft, setPasteDraft] = useState("");
  const [pasteResult, setPasteResult] = useState<PasteParse | null>(null);
  const [hideWeak, setHideWeak] = useState(true);
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
  const [visibleCount, setVisibleCount] = useState(25);

  useEffect(() => {
    setAvailability(fromUrl);
  }, [fromUrl]);

  useEffect(() => {
    const nextPosition = searchParams.get("position");
    if (nextPosition === "all") setPosition("all");
    else if (nextPosition && (positions as readonly string[]).includes(nextPosition)) {
      setPosition(nextPosition as Position);
    }
    const eu = searchParams.get("eu");
    if (eu === "1") setEuOnly(true);
    else if (eu === "0") setEuOnly(false);
    const nextNationality = searchParams.get("nationality");
    if (nextNationality) setNationality(nextNationality);
    const nextAge = Number(searchParams.get("maxAge"));
    if (Number.isFinite(nextAge) && nextAge >= 18 && nextAge <= 40) setAgeMax(nextAge);
    const nextMv = searchParams.get("maxMv");
    if (nextMv === "any") setValueCap("any");
    else if (nextMv && Number.isFinite(Number(nextMv))) setValueCap(Number(nextMv));
  }, [searchParams]);

  const matchCap = brief?.stretchMv ?? brief?.maxMv;
  const effectiveMaxMv = (() => {
    const fromUi = valueCap === "any" ? Infinity : valueCap;
    const fromBrief = matchCap ?? Infinity;
    const cap = Math.min(fromUi, fromBrief);
    return Number.isFinite(cap) ? String(cap) : "any";
  })();

  useEffect(() => {
    const params = new URLSearchParams({
      status: availability,
      position:
        brief && brief.positions.length > 0 ? brief.positions.join(",") : position,
      nationality,
      maxAge: String(brief?.maxAge ?? ageMax),
      eu: euOnly || brief?.euPassport ? "1" : "0",
      maxMv: effectiveMaxMv,
    });
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
        if (!cancelled) setPlayers([]);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [availability, position, nationality, ageMax, euOnly, effectiveMaxMv, brief]);

  const rows = useMemo(() => {
    const scored = players
      .map((player) => ({
        player,
        match: brief ? scorePlayer(player, brief) : null,
      }))
      .filter((row) => {
        if (!row.match || !brief) return true;
        if (row.match.reasons.includes("positionMiss")) return false;
        if (isUnrealistic(row.player, brief)) return false;
        if (hideWeak && row.match.fit === "weak") return false;
        return true;
      });

    scored.sort((a, b) => {
      if (a.match && b.match && b.match.score !== a.match.score) {
        return b.match.score - a.match.score;
      }
      return b.player.marketValueEur - a.player.marketValueEur;
    });

    return scored;
  }, [players, brief, hideWeak]);

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
  const visibleRows = rows.slice(0, visibleCount);
  const queryString = searchParams.toString();

  function openPlayer(id: string) {
    router.replace(playerSearchPath(locale, id, queryString), { scroll: false });
  }

  function closePlayer() {
    router.replace(searchPathWithoutPlayer(locale, queryString), { scroll: false });
    setSpotlight(null);
    setPlayerError(null);
  }

  useEffect(() => {
    setVisibleCount(25);
  }, [rows]);

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
    setHideWeak(true);
  }

  function clearMatch() {
    setBrief(null);
  }

  function applyWhatsAppText(text: string) {
    const parsed = parseWhatsAppPaste(text);
    setPasteDraft(text);
    setPasteResult(parsed);
    if (parsed.positions.length === 1) setPosition(parsed.positions[0]);
    else if (parsed.positions.length > 1) setPosition("all");
    if (parsed.availability) setAvailability(parsed.availability);
    if (parsed.euPassport) setEuOnly(true);
    const nextBrief = briefFromWhatsApp(text);
    setBrief(nextBrief);
    setHideWeak(true);
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
          {brief ? (
            <label className="check inline">
              <input
                type="checkbox"
                checked={hideWeak}
                onChange={(event) => setHideWeak(event.target.checked)}
              />
              <span>{dict.match.hideWeak}</span>
            </label>
          ) : null}
        </div>
        {brief?.club ? <p className="match-for">{dict.match.for.replace("{club}", brief.club)}</p> : null}
        {brief?.market ? <p className="match-cap">{dict.match.cap.replace("{market}", brief.market)}</p> : null}
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
        {pasteResult ? (
          <ul className="paste-chips">
            {pasteResult.positions.map((code) => (
              <li key={code}>
                {dict.paste.position}: {dict.positions[code]}
              </li>
            ))}
            {pasteResult.availability === "free" ? <li>{dict.paste.free}</li> : null}
            {pasteResult.availability === "expiring" ? <li>{dict.paste.expiring}</li> : null}
            {pasteResult.euPassport ? <li>{dict.paste.eu}</li> : null}
            {pasteResult.loan ? <li>{dict.paste.loan}</li> : null}
            {!pasteResult.positions.length &&
            !pasteResult.availability &&
            !pasteResult.euPassport &&
            !pasteResult.loan ? (
              <li>{dict.paste.empty}</li>
            ) : null}
          </ul>
        ) : null}
      </div>

      <div className="status-toggle" role="tablist" aria-label="Availability">
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
        {availability === "free" ? dict.status.freeNote : dict.status.expiringNote}
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
            : dict.table.results.replace("{count}", String(total > rows.length ? rows.length : total))}
        </p>
        {loading || saveIds.length === 0 ? null : (
          <p className="mb-2 max-w-xl text-sm text-slate-400" role="status">
            {total > rows.length
              ? dict.account.snapshotPartial
                  .replace("{saved}", String(saveIds.length))
                  .replace("{total}", String(total))
              : dict.account.snapshotAll.replace("{saved}", String(saveIds.length))}
          </p>
        )}
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
                  maxAge: ageMax,
                  maxMv: valueCap,
                },
                playerIds,
              }),
            });
            if (res.ok) setSaveState("saved");
            else if (res.status === 401) setSaveState("auth");
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
        {visibleRows.length === 0 ? (
          <li className="empty rounded-2xl border border-slate-800 px-4 py-8">{dict.table.empty}</li>
        ) : (
          visibleRows.map(({ player, match }) => (
            <PlayerCard
              key={player.id}
              player={player}
              match={match}
              dict={dict}
              locale={locale}
              showFit={Boolean(brief)}
              sharePath={playerSearchPath(locale, player.id, queryString)}
              ideal={Boolean(
                match && match.fit === "strong" && match.reasons.includes("position"),
              )}
              onOpen={() => openPlayer(player.id)}
            />
          ))
        )}
      </ul>
      {visibleCount < rows.length ? (
        <button
          type="button"
          className="min-h-12 w-full rounded-xl border border-slate-800 bg-slate-900/70 text-sm font-semibold text-slate-100 md:!hidden"
          onClick={() => setVisibleCount((count) => count + 25)}
        >
          {dict.table.loadMore}
        </button>
      ) : null}

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
                  {dict.table.empty}
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
                  ideal={Boolean(
                    match &&
                      match.fit === "strong" &&
                      match.reasons.includes("position"),
                  )}
                  onOpen={() => openPlayer(player.id)}
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
          onClose={closePlayer}
        />
      ) : null}
    </section>
  );
}

function PlayerRow({
  player,
  match,
  dict,
  locale,
  showFit,
  ideal,
  onOpen,
}: {
  player: Player;
  match: MatchResult | null;
  dict: Dictionary;
  locale: string;
  showFit: boolean;
  ideal: boolean;
  onOpen: () => void;
}) {
  return (
    <tr>
      {showFit && match ? (
        <td>
          <span className={`fit-badge fit-${match.fit}`}>
            {ideal ? dict.match.ideal : dict.match[match.fit]}
          </span>
        </td>
      ) : showFit ? (
        <td>—</td>
      ) : null}
      <td>
        <span className="player-cell">
          <button type="button" className="player-name" onClick={onOpen}>
            {player.name}
          </button>
          <span className={`pos-badge pos-${positionLine(player.position)}`}>{player.position}</span>
          {ideal ? <span className="ideal-tag">{dict.match.ideal}</span> : null}
          <HighlightsLink playerName={player.name} dict={dict} compact />
        </span>
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
  ageMax: number;
  setAgeMax: (value: number) => void;
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
          {dict.filters.age} ≤ {ageMax}
        </span>
        <input
          type="range"
          min={18}
          max={40}
          value={ageMax}
          onChange={(event) => setAgeMax(Number(event.target.value))}
        />
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
  ideal,
  sharePath,
  onOpen,
}: {
  player: Player;
  match: MatchResult | null;
  dict: Dictionary;
  locale: string;
  showFit: boolean;
  ideal: boolean;
  sharePath: string;
  onOpen: () => void;
}) {
  return (
    <li className="overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-900/70 shadow-lg">
      <button
        type="button"
        className="flex min-h-16 w-full flex-col gap-1 px-4 py-3 text-left"
        onClick={onOpen}
      >
        <span className="flex min-w-0 flex-wrap items-center gap-2">
          <span className="min-w-0 break-words font-bold text-white">{player.name}</span>
          <span className={`pos-badge pos-${positionLine(player.position)}`}>{player.position}</span>
          {ideal ? <span className="ideal-tag">{dict.match.ideal}</span> : null}
        </span>
        <span className="break-words text-sm text-slate-400">
          {formatListedClub(player, dict)} · {player.age} · {formatMarketValue(player.marketValueEur, locale)}
        </span>
        {showFit && match ? (
          <span className={`fit-badge fit-${match.fit} w-fit`}>
            {ideal ? dict.match.ideal : dict.match[match.fit]}
          </span>
        ) : null}
      </button>
      <div className="px-4 pb-3">
        <QuickShare
          dict={dict}
          path={sharePath}
          text={playerWhatsAppShare(player, dict, locale)}
        />
      </div>
    </li>
  );
}
