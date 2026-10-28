-- Prepared overlay objects. For nextbosman-test, run supabase/sql/test-project-auto-snapshots.sql
-- (this file plus synthetic IDs). Do not run on production until source use is approved.
-- Automatic listing snapshots are a separate overlay. CSV catalog and manual reviews stay intact.
-- Failed fetches must not overwrite fetched_at or successful club/contract fields.

create table if not exists public.player_auto_snapshots (
  player_id text primary key references public.players (id) on delete cascade,
  club_id text,
  club_name text,
  contract_expires date,
  is_retired boolean not null default false,
  joined date,
  fetched_at timestamptz,
  last_error text,
  last_error_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint player_auto_snapshots_success_has_time
    check (fetched_at is not null or last_error_at is not null)
);

alter table public.player_auto_snapshots enable row level security;

drop policy if exists "player_auto_snapshots_select_success" on public.player_auto_snapshots;
create policy "player_auto_snapshots_select_success"
  on public.player_auto_snapshots
  for select
  to anon, authenticated
  using (fetched_at is not null);

revoke all on public.player_auto_snapshots from public, anon, authenticated;
grant select (
  player_id,
  club_id,
  club_name,
  contract_expires,
  is_retired,
  joined,
  fetched_at
) on public.player_auto_snapshots to anon, authenticated;

drop view if exists public.players_effective;
drop function if exists public.player_filter_bucket(text, boolean, text, text, date, date, date);

create or replace function public.player_filter_bucket(
  listed text,
  review_active boolean,
  check_status text,
  contract_mode text,
  contract_value date,
  catalog_contract_until date,
  catalog_free_since date,
  auto_fetched_at timestamptz,
  auto_club_id text,
  auto_club_name text,
  auto_contract_expires date,
  auto_is_retired boolean
)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when review_active is true then
      case
        when check_status = 'no_club' then 'no_club'
        when check_status = 'unknown' then 'other'
        when check_status = 'under_contract'
          and public.date_in_next_12_calendar_months(
            case
              when contract_mode = 'unknown' then null
              when contract_mode = 'set' then contract_value
              else COALESCE(catalog_contract_until, catalog_free_since)
            end,
            public.utc_today()
          )
          then 'expiring'
        else 'other'
      end
    when auto_fetched_at is not null and (
      COALESCE(auto_is_retired, false) is true
      or auto_club_id = '123'
    ) then 'other'
    when auto_fetched_at is not null
      and auto_club_id = '515'
      and auto_club_name = 'Without Club'
      and COALESCE(auto_is_retired, false) is not true
      then 'no_club'
    when auto_fetched_at is not null
      and public.date_in_next_12_calendar_months(auto_contract_expires, public.utc_today())
      then 'expiring'
    when auto_fetched_at is not null then 'other'
    else listed
  end;
$$;

create or replace view public.players_effective
with (security_invoker = true)
as
select
  p.id,
  p.name,
  p.age,
  p.date_of_birth,
  p.position,
  p.club,
  p.last_club,
  p.league,
  p.country,
  p.nationality,
  p.eu_passport,
  p.availability,
  p.contract_until,
  p.free_since,
  p.has_season_stats,
  p.appearances,
  p.goals,
  p.assists,
  p.minutes_played,
  p.international_caps,
  p.international_goals,
  p.market_value_eur,
  p.profile_url,
  case when r.active then true else false end as review_active,
  case when r.active then r.check_status else null end as check_status,
  case when r.active then r.club_mode else null end as club_mode,
  case when r.active then r.club_value else null end as club_value,
  case when r.active then r.contract_mode else null end as contract_mode,
  case when r.active then r.contract_value else null end as contract_value,
  case when r.active then r.source_url else null end as source_url,
  case when r.active then r.checked_at else null end as checked_at,
  case when r.active then r.event_at else null end as event_at,
  case when r.active then r.public_note else null end as public_note,
  case when a.fetched_at is not null then a.club_id else null end as auto_club_id,
  case when a.fetched_at is not null then a.club_name else null end as auto_club_name,
  case when a.fetched_at is not null then a.contract_expires else null end as auto_contract_expires,
  case when a.fetched_at is not null then a.is_retired else null end as auto_is_retired,
  case when a.fetched_at is not null then a.joined else null end as auto_joined,
  a.fetched_at as auto_fetched_at,
  public.player_filter_bucket(
    p.availability,
    COALESCE(r.active, false),
    r.check_status,
    r.contract_mode,
    r.contract_value,
    p.contract_until,
    p.free_since,
    a.fetched_at,
    a.club_id,
    a.club_name,
    a.contract_expires,
    a.is_retired
  ) as filter_bucket
from public.players p
left join public.player_reviews r on r.player_id = p.id
left join public.player_auto_snapshots a on a.player_id = p.id;

grant select on public.players_effective to anon, authenticated;
grant execute on function public.player_filter_bucket(text, boolean, text, text, date, date, date, timestamptz, text, text, date, boolean) to anon, authenticated;

-- Write helpers are not granted. Failed fetch updates errors only.
create or replace function public.record_player_auto_snapshot(
  p_player_id text,
  p_club_id text,
  p_club_name text,
  p_contract_expires date,
  p_is_retired boolean,
  p_joined date,
  p_fetched_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_fetched_at is null then
    raise exception 'snapshot requires fetched_at';
  end if;
  insert into public.player_auto_snapshots (
    player_id, club_id, club_name, contract_expires, is_retired, joined, fetched_at, last_error, last_error_at, updated_at
  ) values (
    p_player_id, p_club_id, p_club_name, p_contract_expires, COALESCE(p_is_retired, false), p_joined, p_fetched_at, null, null, pg_catalog.now()
  )
  on conflict (player_id) do update
    set club_id = excluded.club_id,
        club_name = excluded.club_name,
        contract_expires = excluded.contract_expires,
        is_retired = excluded.is_retired,
        joined = excluded.joined,
        fetched_at = excluded.fetched_at,
        last_error = null,
        last_error_at = null,
        updated_at = pg_catalog.now();
end;
$$;

create or replace function public.record_player_auto_fetch_error(
  p_player_id text,
  p_error text,
  p_error_at timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.player_auto_snapshots (
    player_id, last_error, last_error_at, updated_at
  ) values (
    p_player_id, p_error, p_error_at, pg_catalog.now()
  )
  on conflict (player_id) do update
    set last_error = excluded.last_error,
        last_error_at = excluded.last_error_at,
        updated_at = pg_catalog.now();
end;
$$;

revoke all on function public.record_player_auto_snapshot(text, text, text, date, boolean, date, timestamptz) from public, anon, authenticated;
revoke all on function public.record_player_auto_fetch_error(text, text, timestamptz) from public, anon, authenticated;
