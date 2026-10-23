-- Manual player reviews (overlay). This is the production SQL for that feature.
-- Do NOT run from the app, CI, or this agent. Apply yourself in the SQL editor.
-- Requires existing public.players with has_season_stats and profile_url
-- (add_has_season_stats.sql / add_profile_url.sql already on production).
-- Does not include schema.sql, catalog seed, synthetic players, test users,
-- or INSERT into public.admins.
--
-- Privacy: the name players_effective does not hide columns. The view is
-- security_invoker, lists only public review fields, and RLS on the base
-- tables still applies. History (created_by, private_note) lives only on
-- player_review_revisions, has no SELECT grant, and is read by admins only
-- through security definer RPCs.
--
-- After this file, grant an admin yourself. See supabase/sql/grant-admin.example.sql
-- Google sign-in does not grant admin. Do not insert admins from the client.

create table if not exists public.admins (
  user_id uuid primary key references public.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

alter table public.admins enable row level security;

-- No insert/update/delete policies: grants are SQL-only.

create table if not exists public.player_review_revisions (
  id uuid primary key default gen_random_uuid(),
  player_id text not null references public.players (id) on delete cascade,
  kind text not null check (kind in ('apply', 'rollback', 'deactivate')),
  created_by uuid not null references public.users (id),
  created_at timestamptz not null default now(),
  check_status text,
  club_mode text,
  club_value text,
  contract_mode text,
  contract_value date,
  source_url text,
  checked_at timestamptz,
  event_at date,
  public_note text,
  private_note text,
  active boolean not null
);

create index if not exists player_review_revisions_player_idx
  on public.player_review_revisions (player_id, created_at desc);

alter table public.player_review_revisions enable row level security;

create table if not exists public.player_reviews (
  player_id text primary key references public.players (id) on delete cascade,
  active boolean not null default true,
  head_revision_id uuid not null references public.player_review_revisions (id),
  check_status text not null check (check_status in ('no_club', 'under_contract', 'unknown')),
  club_mode text not null check (club_mode in ('keep', 'set', 'unknown', 'none')),
  club_value text,
  contract_mode text not null check (contract_mode in ('keep', 'set', 'unknown')),
  contract_value date,
  source_url text not null,
  checked_at timestamptz not null,
  event_at date,
  public_note text not null default ''
);

alter table public.player_reviews enable row level security;

create or replace function public.utc_today()
returns date
language sql
stable
set search_path = ''
as $$
  select (pg_catalog.timezone('UTC', pg_catalog.now()))::date;
$$;

create or replace function public.add_calendar_months_utc(d date, months integer)
returns date
language plpgsql
immutable
set search_path = ''
as $$
declare
  y integer;
  m integer;
  day integer;
  month_index integer;
  ny integer;
  nm integer;
  dim integer;
begin
  y := pg_catalog.date_part('year', d)::integer;
  m := pg_catalog.date_part('month', d)::integer;
  day := pg_catalog.date_part('day', d)::integer;
  month_index := (m - 1) + months;
  ny := y + pg_catalog.floor(month_index / 12.0)::integer;
  nm := month_index % 12;
  if nm < 0 then
    nm := nm + 12;
    ny := ny - 1;
  end if;
  dim := pg_catalog.date_part(
    'day',
    pg_catalog.date_trunc('month', pg_catalog.make_date(ny, nm + 1, 1)::timestamp)
    + interval '1 month - 1 day'
  )::integer;
  if day > dim then
    day := dim;
  end if;
  return pg_catalog.make_date(ny, nm + 1, day);
end;
$$;

create or replace function public.date_in_next_12_calendar_months(end_date date, today date)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select end_date is not null
    and today is not null
    and end_date > today
    and end_date <= public.add_calendar_months_utc(today, 12);
$$;

create or replace function public.player_filter_bucket(
  listed text,
  review_active boolean,
  check_status text,
  contract_mode text,
  contract_value date,
  catalog_contract_until date,
  catalog_free_since date
)
returns text
language sql
stable
set search_path = ''
as $$
  select case
    when review_active is not true then listed
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
  end;
$$;

-- Invoker view: caller RLS of players + player_reviews applies.
-- head_revision_id, created_by, and private_note are not in the view.
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
  public.player_filter_bucket(
    p.availability,
    COALESCE(r.active, false),
    r.check_status,
    r.contract_mode,
    r.contract_value,
    p.contract_until,
    p.free_since
  ) as filter_bucket
from public.players p
left join public.player_reviews r on r.player_id = p.id;

create or replace function public.current_user_is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.admins
    where user_id = auth.uid()
  );
$$;

create or replace function public.apply_player_review(
  p_player_id text,
  p_check_status text,
  p_club_mode text,
  p_club_value text,
  p_contract_mode text,
  p_contract_value date,
  p_source_url text,
  p_event_at date,
  p_public_note text,
  p_private_note text,
  p_expected_head_revision_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_head uuid;
  new_id uuid;
  club_mode text;
begin
  if not public.current_user_is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  if not exists (select 1 from public.players where id = p_player_id) then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if p_check_status not in ('no_club', 'under_contract', 'unknown') then
    raise exception 'invalid_status';
  end if;
  if p_source_url is null
     or p_source_url !~ '^https://[^[:space:]/@]+'
     or pg_catalog.strpos(p_source_url, '@') > 0 then
    raise exception 'invalid_source';
  end if;

  club_mode := case when p_check_status = 'no_club' then 'none' else p_club_mode end;
  if p_check_status = 'no_club' then
    p_club_value := null;
  elsif club_mode not in ('keep', 'set', 'unknown') then
    raise exception 'invalid_club_mode';
  end if;
  if p_contract_mode not in ('keep', 'set', 'unknown') then
    raise exception 'invalid_contract_mode';
  end if;
  if p_check_status = 'under_contract' and club_mode = 'keep' then
    if not exists (
      select 1 from public.players
      where id = p_player_id and club is not null and pg_catalog.btrim(club) <> ''
    ) then
      raise exception 'invalid_club';
    end if;
  end if;
  if club_mode = 'set' and COALESCE(pg_catalog.btrim(p_club_value), '') = '' then
    raise exception 'invalid_club';
  end if;

  p_public_note := pg_catalog.left(
    pg_catalog.btrim(pg_catalog.regexp_replace(COALESCE(p_public_note, ''), '<[^>]*>', ' ', 'g')),
    500
  );
  p_private_note := pg_catalog.left(
    pg_catalog.btrim(pg_catalog.regexp_replace(COALESCE(p_private_note, ''), '<[^>]*>', ' ', 'g')),
    2000
  );
  if club_mode = 'set' then
    p_club_value := pg_catalog.left(
      pg_catalog.btrim(pg_catalog.regexp_replace(COALESCE(p_club_value, ''), '<[^>]*>', ' ', 'g')),
      120
    );
  else
    p_club_value := null;
  end if;

  -- Serialize first create and later updates on the same player.
  perform 1 from public.players where id = p_player_id for update;
  select head_revision_id into current_head
  from public.player_reviews
  where player_id = p_player_id
  for update;

  -- First create: both sides null. Later writes: expected must match head.
  if COALESCE(current_head::text, '')
       is distinct from COALESCE(p_expected_head_revision_id::text, '') then
    -- PT409 → HTTP 409. Do not use 40001: PostgREST retries serialization_failure.
    raise sqlstate 'PT409' using message = 'revision_conflict';
  end if;

  insert into public.player_review_revisions (
    player_id, kind, created_by, check_status, club_mode, club_value,
    contract_mode, contract_value, source_url, checked_at, event_at,
    public_note, private_note, active
  ) values (
    p_player_id, 'apply', auth.uid(), p_check_status, club_mode, p_club_value,
    p_contract_mode, p_contract_value, p_source_url, pg_catalog.now(), p_event_at,
    COALESCE(p_public_note, ''), p_private_note, true
  ) returning id into new_id;

  insert into public.player_reviews (
    player_id, active, head_revision_id, check_status, club_mode, club_value,
    contract_mode, contract_value, source_url, checked_at, event_at, public_note
  ) values (
    p_player_id, true, new_id, p_check_status, club_mode, p_club_value,
    p_contract_mode, p_contract_value, p_source_url, pg_catalog.now(), p_event_at,
    COALESCE(p_public_note, '')
  )
  on conflict (player_id) do update set
    active = true,
    head_revision_id = excluded.head_revision_id,
    check_status = excluded.check_status,
    club_mode = excluded.club_mode,
    club_value = excluded.club_value,
    contract_mode = excluded.contract_mode,
    contract_value = excluded.contract_value,
    source_url = excluded.source_url,
    checked_at = excluded.checked_at,
    event_at = excluded.event_at,
    public_note = excluded.public_note;

  return pg_catalog.jsonb_build_object('ok', true, 'head_revision_id', new_id);
end;
$$;

create or replace function public.deactivate_player_review(
  p_player_id text,
  p_expected_head_revision_id uuid,
  p_private_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current public.player_reviews%rowtype;
  new_id uuid;
begin
  if not public.current_user_is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  select * into current from public.player_reviews where player_id = p_player_id for update;
  if current.player_id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if current.head_revision_id is distinct from p_expected_head_revision_id then
    -- PT409 → HTTP 409. Do not use 40001: PostgREST retries serialization_failure.
    raise sqlstate 'PT409' using message = 'revision_conflict';
  end if;

  insert into public.player_review_revisions (
    player_id, kind, created_by, check_status, club_mode, club_value,
    contract_mode, contract_value, source_url, checked_at, event_at,
    public_note, private_note, active
  ) values (
    p_player_id, 'deactivate', auth.uid(), current.check_status, current.club_mode, current.club_value,
    current.contract_mode, current.contract_value, current.source_url, current.checked_at, current.event_at,
    current.public_note, p_private_note, false
  ) returning id into new_id;

  update public.player_reviews
  set active = false, head_revision_id = new_id
  where player_id = p_player_id;

  return pg_catalog.jsonb_build_object('ok', true, 'head_revision_id', new_id);
end;
$$;

create or replace function public.rollback_player_review(
  p_player_id text,
  p_revision_id uuid,
  p_expected_head_revision_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  current_head uuid;
  target public.player_review_revisions%rowtype;
  new_id uuid;
  review_exists boolean;
begin
  if not public.current_user_is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  select true into review_exists from public.player_reviews where player_id = p_player_id for update;
  if review_exists is not true then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  select head_revision_id into current_head from public.player_reviews where player_id = p_player_id;
  if current_head is distinct from p_expected_head_revision_id then
    -- PT409 → HTTP 409. Do not use 40001: PostgREST retries serialization_failure.
    raise sqlstate 'PT409' using message = 'revision_conflict';
  end if;
  select * into target from public.player_review_revisions
  where id = p_revision_id and player_id = p_player_id;
  if target.id is null then
    raise exception 'not_found' using errcode = 'P0002';
  end if;
  if target.active and (target.source_url is null or target.checked_at is null or target.check_status is null) then
    raise exception 'invalid_revision';
  end if;

  insert into public.player_review_revisions (
    player_id, kind, created_by, check_status, club_mode, club_value,
    contract_mode, contract_value, source_url, checked_at, event_at,
    public_note, private_note, active
  ) values (
    p_player_id, 'rollback', auth.uid(), target.check_status, target.club_mode, target.club_value,
    target.contract_mode, target.contract_value, target.source_url, target.checked_at, target.event_at,
    target.public_note, target.private_note, target.active
  ) returning id into new_id;

  if target.active then
    insert into public.player_reviews (
      player_id, active, head_revision_id, check_status, club_mode, club_value,
      contract_mode, contract_value, source_url, checked_at, event_at, public_note
    ) values (
      p_player_id, true, new_id, target.check_status, target.club_mode, target.club_value,
      target.contract_mode, target.contract_value, target.source_url,
      target.checked_at, target.event_at, COALESCE(target.public_note, '')
    )
    on conflict (player_id) do update set
      active = true,
      head_revision_id = excluded.head_revision_id,
      check_status = excluded.check_status,
      club_mode = excluded.club_mode,
      club_value = excluded.club_value,
      contract_mode = excluded.contract_mode,
      contract_value = excluded.contract_value,
      source_url = excluded.source_url,
      checked_at = excluded.checked_at,
      event_at = excluded.event_at,
      public_note = excluded.public_note;
  else
    update public.player_reviews
    set active = false, head_revision_id = new_id
    where player_id = p_player_id;
  end if;

  return pg_catalog.jsonb_build_object('ok', true, 'head_revision_id', new_id);
end;
$$;

create or replace function public.admin_player_review_history(p_player_id text)
returns setof public.player_review_revisions
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return query
    select * from public.player_review_revisions
    where player_id = p_player_id
    order by created_at desc;
end;
$$;

create or replace function public.admin_player_review_current(p_player_id text)
returns setof public.player_reviews
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.current_user_is_admin() then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return query
    select * from public.player_reviews
    where player_id = p_player_id;
end;
$$;

drop policy if exists "admins_select_self" on public.admins;
create policy "admins_select_self" on public.admins
  for select using (auth.uid() = user_id);

drop policy if exists "player_reviews_public_select" on public.player_reviews;
create policy "player_reviews_public_select" on public.player_reviews
  for select using (active is true);

-- No write policies on player_reviews / revisions: only security definer RPCs.
-- No SELECT policy on player_review_revisions: table owner / definer RPCs only.

revoke all on public.admins from public, anon, authenticated;
grant select on public.admins to authenticated;

revoke all on public.player_reviews from public, anon, authenticated;
grant select (
  player_id,
  active,
  check_status,
  club_mode,
  club_value,
  contract_mode,
  contract_value,
  source_url,
  checked_at,
  event_at,
  public_note
) on public.player_reviews to anon, authenticated;

revoke all on public.player_review_revisions from public, anon, authenticated;

revoke all on public.players_effective from public, anon, authenticated;
grant select on public.players_effective to anon, authenticated;

revoke all on function public.apply_player_review(text, text, text, text, text, date, text, date, text, text, uuid) from public, anon, authenticated;
revoke all on function public.deactivate_player_review(text, uuid, text) from public, anon, authenticated;
revoke all on function public.rollback_player_review(text, uuid, uuid) from public, anon, authenticated;
revoke all on function public.admin_player_review_history(text) from public, anon, authenticated;
revoke all on function public.admin_player_review_current(text) from public, anon, authenticated;
revoke all on function public.current_user_is_admin() from public, anon, authenticated;
grant execute on function public.current_user_is_admin() to authenticated;
grant execute on function public.apply_player_review(text, text, text, text, text, date, text, date, text, text, uuid) to authenticated;
grant execute on function public.deactivate_player_review(text, uuid, text) to authenticated;
grant execute on function public.rollback_player_review(text, uuid, uuid) to authenticated;
grant execute on function public.admin_player_review_history(text) to authenticated;
grant execute on function public.admin_player_review_current(text) to authenticated;

revoke all on function public.utc_today() from public, anon, authenticated;
revoke all on function public.add_calendar_months_utc(date, integer) from public, anon, authenticated;
revoke all on function public.date_in_next_12_calendar_months(date, date) from public, anon, authenticated;
revoke all on function public.player_filter_bucket(text, boolean, text, text, date, date, date) from public, anon, authenticated;
grant execute on function public.utc_today() to anon, authenticated;
grant execute on function public.add_calendar_months_utc(date, integer) to anon, authenticated;
grant execute on function public.date_in_next_12_calendar_months(date, date) to anon, authenticated;
grant execute on function public.player_filter_bucket(text, boolean, text, text, date, date, date) to anon, authenticated;
