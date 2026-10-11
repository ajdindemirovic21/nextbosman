import type { Player } from "@/data/mock-players";
import type { PlayerRow } from "@/lib/supabase/types";

export function mapPlayerRow(row: PlayerRow): Player {
  return {
    id: row.id,
    name: row.name,
    age: row.age,
    dateOfBirth: row.date_of_birth ?? "",
    position: row.position,
    club: row.club,
    lastClub: row.last_club,
    league: row.league,
    country: row.country,
    nationality: row.nationality,
    euPassport: row.eu_passport,
    availability: row.availability,
    contractUntil: row.contract_until,
    freeSince: row.free_since,
    hasSeasonStats: row.has_season_stats === true,
    appearances: row.appearances,
    goals: row.goals,
    assists: row.assists,
    minutesPlayed: row.minutes_played,
    internationalCaps: row.international_caps,
    internationalGoals: row.international_goals,
    marketValueEur: Number(row.market_value_eur) || 0,
  };
}

export function toPlayerRow(player: Player): PlayerRow {
  return {
    id: player.id,
    name: player.name,
    age: player.age,
    date_of_birth: player.dateOfBirth || null,
    position: player.position,
    club: player.club,
    last_club: player.lastClub,
    league: player.league,
    country: player.country,
    nationality: player.nationality,
    eu_passport: player.euPassport,
    availability: player.availability,
    contract_until: player.contractUntil,
    free_since: player.freeSince,
    has_season_stats: player.hasSeasonStats === true,
    appearances: player.appearances,
    goals: player.goals,
    assists: player.assists,
    minutes_played: player.minutesPlayed,
    international_caps: player.internationalCaps,
    international_goals: player.internationalGoals,
    market_value_eur: player.marketValueEur,
  };
}
