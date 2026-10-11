import type { Availability, Position } from "@/data/mock-players";

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
  status?: Availability;
  position?: Position | "all";
  nationality?: string;
  euOnly?: boolean;
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
