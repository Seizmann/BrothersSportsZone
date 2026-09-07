-- 0005_booking_edit_rpc.sql — bounded booking status transition RPC
-- Booking status changes are operational (§4.3 — all staff roles may move a
-- booking through its lifecycle), but the activity_log write must be atomic
-- with the status change (§4.6 full audit trail). Direct PostgREST updates
-- can't do both in one transaction, so stuff transitions go through this
-- security-definer RPC — same pattern as mark_payment_received (0004).
-- sudo_admin/manager keep the direct-update path from the booking edit modal
-- (sequential log write, same documented tradeoff as the payment form).
--
-- The allowed-transition map below mirrors packages/shared/booking-status.ts
-- ACTIVE_PATH. Keep the two in sync.

begin;

create or replace function public.update_booking_status(
  p_booking_id          uuid,
  p_new_status          text,
  p_cancellation_reason text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id        uuid;
  v_current_status  text;
  v_allowed         text[];
begin
  -- Any active staff member may call this; non-staff are rejected.
  if public.current_staff_role() is null then
    raise exception 'Not authorized' using errcode = 'P0001';
  end if;

  select id into v_staff_id from public.staff where user_id = auth.uid() and active_status;

  select status into v_current_status from public.bookings where id = p_booking_id;
  if v_current_status is null then
    raise exception 'Booking not found' using errcode = 'P0002';
  end if;

  -- Mirror of packages/shared/booking-status.ts ACTIVE_PATH
  v_allowed := case v_current_status
    when 'pending'    then array['confirmed', 'cancelled', 'no_show']
    when 'confirmed'  then array['checked-in', 'cancelled', 'no_show']
    when 'checked-in' then array['completed', 'cancelled', 'no_show']
    else array[]::text[]
  end;

  if not (p_new_status = any(v_allowed)) then
    raise exception 'Illegal transition % -> %', v_current_status, p_new_status
      using errcode = 'P0001';
  end if;

  -- §4.6: cancellation carries a mandatory reason
  if p_new_status in ('cancelled', 'no_show') and coalesce(p_cancellation_reason, '') = '' then
    raise exception 'A reason is required when cancelling or marking no_show'
      using errcode = 'P0001';
  end if;

  update public.bookings
  set
    status = p_new_status,
    -- keep any prior reason when moving between non-terminal states
    cancellation_reason = case
      when p_new_status in ('cancelled', 'no_show') then p_cancellation_reason
      else cancellation_reason
    end,
    updated_at = now()
  where id = p_booking_id;

  insert into public.activity_log (staff_id, action_type, resource_type, resource_id, details_json)
  values (
    v_staff_id,
    'booking_status_updated',
    'bookings',
    p_booking_id::text,
    jsonb_build_object(
      'before', jsonb_build_object('status', v_current_status),
      'after',  jsonb_build_object('status', p_new_status, 'cancellation_reason', p_cancellation_reason)
    )
  );
end;
$$;

revoke execute on function public.update_booking_status(uuid, text, text) from anon, public;
grant execute on function public.update_booking_status(uuid, text, text) to authenticated;

commit;
