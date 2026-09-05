-- 0003_slot_availability_fn.sql — public slot availability
-- The bookings RLS policy (0001) only lets customers see their own rows and
-- staff see everything. That is correct for privacy, but it breaks the public
-- availability check: an anonymous visitor querying bookings directly sees an
-- empty set, so taken slots would appear free.
-- Fix: expose taken slot times through a security definer function that leaks
-- nothing except "this time is taken" — no customer names, phones, or costs.

begin;

create or replace function public.get_taken_slot_times(
  p_slot_date date
)
returns table (slot_time time)
language sql
security definer
set search_path = public
stable
as $$
  select distinct b.slot_time
  from public.bookings b
  where b.slot_date = p_slot_date
    and b.status not in ('cancelled', 'no_show');
$$;

grant execute on function public.get_taken_slot_times(date) to anon, authenticated;

commit;
