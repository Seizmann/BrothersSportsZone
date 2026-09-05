-- 0002_create_booking_rpc.sql — atomic booking creation
-- Inserts bookings + booking_payments in one transaction (DECISION.md D-001:
-- financial columns are isolated in booking_payments, whose RLS blocks all
-- non-staff roles. security definer lets this function write the payment row;
-- the auth.uid() guard inside prevents booking on behalf of another user).

begin;

create or replace function public.create_booking(
  p_user_id         uuid,
  p_turf_id         uuid,
  p_slot_date       date,
  p_slot_time       time,
  p_customer_name   text,
  p_customer_phone  text,
  p_team_name       text,
  p_booking_cost    numeric
)
returns json
language plpgsql
security definer
set search_path = public
as $$
declare
  v_booking_id uuid;
  v_result     json;
begin
  -- Caller may only book as themselves.
  if auth.uid() is null or auth.uid() != p_user_id then
    raise exception 'Cannot book on behalf of another user' using errcode = 'P0001';
  end if;

  -- Friendly conflict check; concurrent races are stopped by the partial
  -- unique index below (surfaces as the same 23505 code).
  if exists (
    select 1 from public.bookings
    where turf_id  = p_turf_id
      and slot_date = p_slot_date
      and slot_time = p_slot_time
      and status not in ('cancelled', 'no_show')
  ) then
    raise exception 'Slot is already booked' using errcode = '23505';
  end if;

  insert into public.bookings (
    user_id, turf_id, slot_date, slot_time,
    customer_name, customer_phone, team_name,
    booking_cost, status
  )
  values (
    p_user_id, p_turf_id, p_slot_date, p_slot_time,
    p_customer_name, p_customer_phone, p_team_name,
    p_booking_cost, 'pending'
  )
  returning id into v_booking_id;

  -- Manual payment model (REQUIREMENT.md §4.2): nothing paid yet, full cost due.
  insert into public.booking_payments (
    booking_id, paid_amount, due_amount, discount_amount
  )
  values (
    v_booking_id, 0, p_booking_cost, 0
  );

  select row_to_json(r) into v_result
  from (
    select
      b.id, b.slot_date, b.slot_time, b.customer_name,
      b.customer_phone, b.team_name, b.booking_cost, b.status, b.created_at
    from public.bookings b
    where b.id = v_booking_id
  ) r;

  return v_result;
end;
$$;

-- Enforce slot uniqueness at the DB level: cancelled/no_show bookings release
-- their slot back to the pool.
create unique index if not exists bookings_slot_unique
  on public.bookings (turf_id, slot_date, slot_time)
  where status not in ('cancelled', 'no_show');

revoke execute on function public.create_booking(uuid, uuid, date, time, text, text, text, numeric) from anon;
grant execute on function public.create_booking(uuid, uuid, date, time, text, text, text, numeric) to authenticated;

commit;
