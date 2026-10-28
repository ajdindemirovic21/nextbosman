-- TEST PROJECT ONLY (nextbosman-test). Do not run on production.
-- Minimal catalog row so a snapshot for 203496 can be persisted.
-- CSV-style free_since 2026-06-30 is intentional: overlay must not keep that date.

insert into public.players (
  id,
  name,
  age,
  date_of_birth,
  position,
  club,
  last_club,
  league,
  country,
  nationality,
  eu_passport,
  availability,
  contract_until,
  free_since,
  profile_url
)
values (
  '203496',
  'Nabil Fekir',
  33,
  '1993-07-18',
  'AM',
  null,
  'Real Betis Balompié',
  '',
  'France',
  'France',
  true,
  'free',
  null,
  '2026-06-30',
  'https://www.transfermarkt.co.uk/nabil-fekir/profil/spieler/203496'
)
on conflict (id) do nothing;
