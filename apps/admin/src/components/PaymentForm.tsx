import { useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { CURRENCY } from "@brotherssportszone/shared";

export interface BookingRow {
  id: string;
  slot_date: string;
  slot_time: string;
  customer_name: string;
  customer_phone: string;
  team_name: string | null;
  booking_cost: number;
  status: string;
  // Present on listings that need it (bookings page); optional so the
  // payments listing doesn't have to select an unused column.
  cancellation_reason?: string | null;
}

// Role-aware payment marking. The booking list and this form are the only
// shared surface across roles; what differs is the write path:
// - sudo_admin/manager: direct booking_payments update (RLS permits) with
//   full amount entry incl. discount.
// - stuff: mark_payment_received RPC only — a bounded "fully received" flip.
//   Financial amounts are never rendered for stuff (never SELECTed), keeping
//   the "no financial visibility" rule intact in the UI as well as the DB.
export function PaymentForm({
  booking,
  onDone,
}: {
  booking: BookingRow;
  onDone: () => void;
}) {
  const { role } = useAuth();
  const isFinancialRole = role === "sudo_admin" || role === "manager";

  const [note, setNote] = useState("");
  const [paidAmount, setPaidAmount] = useState(String(booking.booking_cost));
  const [dueAmount, setDueAmount] = useState("0");
  const [discountAmount, setDiscountAmount] = useState("0");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleMarkReceived(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    const { error } = await supabase.rpc("mark_payment_received", {
      p_booking_id: booking.id,
      p_payment_method_note: note || null,
    });
    setSaving(false);
    if (error) {
      setError(error.message);
      return;
    }
    onDone();
  }

  async function handleFullUpdate(e: FormEvent) {
    e.preventDefault();
    setError(null);

    const paid = Number(paidAmount);
    const due = Number(dueAmount);
    const discount = Number(discountAmount);
    if (Number.isNaN(paid) || Number.isNaN(due) || Number.isNaN(discount) || paid < 0 || due < 0 || discount < 0) {
      setError("Amounts must be non-negative numbers.");
      return;
    }
    if (paid + due + discount !== booking.booking_cost) {
      setError(
        `paid + due + discount must equal the booking cost (${booking.booking_cost} ${CURRENCY}).`,
      );
      return;
    }

    setSaving(true);
    // Capture before-state for the audit log; RLS permits the read for these
    // two roles. (Sequential calls, not a transaction — same tradeoff as
    // site settings save.)
    const { data: before } = await supabase
      .from("booking_payments")
      .select("paid_amount, due_amount, discount_amount, payment_method_note")
      .eq("booking_id", booking.id)
      .maybeSingle();

    const { error: updateError } = await supabase
      .from("booking_payments")
      .update({
        paid_amount: paid,
        due_amount: due,
        discount_amount: discount,
        payment_method_note: note || before?.payment_method_note || null,
        updated_at: new Date().toISOString(),
      })
      .eq("booking_id", booking.id);

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    const { data: sessionData } = await supabase.auth.getSession();
    const { data: staffRow } = await supabase
      .from("staff")
      .select("id")
      .eq("user_id", sessionData.session!.user.id)
      .maybeSingle();

    const { error: logError } = await supabase.from("activity_log").insert({
      staff_id: staffRow?.id ?? null,
      action_type: "payment_updated",
      resource_type: "booking_payments",
      resource_id: booking.id,
      details_json: {
        before: before ?? {},
        after: {
          paid_amount: paid,
          due_amount: due,
          discount_amount: discount,
          payment_method_note: note || before?.payment_method_note || null,
        },
      },
    });

    setSaving(false);
    if (logError) {
      setError(`Updated, but activity log write failed: ${logError.message}`);
      return;
    }
    onDone();
  }

  return (
    <form
      onSubmit={isFinancialRole ? handleFullUpdate : handleMarkReceived}
      className="rounded-lg border bg-white p-4"
    >
      <h2 className="font-medium">
        {booking.team_name ?? booking.customer_name} · {booking.slot_date} at{" "}
        {booking.slot_time.slice(0, 5)}
      </h2>
      <p className="mt-1 text-sm text-neutral-500">
        Booking cost: {booking.booking_cost} {CURRENCY} · status: {booking.status}
      </p>

      {isFinancialRole ? (
        <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
          <label className="text-sm">
            Paid amount
            <input
              type="number"
              min={0}
              step="0.01"
              value={paidAmount}
              onChange={(e) => setPaidAmount(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1"
              required
            />
          </label>
          <label className="text-sm">
            Due amount
            <input
              type="number"
              min={0}
              step="0.01"
              value={dueAmount}
              onChange={(e) => setDueAmount(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1"
              required
            />
          </label>
          <label className="text-sm">
            Discount amount
            <input
              type="number"
              min={0}
              step="0.01"
              value={discountAmount}
              onChange={(e) => setDiscountAmount(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1"
            />
          </label>
        </div>
      ) : (
        // stuff: amounts are computed server-side by the RPC; nothing
        // financial is shown or entered here.
        <p className="mt-4 text-sm text-neutral-600">
          Mark this booking&apos;s full payment as received. Amounts are recorded
          automatically.
        </p>
      )}

      <label className="mt-3 block text-sm">
        Payment method note (optional)
        <input
          type="text"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          placeholder="e.g. bKash, cash at counter"
          className="mt-1 w-full rounded border px-2 py-1"
        />
      </label>

      {error && <p className="mt-3 text-sm text-red-700">{error}</p>}

      <div className="mt-4 flex gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {saving
            ? "Saving…"
            : isFinancialRole
              ? "Save payment"
              : "Mark as received"}
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
