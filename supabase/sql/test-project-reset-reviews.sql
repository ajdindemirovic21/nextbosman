-- PROPOSED cleanup for TEST project only. Do not run on production.
-- Do not run until test-project-diagnostics.sql is reviewed.
-- Deactivate-only is not enough: head_revision_id and history rows remain.
-- Order matters: player_reviews.head_revision_id references player_review_revisions(id).

-- 1) If diagnostics show idle-in-transaction / lock waits, cancel those
--    backends in the dashboard (or pg_cancel_backend) BEFORE this file.
--    Terminating while holding FOR UPDATE is what made apply wait.
--    This file does not cancel backends.

-- 2) Remove overlay + history for synthetic ids. Catalog rows stay.

begin;

delete from public.player_reviews
where player_id in ('9900001', '9900002', '9900003', '9900004', '9900005');

delete from public.player_review_revisions
where player_id in ('9900001', '9900002', '9900003', '9900004', '9900005');

-- Optional check (should be 0 / 0):
-- select count(*) from public.player_reviews where player_id like '99000%';
-- select count(*) from public.player_review_revisions where player_id like '99000%';

commit;

-- 3) After this, filter_bucket is listed CSV again (free=2, expiring=3, no_club=0).
-- 4) Then: TEST_REVIEW_WRITES=1 node scripts/review-security.live.mjs
