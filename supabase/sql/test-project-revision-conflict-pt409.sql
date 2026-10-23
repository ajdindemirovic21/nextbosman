-- TEST PROJECT ONLY. Do not run on production.
-- Agent must not execute this file. Apply manually in nextbosman-test SQL editor.
-- Replaces revision_conflict SQLSTATE 40001 with PostgREST PT409 (HTTP 409).
-- 40001 is serialization_failure; PostgREST 14 / hasql-transaction retries it until the client aborts.
-- Keeps FOR UPDATE, expected-head check, and the same insert/update bodies. No DELETE of history.

begin;

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

commit;
