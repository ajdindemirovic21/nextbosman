/** Catalog columns exposed to anon/authenticated queries. No history, private notes, or admin ids. */
export const PLAYERS_TABLE_COLUMNS =
  "id, name, age, date_of_birth, position, club, last_club, league, country, nationality, eu_passport, availability, contract_until, free_since, has_season_stats, appearances, goals, assists, minutes_played, international_caps, international_goals, market_value_eur, profile_url";

export const PLAYERS_EFFECTIVE_REVIEW_COLUMNS = `${PLAYERS_TABLE_COLUMNS}, review_active, check_status, club_mode, club_value, contract_mode, contract_value, source_url, checked_at, event_at, public_note, filter_bucket`;

export const PLAYERS_EFFECTIVE_AUTO_COLUMNS =
  "auto_club_id, auto_club_name, auto_contract_expires, auto_is_retired, auto_joined, auto_fetched_at";

/** Prefers auto overlay columns. Catalog code falls back if the view has not been migrated. */
export const PLAYERS_EFFECTIVE_COLUMNS = `${PLAYERS_EFFECTIVE_REVIEW_COLUMNS}, ${PLAYERS_EFFECTIVE_AUTO_COLUMNS}`;

export function isMissingAutoColumns(error: {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
} | null): boolean {
  if (!error) return false;
  const text = `${error.code ?? ""} ${error.message ?? ""} ${error.details ?? ""} ${error.hint ?? ""}`.toLowerCase();
  if (!/auto_(club_id|club_name|contract_expires|is_retired|joined|fetched_at)/.test(text)) return false;
  return (
    error.code === "PGRST204" ||
    error.code === "42703" ||
    text.includes("does not exist") ||
    text.includes("schema cache") ||
    text.includes("could not find")
  );
}
