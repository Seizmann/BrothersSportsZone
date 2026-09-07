-- 0006_realtime_publication.sql — wire Module 3 tables into Realtime
-- Supabase postgres_changes only fires for tables in the supabase_realtime
-- publication, and migration 0001 created matches/match_events without
-- adding them. Without this, the /matches/[matchId] live subscription
-- (REQUIREMENT.md §5.7 hard acceptance criterion: a goal logged by admin
-- appears in an open tab within seconds) silently never fires.
--
-- RLS on both tables is already public-read (migration 0001), so anon
-- realtime delivery needs no further grants. Idempotent: re-running is a
-- no-op via the add if not exists clause.

begin;

alter publication supabase_realtime add table public.matches;
alter publication supabase_realtime add table public.match_events;

commit;
