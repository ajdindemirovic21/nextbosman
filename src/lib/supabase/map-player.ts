import type { Player } from "@/data/mock-players";
import { parseAutoSnapshotRow } from "@/lib/auto-refresh";
import { applyPlayerLayers, parseManualReviewRow } from "@/lib/player-review";
import { parseTransfermarktProfileUrl } from "@/lib/profile-url";
import type { PlayerRow } from "@/lib/supabase/types";

export function mapPlayerRow(row: PlayerRow): Player {
  const id = String(row.id);
  const base: Player = {
    id,
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
    profileUrl: parseTransfermarktProfileUrl(row.profile_url, id),
    manualReview: null,
    autoRefresh: null,
    filterBucket: row.availability,
  };
  const review = parseManualReviewRow({
    active: row.review_active,
    check_status: row.check_status,
    club_mode: row.club_mode,
    club_value: row.club_value,
    contract_mode: row.contract_mode,
    contract_value: row.contract_value,
    source_url: row.source_url,
    checked_at: row.checked_at,
    event_at: row.event_at,
    public_note: row.public_note,
  });
  const auto = parseAutoSnapshotRow({
    auto_fetched_at: row.auto_fetched_at,
    auto_club_id: row.auto_club_id,
    auto_club_name: row.auto_club_name,
    auto_contract_expires: row.auto_contract_expires,
    auto_is_retired: row.auto_is_retired,
    auto_joined: row.auto_joined,
  });
  return applyPlayerLayers(base, review, auto);
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
    profile_url: parseTransfermarktProfileUrl(player.profileUrl, player.id),
  };
}
