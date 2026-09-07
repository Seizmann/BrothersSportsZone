import { useEffect, useState } from "react";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { PaymentForm, type BookingRow } from "../components/PaymentForm";
import { CURRENCY, TIMEZONE } from "@brotherssportszone/shared";

// Payment marking: all staff roles reach this page (REQUIREMENT.md §4.3 —
// Staff may "confirm manual payment"), but the write path differs per role —
// see PaymentForm. The booking list below contains only operational columns
// from `bookings` (readable by all staff via RLS); no financial columns exist
// on bookings, so stuff stays blind to money even here.
export function PaymentsPage() {
  const { role } = useAuth();
  const [bookings, setBookings] = useState<BookingRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<BookingRow | null>(null);

  useEffect(() => {
    (async () => {
      setError(null);
      let query = supabase
        .from("bookings")
        .select(
          "id, slot_date, slot_time, customer_name, customer_phone, team_name, booking_cost, status",
        )
        .in("status", ["pending", "confirmed", "checked-in"])
        .order("slot_date", { ascending: true })
        .order("slot_time", { ascending: true });

      if (search.trim()) {
        query = query.or(
          `customer_name.ilike.%${search.trim()}%,customer_phone.ilike.%${search.trim()}%`,
        );
      }

      const { data, error } = await query.limit(50);
      if (error) {
        setError(error.message);
      } else {
        setBookings((data ?? []) as BookingRow[]);
      }
      setLoading(false);
    })();
  }, [search]);

  return (
    <div>
      <h1 className="text-2xl font-semibold">Payments</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Upcoming active bookings. Times in {TIMEZONE}.
      </p>

      <input
        type="search"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search by customer name or phone…"
        className="mt-4 w-full max-w-md rounded border px-3 py-2"
      />

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      {selected ? (
        <div className="mt-6">
          <PaymentForm booking={selected} onDone={() => setSelected(null)} />
        </div>
      ) : loading ? (
        <p className="mt-6 text-neutral-500">Loading…</p>
      ) : bookings.length === 0 ? (
        <p className="mt-6 opacity-60">No active bookings found.</p>
      ) : (
        <ul className="mt-6 space-y-3">
          {bookings.map((b) => (
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
              <button
                onClick={() => setSelected(b)}
                className="rounded border px-4 py-2 text-sm font-medium hover:bg-neutral-100"
              >
                Mark payment
              </button>
            </li>
          ))}
        </ul>
      )}

      {role === "stuff" && (
        <p className="mt-6 text-xs text-neutral-400">
          Staff can mark payments as fully received. Amount entry, discounts, and
          payment history are handled by managers.
        </p>
      )}
    </div>
  );
}
