import { useEffect, useState, type FormEvent } from "react";
import { useAuth } from "../lib/auth";
import { supabase } from "../lib/supabase";
import { logActivity } from "../lib/activity-log";
import { CURRENCY, EXPENSE_CATEGORIES } from "@brotherssportszone/shared";

interface ExpenseRow {
  id: string;
  expense_date: string;
  category: string;
  amount: number;
  notes: string | null;
  staff: { role: string } | null;
}

// Expense entry (§4.4): sudo_admin/manager only. The expenses_financial RLS
// policy (migration 0001) already denies stuff every operation on this table —
// the UI gate here mirrors it. Entry writes to activity_log as a create
// (no before/after — nothing existed before the insert). List is append-only
// for this MVP: no edit/delete, matching the audit-log philosophy.
export function ExpensesPage() {
  const { session, role } = useAuth();
  const isFinancialRole = role === "sudo_admin" || role === "manager";

  const today = new Date().toISOString().slice(0, 10);

  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[0]);
  const [date, setDate] = useState(today);
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const [rows, setRows] = useState<ExpenseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [listError, setListError] = useState<string | null>(null);
  const [filterFrom, setFilterFrom] = useState("");
  const [filterTo, setFilterTo] = useState("");
  const [filterCategory, setFilterCategory] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    if (!isFinancialRole || !session) return;
    setLoading(true);
    setListError(null);
    (async () => {
      let query = supabase
        .from("expenses")
        .select("id, expense_date, category, amount, notes, staff:staff_id ( role )")
        .order("expense_date", { ascending: false })
        .limit(200);
      if (filterFrom) query = query.gte("expense_date", filterFrom);
      if (filterTo) query = query.lte("expense_date", filterTo);
      if (filterCategory) query = query.eq("category", filterCategory);

      const { data, error } = await query;
      if (error) {
        setListError(error.message);
      } else {
        setRows(
          (data ?? []).map((e) => ({
            ...e,
            amount: Number(e.amount),
            staff: e.staff as unknown as { role: string } | null,
          })),
        );
      }
      setLoading(false);
    })();
  }, [filterFrom, filterTo, filterCategory, isFinancialRole, session, reloadKey]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setFormError(null);
    setSuccess(false);

    const parsed = Number(amount);
    if (Number.isNaN(parsed) || parsed < 0) {
      setFormError("Amount must be a non-negative number.");
      return;
    }

    setSaving(true);
    const { data, error } = await supabase
      .from("expenses")
      .insert({
        amount: parsed,
        category,
        expense_date: date,
        notes: notes.trim() || null,
      })
      .select("id")
      .single();
    if (error) {
      setSaving(false);
      setFormError(error.message);
      return;
    }

    if (session) {
      const { error: logError } = await logActivity(supabase, session.user.id, {
        actionType: "expense_created",
        resourceType: "expenses",
        resourceId: data.id,
        details: {
          created: { amount: parsed, category, expense_date: date, notes: notes.trim() || null },
        },
      });
      if (logError) {
        setSaving(false);
        setFormError(`Expense saved, but activity log write failed: ${logError}`);
        return;
      }
    }

    setSaving(false);
    setSuccess(true);
    setAmount("");
    setNotes("");
    setReloadKey((k) => k + 1);
  }

  if (!isFinancialRole) {
    return (
      <p className="text-sm text-red-700">
        Expense entry is restricted to super admin and manager accounts.
      </p>
    );
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold">Expenses</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Record daily running costs. Visible to super admin and manager only.
      </p>

      <form onSubmit={handleSubmit} className="mt-4 rounded border bg-white p-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
          <label className="text-sm">
            Amount ({CURRENCY})
            <input
              type="number"
              min={0}
              step="0.01"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1"
              required
            />
          </label>
          <label className="text-sm">
            Category
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1"
            >
              {EXPENSE_CATEGORIES.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </label>
          <label className="text-sm">
            Date
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="mt-1 w-full rounded border px-2 py-1"
              required
            />
          </label>
          <label className="text-sm">
            Notes
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="optional"
              className="mt-1 w-full rounded border px-2 py-1"
            />
          </label>
        </div>
        {formError && <p className="mt-3 text-sm text-red-700">{formError}</p>}
        {success && <p className="mt-3 text-sm text-green-700">Expense recorded.</p>}
        <button
          type="submit"
          disabled={saving}
          className="mt-3 rounded bg-neutral-900 px-4 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Add expense"}
        </button>
      </form>

      <div className="mt-8 flex flex-wrap items-end gap-3">
        <h2 className="text-lg font-semibold">Past expenses</h2>
        <label className="text-sm">
          From
          <input
            type="date"
            value={filterFrom}
            onChange={(e) => setFilterFrom(e.target.value)}
            className="mt-1 block rounded border px-2 py-1"
          />
        </label>
        <label className="text-sm">
          To
          <input
            type="date"
            value={filterTo}
            onChange={(e) => setFilterTo(e.target.value)}
            className="mt-1 block rounded border px-2 py-1"
          />
        </label>
        <label className="text-sm">
          Category
          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="mt-1 block rounded border px-2 py-1"
          >
            <option value="">All</option>
            {EXPENSE_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </label>
      </div>

      {listError && <p className="mt-4 text-sm text-red-700">{listError}</p>}

      {loading ? (
        <p className="mt-4 text-neutral-500">Loading…</p>
      ) : rows.length === 0 ? (
        <p className="mt-4 opacity-60">No expenses match the filters.</p>
      ) : (
        <table className="mt-4 w-full rounded border bg-white text-sm">
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
            {rows.map((e) => (
              <tr key={e.id} className="border-b last:border-b-0">
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
    </div>
  );
}
