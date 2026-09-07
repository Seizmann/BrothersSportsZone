import { useEffect, useMemo, useState } from "react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { CURRENCY, TIMEZONE } from "@brotherssportszone/shared";

interface Summary {
  gross: number;
  discounts: number;
  expenses: number;
}

interface DailyExpenseRow {
  expense_date: string;
  category: string;
  amount: number;
  notes: string | null;
  staff: { role: string } | null;
}

interface StaffPerfRow {
  id: string;
  role: string;
  active_status: boolean;
  bookingsHandled: number;
  paymentsConfirmed: number;
  expensesRecorded: number;
  transitionsApplied: number;
}

// Formulas (approved in the phase plan):
//   gross = SUM(bookings.booking_cost), status NOT IN (cancelled, no_show) —
//           revenue committed, not cash-in-hand (paid_amount would conflate
//           collections with sales)
//   net   = gross − SUM(booking_payments.discount_amount)
//   P/L   = net − expenses. Salary tracking is stubbed to 0 for this MVP;
//           the formula gains a salary line once a staff_salaries table lands.
// Belt-and-suspenders: RLS blocks stuff from booking_payments/expenses, and
// this component only fires its queries for sudo_admin/manager.
export function DashboardPage() {
  const { role, session } = useAuth();
  const isFinancialRole = role === "sudo_admin" || role === "manager";

  const monthStart = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
  }, []);
  const monthEnd = useMemo(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth() + 1, 0).toISOString().slice(0, 10);
  }, []);

  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(monthEnd);
  const [summary, setSummary] = useState<Summary | null>(null);
  const [dailyExpenses, setDailyExpenses] = useState<DailyExpenseRow[]>([]);
  const [staffPerf, setStaffPerf] = useState<StaffPerfRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isFinancialRole || !session) return;
    setLoading(true);
    setError(null);
    (async () => {
      // Gross sales over the range, excluding never-happened bookings.
      const { data: bookingsData, error: bookingsError } = await supabase
        .from("bookings")
        .select("id, booking_cost")
        .gte("slot_date", from)
        .lte("slot_date", to)
        .not("status", "in", "(cancelled,no_show)");
      if (bookingsError) {
        setError(bookingsError.message);
        setLoading(false);
        return;
      }

      // Discounts for those bookings; stuff can't read this table but this
      // component never renders for stuff.
      const bookingIds = (bookingsData ?? []).map((b) => b.id as string);
      let discounts = 0;
      if (bookingIds.length > 0) {
        const { data: paymentsData, error: paymentsError } = await supabase
          .from("booking_payments")
          .select("discount_amount")
          .in("booking_id", bookingIds);
        if (paymentsError) {
          setError(paymentsError.message);
          setLoading(false);
          return;
        }
        discounts = (paymentsData ?? []).reduce((sum, p) => sum + Number(p.discount_amount), 0);
      }

      const gross = (bookingsData ?? []).reduce((sum, b) => sum + Number(b.booking_cost), 0);

      const { data: expensesData, error: expensesError } = await supabase
        .from("expenses")
        .select("amount, expense_date, category, notes, staff:staff_id ( role )")
        .gte("expense_date", from)
        .lte("expense_date", to)
        .order("expense_date", { ascending: false });
      if (expensesError) {
        setError(expensesError.message);
        setLoading(false);
        return;
      }

      const totalExpenses = (expensesData ?? []).reduce((sum, e) => sum + Number(e.amount), 0);
      setSummary({ gross, discounts, expenses: totalExpenses });
      setDailyExpenses(
        (expensesData ?? []).map((e) => ({
          expense_date: e.expense_date,
          category: e.category,
          amount: Number(e.amount),
          notes: e.notes,
          staff: e.staff as unknown as { role: string } | null,
        })),
      );

      // Staff-wise performance: purely operational counters (approved plan) —
      // bookings attributed to a staff id, plus audit-log counts. No financial
      // figures per staff member.
      const { data: staffData, error: staffError } = await supabase
        .from("staff")
        .select("id, role, active_status");
      if (staffError) {
        setError(staffError.message);
        setLoading(false);
        return;
      }

      // Bookings handled must be per-staff, so fetch the attribution column
      // (id + staff_id only — no money) and count client-side.
      const { data: attribution, error: attributionError } = await supabase
        .from("bookings")
        .select("staff_id")
        .gte("slot_date", from)
        .lte("slot_date", to);
      if (attributionError) {
        setError(attributionError.message);
        setLoading(false);
        return;
      }

      const { data: logData, error: logError } = await supabase
        .from("activity_log")
        .select("staff_id, action_type")
        .gte("created_at", `${from}T00:00:00Z`)
        .lte("created_at", `${to}T23:59:59Z`);
      if (logError) {
        setError(logError.message);
        setLoading(false);
        return;
      }

      const { data: expenseAttribution, error: expenseAttributionError } = await supabase
        .from("expenses")
        .select("staff_id")
        .gte("expense_date", from)
        .lte("expense_date", to);
      if (expenseAttributionError) {
        setError(expenseAttributionError.message);
        setLoading(false);
        return;
      }

      setStaffPerf(
        (staffData ?? []).map((s) => ({
          id: s.id,
          role: s.role,
          active_status: s.active_status,
          bookingsHandled: (attribution ?? []).filter((a) => a.staff_id === s.id).length,
          paymentsConfirmed: (logData ?? []).filter(
            (l) => l.staff_id === s.id && l.action_type === "payment_updated",
          ).length,
          expensesRecorded: (expenseAttribution ?? []).filter((e) => e.staff_id === s.id).length,
          transitionsApplied: (logData ?? []).filter(
            (l) =>
              l.staff_id === s.id &&
              (l.action_type === "booking_status_updated" || l.action_type === "booking_updated"),
          ).length,
        })),
      );
      setLoading(false);
    })();
  }, [from, to, isFinancialRole, session]);

  if (!isFinancialRole) {
    return (
      <p className="text-sm text-red-700">
        The dashboard is restricted to super admin and manager accounts.
      </p>
    );
  }

  const net = summary ? summary.gross - summary.discounts : 0;
  const profitLoss = summary ? net - summary.expenses : 0;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Dashboard</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Sales, expenses, and staff activity. Times in {TIMEZONE}.
      </p>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <label className="text-sm">
          From
          <input
            type="date"
            value={from}
            onChange={(e) => setFrom(e.target.value)}
            className="mt-1 block rounded border px-2 py-1"
          />
        </label>
        <label className="text-sm">
          To
          <input
            type="date"
            value={to}
            onChange={(e) => setTo(e.target.value)}
            className="mt-1 block rounded border px-2 py-1"
          />
        </label>
      </div>

      {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

      {loading ? (
        <p className="mt-6 text-neutral-500">Loading…</p>
      ) : (
        <>
          <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <SummaryCard label="Gross sales" value={summary?.gross ?? 0} />
            <SummaryCard
              label="Net sales"
              value={net}
              sub={`discounts −${summary?.discounts ?? 0} ${CURRENCY}`}
            />
            <SummaryCard label="Expenses" value={summary?.expenses ?? 0} />
            <SummaryCard
              label={profitLoss >= 0 ? "Profit" : "Loss"}
              value={Math.abs(profitLoss)}
              sub="Salary tracking coming soon (BDT 0 included)"
            />
          </div>

          <h2 className="mt-8 text-lg font-semibold">Expenses in range</h2>
          {dailyExpenses.length === 0 ? (
            <p className="mt-2 text-sm opacity-60">No expenses recorded in this range.</p>
          ) : (
            <table className="mt-2 w-full rounded border bg-white text-sm">
              <thead>
                <tr className="border-b text-left text-neutral-500">
                  <th className="px-3 py-2">Date</th>
                  <th className="px-3 py-2">Category</th>
                  <th className="px-3 py-2">Amount ({CURRENCY})</th>
                  <th className="px-3 py-2">Notes</th>
                  <th className="px-3 py-2">Entered by</th>
                </tr>
              </thead>
              <tbody>
                {dailyExpenses.map((e, i) => (
                  <tr key={i} className="border-b last:border-b-0">
                    <td className="px-3 py-2">{e.expense_date}</td>
                    <td className="px-3 py-2">{e.category}</td>
                    <td className="px-3 py-2">{e.amount}</td>
                    <td className="px-3 py-2">{e.notes ?? "—"}</td>
                    <td className="px-3 py-2">{e.staff?.role ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          <h2 className="mt-8 text-lg font-semibold">Staff performance</h2>
          <table className="mt-2 w-full rounded border bg-white text-sm">
            <thead>
              <tr className="border-b text-left text-neutral-500">
                <th className="px-3 py-2">Staff</th>
                <th className="px-3 py-2">Role</th>
                <th className="px-3 py-2">Bookings handled</th>
                <th className="px-3 py-2">Payments confirmed</th>
                <th className="px-3 py-2">Expenses recorded</th>
                <th className="px-3 py-2">Status changes</th>
              </tr>
            </thead>
            <tbody>
              {staffPerf.map((s) => (
                <tr key={s.id} className="border-b last:border-b-0">
                  <td className="px-3 py-2">
                    {s.id.slice(0, 8)}… {!s.active_status && "(inactive)"}
                  </td>
                  <td className="px-3 py-2">{s.role}</td>
                  <td className="px-3 py-2">{s.bookingsHandled}</td>
                  <td className="px-3 py-2">{s.paymentsConfirmed}</td>
                  <td className="px-3 py-2">{s.expensesRecorded}</td>
                  <td className="px-3 py-2">{s.transitionsApplied}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-2 text-xs text-neutral-400">
            Staff names resolve to a short id for this MVP — staff display names come with the
            staff management UI in a later phase.
          </p>
        </>
      )}
    </div>
  );
}

function SummaryCard({ label, value, sub }: { label: string; value: number; sub?: string }) {
  return (
    <div className="rounded border bg-white p-4">
      <p className="text-sm text-neutral-500">{label}</p>
      <p className="mt-1 text-2xl font-semibold">
        {value.toLocaleString()} {CURRENCY}
      </p>
      {sub && <p className="mt-1 text-xs text-neutral-400">{sub}</p>}
    </div>
  );
}
