-- READ-ONLY diagnostics for the TEST project SQL editor (nextbosman-test).
-- Do not run on production. Do not pg_terminate_backend / pg_cancel_backend here.
-- This file does not INSERT/UPDATE/DELETE.

select pg_catalog.now() as observed_at, current_database() as db;

-- Backends: state, wait_event, transaction/query age. pid of this editor is excluded.
select
  a.pid,
  a.usename,
  a.application_name,
  a.client_addr,
  a.state,
  a.wait_event_type,
  a.wait_event,
  round(extract(epoch from (pg_catalog.now() - a.xact_start))::numeric, 1) as xact_seconds,
  round(extract(epoch from (pg_catalog.now() - a.query_start))::numeric, 1) as query_seconds,
  round(extract(epoch from (pg_catalog.now() - a.state_change))::numeric, 1) as state_change_seconds,
  left(a.query, 240) as query_prefix
from pg_stat_activity a
where a.datname = current_database()
  and a.pid <> pg_backend_pid()
order by a.xact_start nulls last, a.query_start nulls last;

-- Who waits on whom (lock blocking).
select
  waiting.pid as waiting_pid,
  waiting.state as waiting_state,
  waiting.wait_event_type,
  waiting.wait_event,
  round(extract(epoch from (pg_catalog.now() - waiting.query_start))::numeric, 1) as waiting_query_seconds,
  left(waiting.query, 180) as waiting_query,
  blocking.pid as blocking_pid,
  blocking.state as blocking_state,
  round(extract(epoch from (pg_catalog.now() - blocking.xact_start))::numeric, 1) as blocking_xact_seconds,
  left(blocking.query, 180) as blocking_query
from pg_stat_activity waiting
join pg_locks waiting_lock
  on waiting_lock.pid = waiting.pid and not waiting_lock.granted
join pg_locks blocking_lock
  on blocking_lock.locktype = waiting_lock.locktype
 and blocking_lock.database is not distinct from waiting_lock.database
 and blocking_lock.relation is not distinct from waiting_lock.relation
 and blocking_lock.page is not distinct from waiting_lock.page
 and blocking_lock.tuple is not distinct from waiting_lock.tuple
 and blocking_lock.virtualxid is not distinct from waiting_lock.virtualxid
 and blocking_lock.transactionid is not distinct from waiting_lock.transactionid
 and blocking_lock.classid is not distinct from waiting_lock.classid
 and blocking_lock.objid is not distinct from waiting_lock.objid
 and blocking_lock.objsubid is not distinct from waiting_lock.objsubid
 and blocking_lock.pid <> waiting_lock.pid
 and blocking_lock.granted
join pg_stat_activity blocking
  on blocking.pid = blocking_lock.pid
where waiting.datname = current_database();

-- Row/table locks on catalog and overlay tables.
select
  l.pid,
  l.locktype,
  l.mode,
  l.granted,
  c.relname,
  a.state,
  a.wait_event,
  left(a.query, 160) as query_prefix
from pg_locks l
left join pg_class c on c.oid = l.relation
left join pg_stat_activity a on a.pid = l.pid
where c.relname in ('players', 'player_reviews', 'player_review_revisions', 'admins')
   or (l.locktype in ('transactionid', 'virtualxid') and a.datname = current_database())
order by l.granted, l.pid;

-- Overlay leftovers on synthetic players (public columns only).
select
  p.id,
  p.availability,
  r.active as review_active,
  r.check_status,
  r.head_revision_id,
  r.checked_at,
  (select count(*) from public.player_review_revisions h where h.player_id = p.id) as revision_count
from public.players p
left join public.player_reviews r on r.player_id = p.id
where p.id in ('9900001', '9900002', '9900003', '9900004', '9900005')
order by p.id;
