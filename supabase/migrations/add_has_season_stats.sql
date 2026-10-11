-- Run in the Supabase SQL editor before npm run push:players.
-- Do not infer missing stats from zero values; this flag is set only when
-- appearances.csv has at least one row on/after 2025-07-01.

alter table public.players
  add column if not exists has_season_stats boolean not null default false;
