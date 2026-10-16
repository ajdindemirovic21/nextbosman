-- Run in the Supabase SQL editor before npm run index:players and npm run push:players.
-- Stores the Transfermarkt profile URL from players.csv url, never a guessed name URL.

alter table public.players
  add column if not exists profile_url text;
