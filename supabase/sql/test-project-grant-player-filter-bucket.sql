-- TEST PROJECT ONLY (nextbosman-test). Do not run on production.
-- Re-runnable. Grants anon/authenticated execute on the overlay filter helper
-- used by public.players_effective (security_invoker).

grant execute on function public.player_filter_bucket(
  text, boolean, text, text, date, date, date, timestamptz, text, text, date, boolean
) to anon, authenticated;
