-- NextBosman: paste this in the Supabase SQL editor and run once.
-- Tables: public.users (agents), public.players, public.saved_lists

create extension if not exists pgcrypto;

-- Agents (1:1 with auth.users)
create table if not exists public.users (
  id uuid primary key references auth.users (id) on delete cascade,
  email text,
  full_name text,
  agency text,
  phone text,
  country text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Player catalog: position, contract, passport, market value
create table if not exists public.players (
  id text primary key,
  name text not null,
  age integer not null,
  date_of_birth date,
  position text not null check (
    position in ('GK', 'CB', 'LB', 'RB', 'DM', 'CM', 'AM', 'LW', 'RW', 'ST')
  ),
  club text,
  last_club text not null default '',
  league text not null default '',
  country text not null default '',
  nationality text not null default '',
  eu_passport boolean not null default false,
  availability text not null check (availability in ('free', 'expiring')),
  contract_until date,
  free_since date,
  has_season_stats boolean not null default false,
  appearances integer not null default 0,
  goals integer not null default 0,
  assists integer not null default 0,
  minutes_played integer not null default 0,
  international_caps integer not null default 0,
  international_goals integer not null default 0,
  market_value_eur bigint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists players_search_idx
  on public.players (availability, position, eu_passport, age, market_value_eur desc);

create index if not exists players_nationality_idx
  on public.players (nationality);

create index if not exists players_name_idx
  on public.players (name);

-- Saved shortlists tied to a club WhatsApp / brief
create table if not exists public.saved_lists (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users (id) on delete cascade,
  title text not null,
  club_name text,
  query_text text,
  filters jsonb not null default '{}'::jsonb,
  player_ids text[] not null default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists saved_lists_user_idx
  on public.saved_lists (user_id, created_at desc);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists users_set_updated_at on public.users;
create trigger users_set_updated_at
  before update on public.users
  for each row execute procedure public.set_updated_at();

drop trigger if exists players_set_updated_at on public.players;
create trigger players_set_updated_at
  before update on public.players
  for each row execute procedure public.set_updated_at();

drop trigger if exists saved_lists_set_updated_at on public.saved_lists;
create trigger saved_lists_set_updated_at
  before update on public.saved_lists
  for each row execute procedure public.set_updated_at();

-- Create agent row when someone signs up
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.users (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', new.raw_user_meta_data ->> 'name')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

create or replace function public.player_nationalities()
returns text[]
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(array_agg(n order by n), '{}')
  from (
    select distinct nationality as n
    from public.players
    where nationality is not null and nationality <> ''
  ) names;
$$;

alter table public.users enable row level security;
alter table public.players enable row level security;
alter table public.saved_lists enable row level security;

drop policy if exists "users_select_own" on public.users;
create policy "users_select_own" on public.users
  for select using (auth.uid() = id);

drop policy if exists "users_update_own" on public.users;
create policy "users_update_own" on public.users
  for update using (auth.uid() = id) with check (auth.uid() = id);

drop policy if exists "users_insert_own" on public.users;
create policy "users_insert_own" on public.users
  for insert with check (auth.uid() = id);

drop policy if exists "players_public_read" on public.players;
create policy "players_public_read" on public.players
  for select using (true);

drop policy if exists "saved_lists_select_own" on public.saved_lists;
create policy "saved_lists_select_own" on public.saved_lists
  for select using (auth.uid() = user_id);

drop policy if exists "saved_lists_insert_own" on public.saved_lists;
create policy "saved_lists_insert_own" on public.saved_lists
  for insert with check (auth.uid() = user_id);

drop policy if exists "saved_lists_update_own" on public.saved_lists;
create policy "saved_lists_update_own" on public.saved_lists
  for update using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists "saved_lists_delete_own" on public.saved_lists;
create policy "saved_lists_delete_own" on public.saved_lists
  for delete using (auth.uid() = user_id);

grant usage on schema public to anon, authenticated;
grant select on public.players to anon, authenticated;
grant select, insert, update on public.users to authenticated;
grant select, insert, update, delete on public.saved_lists to authenticated;
grant execute on function public.player_nationalities() to anon, authenticated;
