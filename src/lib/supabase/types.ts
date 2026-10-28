import type { Availability, CatalogStatus, Position } from "@/data/mock-players";

export type AgentUser = {
  id: string;
  email: string | null;
  fullName: string | null;
  agency: string | null;
  phone: string | null;
  country: string | null;
  createdAt: string;
  updatedAt: string;
};

export type SavedListFilters = {
  status?: CatalogStatus;
  position?: Position | "all";
  nationality?: string;
  euOnly?: boolean;
  minAge?: number;
  maxAge?: number;
  maxMv?: number | "any";
};

export type SavedList = {
  id: string;
  userId: string;
  title: string;
  clubName: string | null;
  queryText: string | null;
  filters: SavedListFilters;
  playerIds: string[];
  shareToken: string | null;
  createdAt: string;
  updatedAt: string;
};

export type PlayerRow = {
  id: string;
  name: string;
  age: number;
  date_of_birth: string | null;
  position: Position;
  club: string | null;
  last_club: string;
  league: string;
  country: string;
  nationality: string;
  eu_passport: boolean;
  availability: Availability;
  contract_until: string | null;
  free_since: string | null;
  has_season_stats?: boolean;
  appearances: number;
  goals: number;
  assists: number;
  minutes_played: number;
  international_caps: number;
  international_goals: number;
  market_value_eur: number;
  profile_url?: string | null;
  review_active?: boolean | null;
  check_status?: string | null;
  club_mode?: string | null;
  club_value?: string | null;
  contract_mode?: string | null;
  contract_value?: string | null;
  source_url?: string | null;
  checked_at?: string | null;
  event_at?: string | null;
  public_note?: string | null;
  auto_club_id?: string | null;
  auto_club_name?: string | null;
  auto_contract_expires?: string | null;
  auto_is_retired?: boolean | null;
  auto_joined?: string | null;
  auto_fetched_at?: string | null;
  filter_bucket?: string | null;
  head_revision_id?: string | null;
};

export type SavedListRow = {
  id: string;
  user_id: string;
  title: string;
  club_name: string | null;
  query_text: string | null;
  filters: SavedListFilters;
  player_ids: string[];
  share_token: string | null;
  created_at: string;
  updated_at: string;
};

export type SharedListPublic = {
  title: string;
  clubName: string | null;
  playerIds: string[];
  updatedAt: string;
};
