import Link from "next/link";
import { getPlayersByIds } from "@/data/catalog";
import type { Dictionary } from "@/i18n/get-dictionary";
import type { Locale } from "@/i18n/config";
import { contractNote, contractPrimary, formatListedClub } from "@/lib/contract-display";
import { formatMarketValue } from "@/lib/format";
import { uniquePlayerIds } from "@/lib/player-ids";
import { playerSearchPath } from "@/lib/player-link";
import type { SharedListPublic } from "@/lib/supabase/types";

type Props = {
  lang: Locale;
  dict: Dictionary;
  list: SharedListPublic;
};

export async function SharedListDesk({ lang, dict, list }: Props) {

  const ids = uniquePlayerIds(list.playerIds);
  const players = await getPlayersByIds(ids);
  const byId = new Map(players.map((player) => [player.id, player]));

  return (
    <main className="page">
      <section className="hero hero-compact">
        <p className="kicker text-xs font-semibold uppercase tracking-wider text-emerald-400">
          {dict.nav.lists}
        </p>
        <h1 className="text-3xl font-extrabold tracking-tight text-white">{list.title}</h1>
        <p className="lede">
          {list.clubName ? `${list.clubName} · ` : ""}
          {dict.account.players.replace("{count}", String(ids.length))}
        </p>
        <p className="agent-msg" role="status">
          {dict.account.shareAnyone}
        </p>
        <p className="text-sm text-slate-500">{dict.search.subtitle}</p>
      </section>
      <ul className="saved-lists">
        <li>
          {ids.length === 0 ? (
            <p className="text-sm text-slate-500">{dict.account.emptyMembers}</p>
          ) : (
            <ul className="mt-1 grid list-none gap-3 p-0">
              {ids.map((id) => {
                const player = byId.get(id);
                if (!player) {
                  return (
                    <li key={id} className="text-sm text-slate-400">
                      {dict.account.playerMissing}
                    </li>
                  );
                }
                const note = contractNote(player, dict);
                return (
                  <li key={id}>
                    <Link
                      className="text-sm font-semibold text-emerald-400 no-underline"
                      href={playerSearchPath(lang, player.id)}
                    >
                      {player.name}
                    </Link>
                    <p className="mt-1 text-sm text-slate-400">
                      {player.position} · {player.age} · {player.nationality}
                      {player.euPassport ? ` · ${dict.filters.euPassport}` : ""}
                    </p>
                    <p className="text-sm text-slate-500">
                      {formatListedClub(player, dict)}
                      {player.league ? ` · ${player.league}` : ""}
                    </p>
                    <p className="text-sm text-slate-500">
                      {contractPrimary(player, dict, lang)}
                      {note ? ` · ${note}` : ""}
                    </p>
                    <p className="text-sm text-slate-500">
                      {dict.table.marketValue}: {formatMarketValue(player.marketValueEur, lang)}
                    </p>
                    <p className="text-sm text-slate-500">
                      {player.hasSeasonStats
                        ? `${dict.profile.matches} ${player.appearances} · ${dict.profile.goals} ${player.goals} · ${dict.profile.assists} ${player.assists}`
                        : dict.profile.statsUnavailable}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </li>
      </ul>
    </main>
  );
}
