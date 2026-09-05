"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface Slot {
  start_time: string;
  duration_minutes: number;
}

// Today in Dhaka (UTC+6) as YYYY-MM-DD. The project timezone is fixed
// (REQUIREMENT.md §3), so no tz config — just the +6 offset applied to UTC.
function todayDhaka(): string {
  const dhaka = new Date(Date.now() + 6 * 60 * 60 * 1000);
  return dhaka.toISOString().slice(0, 10);
}

export default function BookingForm() {
  const router = useRouter();
  const [date, setDate] = useState(todayDhaka());
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [slotTime, setSlotTime] = useState<string | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [teamName, setTeamName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Fetch availability whenever the picked date changes.
  useEffect(() => {
    let cancelled = false;
    setLoadingSlots(true);
    setSlotTime(null);

    fetch(`/api/slots?date=${date}`)
      .then((res) => res.json())
      .then((data) => {
        if (!cancelled) setSlots(data.slots ?? []);
      })
      .catch(() => {
        if (!cancelled) setSlots([]);
      })
      .finally(() => {
        if (!cancelled) setLoadingSlots(false);
      });

    return () => {
      cancelled = true;
    };
  }, [date]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!slotTime) {
      setError("Pick a slot first");
      return;
    }
    setError(null);
    setSubmitting(true);

    const res = await fetch("/api/bookings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        slotDate: date,
        slotTime,
        customerName: name,
        customerPhone: phone,
        teamName: teamName || undefined,
      }),
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      setError(data.error ?? "Booking failed");
      setSubmitting(false);
      // A 409 means availability changed under us — refresh the slot list.
      if (res.status === 409) setSlotTime(null);
      return;
    }

    router.push("/my-bookings");
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="date" className="mb-1 block text-sm font-medium">
          Date
        </label>
        <input
          id="date"
          type="date"
          min={todayDhaka()}
          value={date}
          onChange={(e) => setDate(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
      </div>

      <div>
        <span className="mb-2 block text-sm font-medium">Available slots</span>
        {loadingSlots ? (
          <p className="text-sm opacity-60">Loading…</p>
        ) : slots.length === 0 ? (
          <p className="text-sm opacity-60">No slots available on this date.</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {slots.map((s) => (
              <button
                key={s.start_time}
                type="button"
                onClick={() => setSlotTime(s.start_time)}
                className={`rounded border px-2 py-2 text-sm ${
                  slotTime === s.start_time
                    ? "border-black bg-black text-white"
                    : "hover:bg-neutral-100"
                }`}
              >
                {s.start_time}
              </button>
            ))}
          </div>
        )}
      </div>

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          Your name
        </label>
        <input
          id="name"
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="phone" className="mb-1 block text-sm font-medium">
          Phone
        </label>
        <input
          id="phone"
          type="tel"
          required
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
      </div>

      <div>
        <label htmlFor="team" className="mb-1 block text-sm font-medium">
          Team name <span className="opacity-60">(optional)</span>
        </label>
        <input
          id="team"
          value={teamName}
          onChange={(e) => setTeamName(e.target.value)}
          className="w-full rounded border px-3 py-2"
        />
      </div>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={submitting || loadingSlots}
        className="w-full rounded bg-black px-3 py-2 font-medium text-white disabled:opacity-50"
      >
        {submitting ? "Booking…" : "Confirm booking"}
      </button>
    </form>
  );
}
