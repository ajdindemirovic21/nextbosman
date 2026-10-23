-- TEST PROJECT ONLY (nextbosman-test). Do not run on production.
-- Does not delete reviews or revisions. Fresh catalog rows for one security suite.
-- IDs: 9900111 apply/rollback, 9900112 free control, 9900113 deactivate,
--      9900114 expiring control, 9900115 parallel first-create.

insert into public.players (
  id, name, age, date_of_birth, position, club, last_club, league, country,
  nationality, eu_passport, availability, contract_until, free_since,
  has_season_stats, appearances, goals, assists, minutes_played,
  international_caps, international_goals, market_value_eur, profile_url
) values
  (
    '9900111', 'TEST Sec Apply', 27, '1999-03-01', 'ST',
    null, 'Listed Last FC', 'Test League', 'Bosnia',
    'Bosnia', true, 'free', null, '2024-06-30',
    false, 0, 0, 0, 0, 0, 0, 250000, null
  ),
  (
    '9900112', 'TEST Sec Free Two', 31, '1995-08-12', 'CM',
    null, 'Another Last FC', 'Test League', 'Croatia',
    'Croatia', false, 'free', null, '2023-01-15',
    false, 0, 0, 0, 0, 0, 0, 180000, null
  ),
  (
    '9900113', 'TEST Sec Deactivate', 24, '2002-01-20', 'ST',
    'Near Club', 'Near Club', 'Test League', 'Germany',
    'Germany', true, 'expiring', '2027-04-30', null,
    true, 10, 2, 1, 800, 0, 0, 900000, null
  ),
  (
    '9900114', 'TEST Sec Expiring Far', 26, '2000-11-05', 'CB',
    'Far Club', 'Far Club', 'Test League', 'Spain',
    'Spain', true, 'expiring', '2029-06-30', null,
    true, 8, 0, 0, 700, 0, 0, 1200000, null
  ),
  (
    '9900115', 'TEST Sec Parallel', 22, '2004-05-18', 'RB',
    'Keep FC', 'Keep FC', 'Test League', 'Italy',
    'Italy', true, 'expiring', '2027-01-15', null,
    false, 0, 0, 0, 0, 0, 0, 400000, null
  )
on conflict (id) do nothing;
