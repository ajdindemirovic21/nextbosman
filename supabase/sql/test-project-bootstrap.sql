-- Synthetic catalog rows for an empty TEST project.
-- Included by supabase/sql/test-project-all.sql — do not run this file alone
-- unless schema + add_player_reviews are already applied on the test DB.
-- IDs are numeric strings accepted by isPlayerId (/^[a-zA-Z0-9_-]{1,32}$/).
-- Names are prefixed TEST. profile_url is null (no Transfermarkt profile).

insert into public.players (
  id, name, age, date_of_birth, position, club, last_club, league, country,
  nationality, eu_passport, availability, contract_until, free_since,
  has_season_stats, appearances, goals, assists, minutes_played,
  international_caps, international_goals, market_value_eur, profile_url
) values
  (
    '9900001', 'TEST Free One', 27, '1999-03-01', 'ST',
    null, 'Listed Last FC', 'Test League', 'Bosnia',
    'Bosnia', true, 'free', null, '2024-06-30',
    false, 0, 0, 0, 0, 0, 0, 250000, null
  ),
  (
    '9900002', 'TEST Free Two', 31, '1995-08-12', 'CM',
    null, 'Another Last FC', 'Test League', 'Croatia',
    'Croatia', false, 'free', null, '2023-01-15',
    false, 0, 0, 0, 0, 0, 0, 180000, null
  ),
  (
    '9900003', 'TEST Expiring Near', 24, '2002-01-20', 'ST',
    'Near Club', 'Near Club', 'Test League', 'Germany',
    'Germany', true, 'expiring', '2027-04-30', null,
    true, 10, 2, 1, 800, 0, 0, 900000, null
  ),
  (
    '9900004', 'TEST Expiring Far', 26, '2000-11-05', 'CB',
    'Far Club', 'Far Club', 'Test League', 'Spain',
    'Spain', true, 'expiring', '2029-06-30', null,
    true, 8, 0, 0, 700, 0, 0, 1200000, null
  ),
  (
    '9900005', 'TEST Club Keep', 22, '2004-05-18', 'RB',
    'Keep FC', 'Keep FC', 'Test League', 'Italy',
    'Italy', true, 'expiring', '2027-01-15', null,
    false, 0, 0, 0, 0, 0, 0, 400000, null
  )
on conflict (id) do nothing;
