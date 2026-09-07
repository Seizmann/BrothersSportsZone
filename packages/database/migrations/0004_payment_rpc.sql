-- 0004_payment_rpc.sql — staff payment confirmation RPC
-- REQUIREMENT.md §4.3 lets Staff ("stuff") confirm manual payments, but
-- booking_payments is hard-walled to sudo_admin/manager at the RLS level
-- (DECISION.md D-001). This security-definer RPC closes that gap without
-- widening the wall: Staff get a bounded "mark fully received" action — no
-- amount entry, no discount, and the financial columns are never returned
-- to the caller. The activity_log write is atomic with the update (D-002:
-- append-only audit trail).

begin;

create or replace function public.mark_payment_received(
  p_booking_id          uuid,
  p_payment_method_note text default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_staff_id uuid;
  v_before   jsonb;
begin
  -- Any active staff member may call this; non-staff are rejected.
  if public.current_staff_role() is null then
    raise exception 'Not authorized' using errcode = 'P0001';
  end if;

  select id into v_staff_id from public.staff where user_id = auth.uid() and active_status;

  select jsonb_build_object(
    'paid_amount', paid_amount,
    'due_amount',  due_amount
  ) into v_before
  from public.booking_payments
  where booking_id = p_booking_id;

  if v_before is null then
    raise exception 'Payment row not found' using errcode = 'P0002';
  end if;

  -- Bounded action: move the outstanding due into paid. Amounts are computed
  -- server-side; the caller can never set them directly.
  update public.booking_payments
  set
    paid_amount         = paid_amount + due_amount,
    due_amount          = 0,
    payment_method_note = coalesce(p_payment_method_note, payment_method_note),
    updated_at          = now()
  where booking_id = p_booking_id;

  insert into public.activity_log (staff_id, action_type, resource_type, resource_id, details_json)
  values (
    v_staff_id,
    'payment_updated',
    'booking_payments',
    p_booking_id::text,
    jsonb_build_object('before', v_before, 'action', 'mark_received', 'note', p_payment_method_note)
  );
end;
$$;

revoke execute on function public.mark_payment_received(uuid, text) from anon, public;
grant execute on function public.mark_payment_received(uuid, text) to authenticated;

commit;
