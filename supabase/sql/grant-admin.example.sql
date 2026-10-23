-- Manual admin grant. Run this yourself in the Supabase SQL editor.
-- Do not run from the Next.js app, CI, or a client session.
-- Google sign-in does not make an agent an admin.

-- 1. Find the user uuid (auth.users / public.users), then:
-- insert into public.admins (user_id)
-- values ('00000000-0000-0000-0000-000000000000');

-- 2. To remove admin:
-- delete from public.admins
-- where user_id = '00000000-0000-0000-0000-000000000000';
