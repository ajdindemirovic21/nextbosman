-- TEST PROJECT ONLY. Does not delete existing reviews/revisions.
-- Isolated catalog row for a single apply probe (id 9900099).

insert into public.players (
  id, name, age, date_of_birth, position, club, last_club, league, country,
  nationality, eu_passport, availability, contract_until, free_since,
  has_season_stats, appearances, goals, assists, minutes_played,
  international_caps, international_goals, market_value_eur, profile_url
) values (
  '9900099', 'TEST Isolated Apply', 25, '2001-04-04', 'ST',
  null, 'Listed Last FC', 'Test League', 'Bosnia',
  'Bosnia', true, 'free', null, '2024-06-30',
  false, 0, 0, 0, 0, 0, 0, 100000, null
)
on conflict (id) do nothing;
