-- READ-ONLY. TEST SQL editor only. One result set.
-- Excludes this diagnostic backend. Does not cancel sessions or change data.

select
  a.pid,
  a.usename,
  a.application_name,
  a.state,
  a.wait_event_type,
  a.wait_event,
  round(extract(epoch from (pg_catalog.now() - a.xact_start))::numeric, 1) as xact_seconds,
  round(extract(epoch from (pg_catalog.now() - a.query_start))::numeric, 1) as query_seconds,
  pg_blocking_pids(a.pid) as blocking_pids,
  cardinality(pg_blocking_pids(a.pid)) as blocker_count,
  left(
    regexp_replace(
      regexp_replace(coalesce(a.query, ''), 'bearer[[:space:]]+[A-Za-z0-9._-]+', 'bearer [redacted]', 'gi'),
      'eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+',
      '[jwt]',
      'g'
    ),
    120
  ) as query_prefix
from pg_stat_activity a
where a.datname = current_database()
  and a.pid <> pg_backend_pid()
  and (
    a.state <> 'idle'
    or a.xact_start is not null
    or cardinality(pg_blocking_pids(a.pid)) > 0
  )
order by blocker_count desc, a.xact_start nulls last;
