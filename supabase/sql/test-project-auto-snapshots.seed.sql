-- Synthetic catalog rows for auto-overlay checks. IDs 9900211–9900216.
-- Does not modify 9900111–9900115 or CSV catalog files.
-- Fixture copies only; no Transfermarkt HTTP.

insert into public.players (
  id, name, age, date_of_birth, position, club, last_club, league, country,
  nationality, eu_passport, availability, contract_until, free_since,
  has_season_stats, appearances, goals, assists, minutes_played,
  international_caps, international_goals, market_value_eur, profile_url
) values
  (
    '9900211', 'TEST Auto NewClub', 32, '1993-07-18', 'AM',
    null, 'Real Betis Balompié', 'Test League', 'France',
    'France', true, 'free', null, '2026-06-30',
    false, 0, 0, 0, 0, 0, 0, 4000000, null
  ),
  (
    '9900212', 'TEST Auto LongContract', 24, '2001-05-19', 'CB',
    null, 'UD Las Palmas', 'Test League', 'Spain',
    'Spain', true, 'free', null, '2026-06-30',
    false, 0, 0, 0, 0, 0, 0, 5000000, null
  ),
  (
    '9900213', 'TEST Auto Expiring', 39, '1986-04-15', 'GK',
    'Manchester United', 'Manchester United', 'Test League', 'England',
    'England', true, 'expiring', '2027-06-30', null,
    false, 0, 0, 0, 0, 0, 0, 1000000, null
  ),
  (
    '9900214', 'TEST Auto WithoutClub', 29, '1996-12-15', 'LB',
    null, 'Ajax Amsterdam', 'Test League', 'Ukraine',
    'Ukraine', false, 'free', null, '2026-07-01',
    false, 0, 0, 0, 0, 0, 0, 3000000, null
  ),
  (
    '9900215', 'TEST Auto Retired', 41, '1985-07-09', 'RB',
    null, 'Ipswich Town', 'Test League', 'England',
    'England', true, 'free', null, '2026-07-01',
    false, 0, 0, 0, 0, 0, 0, 2000000, null
  ),
  (
    '9900216', 'TEST Auto ManualWins', 28, '1998-01-01', 'ST',
    null, 'Listed Last FC', 'Test League', 'Bosnia',
    'Bosnia', true, 'free', null, '2026-06-30',
    false, 0, 0, 0, 0, 0, 0, 500000, null
  )
on conflict (id) do nothing;

select public.record_player_auto_snapshot(
  '9900211', '40039', 'Abha Club', null, false, '2026-08-06',
  '2026-10-27T09:06:51.895690Z'
);
select public.record_player_auto_snapshot(
  '9900212', '234', 'Feyenoord Rotterdam', '2030-06-30', false, '2026-07-01',
  '2026-10-27T09:06:51.952791Z'
);
select public.record_player_auto_snapshot(
  '9900213', '985', 'Manchester United', '2027-06-30', false, '2021-07-02',
  '2026-10-27T09:21:49.865333Z'
);
select public.record_player_auto_snapshot(
  '9900214', '515', 'Without Club', null, false, '2026-07-01',
  '2026-10-27T09:39:42.498368Z'
);
select public.record_player_auto_snapshot(
  '9900215', '123', 'Retired', null, true, '2026-07-01',
  '2026-10-27T09:21:49.930462Z'
);
select public.record_player_auto_snapshot(
  '9900216', '40039', 'Abha Club', null, false, '2026-08-06',
  '2026-10-27T09:06:51.895690Z'
);

select public.record_player_auto_fetch_error(
  '9900211',
  '429 fixture; no network',
  '2026-10-27T12:00:00Z'
);

do $$
declare
  snap public.player_auto_snapshots%rowtype;
  admin_id uuid;
  rev_id uuid := gen_random_uuid();
begin
  select * into snap from public.player_auto_snapshots where player_id = '9900211';
  if snap.club_name is distinct from 'Abha Club' then
    raise exception '9900211 club changed after fetch error';
  end if;
  if snap.fetched_at is distinct from '2026-10-27T09:06:51.895690Z'::timestamptz then
    raise exception '9900211 fetched_at changed after fetch error';
  end if;
  if snap.last_error is null then
    raise exception '9900211 last_error missing after fetch error';
  end if;

  select user_id into admin_id from public.admins limit 1;
  if admin_id is null then
    raise notice 'skip 9900216 manual overlay: no row in public.admins';
    return;
  end if;

  insert into public.player_review_revisions (
    id, player_id, kind, created_by, check_status, club_mode, club_value,
    contract_mode, contract_value, source_url, checked_at, event_at,
    public_note, private_note, active
  ) values (
    rev_id, '9900216', 'apply', admin_id, 'no_club', 'none', null,
    'unknown', null, 'https://example.com/nextbosman-test-auto',
    '2026-10-26T12:00:00Z', null,
    'manual overlay wins', 'private-auto-test-do-not-leak', true
  );

  insert into public.player_reviews (
    player_id, active, head_revision_id, check_status, club_mode, club_value,
    contract_mode, contract_value, source_url, checked_at, event_at, public_note
  ) values (
    '9900216', true, rev_id, 'no_club', 'none', null,
    'unknown', null, 'https://example.com/nextbosman-test-auto',
    '2026-10-26T12:00:00Z', null, 'manual overlay wins'
  )
  on conflict (player_id) do update
    set active = true,
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
end;
$$;
