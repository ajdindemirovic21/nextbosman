-- Read-only / RPC checks for a TEST Supabase project AFTER applying
-- supabase/migrations/add_player_reviews.sql there.
-- Do not run against production. Do not run from the Next.js app.
-- Expected outcomes are comments, not assertions executed here.

-- 0) Roles: use three clients
--    A) anon key, no session
--    B) authenticated JWT of a normal agent (NOT in public.admins)
--    C) authenticated JWT of a test admin (inserted only in the test project)

-- 1) View is invoker-security
-- select relname, reloptions from pg_class where relname = 'players_effective';
-- Expect: security_invoker=true

-- 2) Grants (as postgres/sql editor)
-- select grantee, privilege_type, column_name
-- from information_schema.role_column_grants
-- where table_schema = 'public' and table_name in ('player_reviews', 'player_review_revisions', 'admins', 'players_effective')
-- order by table_name, grantee, column_name;
-- Expect: anon/authenticated SELECT on players_effective;
--         anon/authenticated column SELECT on player_reviews WITHOUT head_revision_id;
--         no SELECT for anon/authenticated on player_review_revisions;
--         authenticated SELECT on admins only.

-- select proname, prosecdef, proconfig
-- from pg_proc join pg_namespace n on n.oid = pronamespace
-- where nspname = 'public' and proname in (
--   'apply_player_review','deactivate_player_review','rollback_player_review',
--   'admin_player_review_history','admin_player_review_current','current_user_is_admin'
-- );
-- Expect: prosecdef true, proconfig contains search_path=

-- select grantee, privilege_type, routine_name
-- from information_schema.routine_privileges
-- where routine_schema = 'public'
--   and routine_name in (
--     'apply_player_review','deactivate_player_review','rollback_player_review',
--     'admin_player_review_history','admin_player_review_current','current_user_is_admin'
--   );
-- Expect: EXECUTE for authenticated only; none for anon / PUBLIC.

-- 3) Anon (client A) REST/PostgREST
-- GET /rest/v1/players_effective?select=id,filter_bucket,check_status,public_note,review_active&limit=1
-- Expect: 200, no private_note, no created_by, no head_revision_id.
-- GET /rest/v1/player_review_revisions?select=*
-- Expect: 401/403 or empty error, not rows.
-- GET /rest/v1/player_reviews?select=*
-- Expect: only active rows; payload has no head_revision_id / created_by / private_note.
-- POST /rest/v1/rpc/apply_player_review  (anon)
-- Expect: 401 or permission denied for execute.
-- POST /rest/v1/rpc/admin_player_review_history
-- Expect: no execute for anon.

-- 4) Ordinary signed-in user (client B)
-- GET player_review_revisions -> denied
-- GET player_reviews?active=eq.false -> zero rows (RLS)
-- RPC admin_player_review_history / admin_player_review_current / apply_player_review
-- Expect: not_admin / 42501
-- GET players_effective for a player with an inactive overlay
-- Expect: review columns null, filter_bucket = listed availability (not overlay)

-- 5) Admin (client C) — first create
-- RPC apply_player_review with p_expected_head_revision_id = null
-- Expect: ok + new head
-- Repeat the same call with null expected
-- Expect: revision_conflict with SQLSTATE PT409 / HTTP 409 (not 40001)
-- Parallel: two first-creates on the same player_id with null expected
-- Expect: one ok, one PT409 / HTTP 409 (head check after FOR UPDATE)

-- 6) Admin history and deactivated overlay
-- RPC admin_player_review_current after deactivate
-- Expect: row with active=false (this RPC is why table SELECT is active-only)
-- RPC admin_player_review_history
-- Expect: rows including private_note and created_by (admin only)
-- Anon GET players_effective for that player
-- Expect: no overlay, listed bucket
-- Public app GET /api/players?status=no_club must not include that player unless overlay is active no_club

-- 7) Public app routes (test deployment pointing at TEST db)
-- GET /api/players?status=no_club  (JSON fallback if view missing)
-- Expect: catalogLimited true and zero players, none with manualReview
-- GET /api/players?status=no_club  (after view exists, no overlays)
-- Expect: catalogLimited false, total 0
-- GET /api/admin/player-reviews as user B
-- Expect: 403
-- GET /api/admin/player-reviews as user C
-- Expect: history present; GET /api/players must still omit history and private_note
