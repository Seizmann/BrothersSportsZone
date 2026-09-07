import { useEffect, useState } from "react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { PaymentForm, type BookingRow } from "../components/PaymentForm";
import { BookingEditModal } from "../components/BookingEditModal";
import { CURRENCY, TIMEZONE, BOOKING_STATUSES, canTransition, type BookingStatus } from "@brotherssportszone/shared";

// Full booking list for all staff (widens /payments' active-only view). The
// write paths stay role-split: stuff gets status changes via the atomic
// update_booking_status RPC (migration 0005) and mark_payment_received;
// sudo_admin/manager get the full edit modal (status + discount + details)
// with sequential activity_log writes. Financial columns are never selected
// here, so stuff stays blind to money.
type Mode = { kind: "none" } | { kind: "payment"; booking: BookingRow } | { kind: "edit"; booking: BookingRow };

export function BookingsPage() {
  const { role, session } = useAuth();
  const isFinancialRole = role === "sudo_admin" || role === "manager";

  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<Mode>({ kind: "none" });
  const [statusFilter, setStatusFilter] = useState("");
  const [rowError, setRowError] = useState<string | null>(null);

  useEffect(() => {
    setLoading(true);
    setError(null);
    (async () => {
      let query = supabase
        .from("bookings")
        .select(
          "id, slot_date, slot_time, customer_name, customer_phone, team_name, booking_cost, status, cancellation_reason",
        )
        .order("slot_date", { ascending: false })
        .order("slot_time", { ascending: true })
        .limit(100);
      if (statusFilter) query = query.eq("status", statusFilter);

      const { data, error } = await query;
      if (error) {
        setError(error.message);
      } else {
        setBookings((data ?? []) as BookingRow[]);
      }
      setLoading(false);
    })();
  }, [statusFilter]);

  async function handleStuffTransition(booking: BookingRow, to: BookingStatus) {
    setRowError(null);
    let reason: string | null = null;
    if (to === "cancelled" || to === "no_show") {
      // The RPC enforces a non-empty reason for terminal side-states; ask
      // inline so staff don't hit a raw DB error.
      reason = window.prompt(`Reason for marking ${to} (required):`);
      if (!reason || !reason.trim()) return;
    }
    const { error } = await supabase.rpc("update_booking_status", {
      p_booking_id: booking.id,
      p_new_status: to,
      p_cancellation_reason: reason,
    });
    if (error) {
      setRowError(error.message);
      return;
    }
    setBookings((prev) =>
      prev.map((b) => (b.id === booking.id ? { ...b, status: to } : b)),
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Bookings</h1>
      <p className="mt-1 text-sm text-neutral-500">
        All bookings, newest date first. Times in {TIMEZONE}.
      </p>

      <label className="mt-4 block text-sm">
        Filter by status
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="mt-1 block rounded border px-2 py-1"
        >
          <option value="">All</option>
          {BOOKING_STATUSES.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      </label>

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}
      {rowError && <p className="mt-4 text-sm text-red-700">{rowError}</p>}

      {mode.kind === "payment" ? (
        <div className="mt-6">
          <PaymentForm booking={mode.booking} onDone={() => setMode({ kind: "none" })} />
        </div>
      ) : mode.kind === "edit" ? (
        <div className="mt-6">
          <BookingEditModal booking={mode.booking} onDone={() => setMode({ kind: "none" })} />
        </div>
      ) : loading ? (
        <p className="mt-6 text-neutral-500">Loading…</p>
      ) : bookings.length === 0 ? (
        <p className="mt-6 opacity-60">No bookings match the filter.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {bookings.map((b) => {
            const transitions = BOOKING_STATUSES.filter(
              (s) => s !== b.status && canTransition(b.status as BookingStatus, s),
            );
            return (
              <li
                key={b.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded border bg-white p-4"
              >
                <div>
                  <p className="font-medium">
                    {b.team_name ?? b.customer_name} · {b.slot_date} at {b.slot_time.slice(0, 5)}
                  </p>
                  <p className="text-sm text-neutral-500">
                    {b.customer_name} · {b.customer_phone} · {b.booking_cost} {CURRENCY} ·{" "}
                    {b.status}
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  {transitions.length > 0 && (
                    <select
                      value=""
                      onChange={(e) => {
                        if (e.target.value) handleStuffTransition(b, e.target.value as BookingStatus);
                      }}
                      className="rounded border px-2 py-1.5 text-sm"
                    >
                      <option value="">Set status…</option>
                      {transitions.map((s) => (
                        <option key={s} value={s}>
                          {s}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    onClick={() => setMode({ kind: "payment", booking: b })}
                    className="rounded border px-4 py-2 text-sm font-medium hover:bg-neutral-100"
                  >
                    Mark payment
                  </button>
                  {isFinancialRole && (
                    <button
                      onClick={() => setMode({ kind: "edit", booking: b })}
                      className="rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700"
                    >
                      Edit booking
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {session && !isFinancialRole && (
        <p className="mt-6 text-xs text-neutral-400">
          Status changes go through an audited RPC; payments are marked as fully received.
          Editing booking details, discounts, and expenses are manager actions.
        </p>
      )}
    </div>
  );
}
