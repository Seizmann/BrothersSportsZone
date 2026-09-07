import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";
import { TIMEZONE, CURRENCY } from "@brotherssportszone/shared";

export const metadata = { title: "My bookings — BrothersSportsZone" };

// Status badge colors — pending/confirmed active tones, terminal states muted.
const STATUS_STYLES: Record<string, string> = {
  pending: "bg-yellow-100 text-yellow-800",
  confirmed: "bg-blue-100 text-blue-800",
  "checked-in": "bg-green-100 text-green-800",
  completed: "bg-neutral-200 text-neutral-700",
  cancelled: "bg-red-100 text-red-700",
  no_show: "bg-neutral-100 text-neutral-500",
};

export default async function MyBookingsPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const supabase = await createClient();
  // RLS scopes this to the signed-in user's rows automatically.
  const { data: bookings } = await supabase
    .from("bookings")
    .select("id, slot_date, slot_time, customer_name, team_name, booking_cost, status")
    .order("slot_date", { ascending: false })
    .order("slot_time", { ascending: false });

  return (
    <main className="mx-auto max-w-2xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-semibold">My bookings</h1>

      {!bookings || bookings.length === 0 ? (
        <p className="opacity-60">
          No bookings yet.{" "}
          <a href="/book" className="underline">
            Book your first slot
          </a>
          .
        </p>
      ) : (
        <ul className="space-y-3">
          {bookings.map((b) => (
            <li key={b.id} className="rounded border p-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="font-medium">
                    {b.slot_date} at {b.slot_time.slice(0, 5)}
                  </p>
                  <p className="text-sm opacity-70">
                    {b.team_name ?? b.customer_name} · {b.booking_cost} {CURRENCY}
                  </p>
                  <p className="mt-1 text-xs opacity-50">Times in {TIMEZONE}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-medium ${
                    STATUS_STYLES[b.status] ?? "bg-neutral-100"
                  }`}
                >
                  {b.status}
                </span>
              </div>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
