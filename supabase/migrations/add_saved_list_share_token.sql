-- Owner-only sharing. Lists stay private until share_token is set.
-- Do not run this automatically against production; paste in the SQL editor after review.
-- Effect: nullable unique token; existing rows stay unshared (NULL).
-- RLS on public.saved_lists is unchanged (owner-only).
-- Public read is only via get_shared_list(token), which returns title, club_name,
-- player_ids, updated_at — never user_id, query_text, filters, or share_token.

alter table public.saved_lists
  add column if not exists share_token text;

create unique index if not exists saved_lists_share_token_idx
  on public.saved_lists (share_token)
  where share_token is not null;

create or replace function public.get_shared_list(p_token text)
returns table (
  title text,
  club_name text,
  player_ids text[],
  updated_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    lists.title,
    lists.club_name,
    lists.player_ids,
    lists.updated_at
  from public.saved_lists as lists
  where p_token is not null
    and char_length(p_token) >= 20
    and lists.share_token = p_token;
$$;

revoke all on function public.get_shared_list(text) from public;
grant execute on function public.get_shared_list(text) to anon, authenticated;
