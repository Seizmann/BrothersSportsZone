import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { logActivity } from "../lib/activity-log";
import {
  CURRENCY,
  allowedTransitions,
  type BookingStatus,
} from "@brotherssportszone/shared";

export interface EditableBooking {
  id: string;
  slot_date: string;
  slot_time: string;
  customer_name: string;
  customer_phone: string;
  team_name: string | null;
  booking_cost: number;
  status: string;
  cancellation_reason?: string | null;
}

// Booking edit for sudo_admin/manager (§4.2/4.3): status transition with the
// shared canTransition guard, manual discount override (same underlying
// booking_payments.discount_amount column the payment form writes — no second
// discount field exists), and customer-detail corrections. stuff never gets
// this modal; the booking_payments wall (D-001) backs the discount part at the
// DB level. Writes are sequential, not transactional — same PostgREST tradeoff
// documented on the payment form and settings save.
export function BookingEditModal({
  booking,
  onDone,
}: {
  booking: EditableBooking;
  onDone: () => void;
}) {
  const { session } = useAuth();
  const transitions = allowedTransitions(booking.status as BookingStatus);

  const [nextStatus, setNextStatus] = useState<string>(booking.status);
  const [cancellationReason, setCancellationReason] = useState(
    booking.cancellation_reason ?? "",
  );
  const [customerName, setCustomerName] = useState(booking.customer_name);
  const [customerPhone, setCustomerPhone] = useState(booking.customer_phone);
  const [teamName, setTeamName] = useState(booking.team_name ?? "");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [currentPaid, setCurrentPaid] = useState<number | null>(null);
  const [currentDue, setCurrentDue] = useState<number | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isTerminal = transitions.length === 0;
  const statusChanged = nextStatus !== booking.status;
  const toTerminal = nextStatus === "cancelled" || nextStatus === "no_show";

  useEffect(() => {
    (async () => {
      const { data } = await supabase
        .from("booking_payments")
        .select("paid_amount, due_amount, discount_amount")
        .eq("booking_id", booking.id)
        .maybeSingle();
      if (data) {
        setCurrentPaid(data.paid_amount);
        setCurrentDue(data.due_amount);
        setDiscountAmount(String(data.discount_amount));
      }
    })();
  }, [booking.id]);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    setError(null);

    if (statusChanged && !transitions.includes(nextStatus as BookingStatus)) {
      setError(`Illegal transition ${booking.status} → ${nextStatus}.`);
      return;
    }
    if (statusChanged && toTerminal && !cancellationReason.trim()) {
      setError("A reason is required when cancelling or marking no_show.");
      return;
    }

    const discount = Number(discountAmount);
    if (Number.isNaN(discount) || discount < 0) {
      setError("Discount must be a non-negative number.");
      return;
    }
    // Same invariant the payment form enforces: paid + due + discount = cost.
    if (
      currentPaid !== null &&
      currentDue !== null &&
      currentPaid + currentDue + discount !== booking.booking_cost
    ) {
      setError(
        `paid (${currentPaid}) + due (${currentDue}) + discount (${discount}) must equal the booking cost (${booking.booking_cost} ${CURRENCY}). Adjust amounts on the Payments page first.`,
      );
      return;
    }

    setSaving(true);

    const bookingBefore = {
      status: booking.status,
      cancellation_reason: booking.cancellation_reason,
      customer_name: booking.customer_name,
      customer_phone: booking.customer_phone,
      team_name: booking.team_name,
    };
    const bookingAfter = {
      status: statusChanged ? nextStatus : booking.status,
      cancellation_reason:
        statusChanged && toTerminal ? cancellationReason.trim() : booking.cancellation_reason,
      customer_name: customerName.trim(),
      customer_phone: customerPhone.trim(),
      team_name: teamName.trim() || null,
    };

    const { error: updateError } = await supabase
      .from("bookings")
      .update(bookingAfter)
      .eq("id", booking.id);
    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    let paymentBefore: Record<string, unknown> = {};
    let paymentAfter: Record<string, unknown> = {};
    const { data: paymentRow } = await supabase
      .from("booking_payments")
      .select("discount_amount")
      .eq("booking_id", booking.id)
      .maybeSingle();
    if (paymentRow && Number(discountAmount) !== Number(paymentRow.discount_amount)) {
      paymentBefore = { discount_amount: paymentRow.discount_amount };
      paymentAfter = { discount_amount: discount };

      const { error: discountError } = await supabase
        .from("booking_payments")
        .update({ discount_amount: discount, updated_at: new Date().toISOString() })
        .eq("booking_id", booking.id);
      if (discountError) {
        setSaving(false);
        setError(discountError.message);
        return;
      }
    }

    if (session) {
      const { error: logError } = await logActivity(supabase, session.user.id, {
        actionType: "booking_updated",
        resourceType: "bookings",
        resourceId: booking.id,
        details: {
          before: { ...bookingBefore, ...paymentBefore },
          after: { ...bookingAfter, ...paymentAfter },
        },
      });
      if (logError) {
        setSaving(false);
        setError(`Saved, but activity log write failed: ${logError}`);
        return;
      }
    }

    setSaving(false);
    onDone();
  }

  return (
    <form onSubmit={handleSave} className="rounded-lg border bg-white p-4">
      <h2 className="font-medium">
        Edit booking · {booking.team_name ?? booking.customer_name} · {booking.slot_date} at{" "}
        {booking.slot_time.slice(0, 5)}
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        Cost: {booking.booking_cost} {CURRENCY} · current status: {booking.status}
      </p>

      <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <label className="text-sm">
          Status
          <select
            value={nextStatus}
            onChange={(e) => setNextStatus(e.target.value)}
            disabled={isTerminal}
            className="mt-1 w-full rounded border px-2 py-1 disabled:bg-neutral-100"
          >
            <option value={booking.status}>{booking.status} (current)</option>
            {transitions.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
          {isTerminal && (
            <span className="mt-1 block text-xs text-neutral-400">
              Terminal status — no further transitions.
            </span>
          )}
        </label>

        <label className="text-sm">
          Discount amount ({CURRENCY})
          <input
            type="number"
            min={0}
            step="0.01"
            value={discountAmount}
            onChange={(e) => setDiscountAmount(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>

        <label className="text-sm">
          Customer name
          <input
            type="text"
            value={customerName}
            onChange={(e) => setCustomerName(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
            required
          />
        </label>
        <label className="text-sm">
          Customer phone
          <input
            type="text"
            value={customerPhone}
            onChange={(e) => setCustomerPhone(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
            required
          />
        </label>
        <label className="text-sm">
          Team name
          <input
            type="text"
            value={teamName}
            onChange={(e) => setTeamName(e.target.value)}
            className="mt-1 w-full rounded border px-2 py-1"
          />
        </label>
      </div>

      {statusChanged && toTerminal && (
        <label className="mt-3 block text-sm">
          Cancellation reason (required)
          <textarea
            value={cancellationReason}
            onChange={(e) => setCancellationReason(e.target.value)}
            rows={2}
            className="mt-1 w-full rounded border px-2 py-1"
            placeholder="e.g. customer requested, pitch waterlogged"
          />
        </label>
      )}

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      <div className="mt-4 flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-green-900 px-4 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save changes"}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="text-sm text-neutral-500 hover:text-neutral-900"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}
