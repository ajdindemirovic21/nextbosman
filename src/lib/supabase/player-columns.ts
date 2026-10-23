/** Catalog columns exposed to anon/authenticated queries. No history, private notes, or admin ids. */
export const PLAYERS_TABLE_COLUMNS =
  "id, name, age, date_of_birth, position, club, last_club, league, country, nationality, eu_passport, availability, contract_until, free_since, has_season_stats, appearances, goals, assists, minutes_played, international_caps, international_goals, market_value_eur, profile_url";

export const PLAYERS_EFFECTIVE_COLUMNS = `${PLAYERS_TABLE_COLUMNS}, review_active, check_status, club_mode, club_value, contract_mode, contract_value, source_url, checked_at, event_at, public_note, filter_bucket`;
