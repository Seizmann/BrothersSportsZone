import { useState, type FormEvent } from "react";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "../lib/supabase";

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setSubmitting(false);
    if (error) {
      setError(error.message);
      return;
    }
    const from = (location.state as { from?: string } | null)?.from ?? "/";
    navigate(from, { replace: true });
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-green-50 px-4">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-lg border bg-white p-6 shadow-sm"
      >
        <h1 className="text-xl font-semibold text-green-900">BrothersSportsZone Admin</h1>
        <p className="mt-1 text-sm text-neutral-500">Staff sign-in</p>

        <label className="mt-6 block text-sm font-medium">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            className="mt-1 w-full rounded border px-3 py-2 focus:outline-2 focus:outline-green-700"
          />
        </label>

        <label className="mt-4 block text-sm font-medium">
          Password
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
            className="mt-1 w-full rounded border px-3 py-2 focus:outline-2 focus:outline-green-700"
          />
        </label>

        {error && <p className="mt-4 text-sm text-red-700">{error}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="mt-6 w-full rounded bg-green-900 py-2 text-sm font-medium text-white hover:bg-green-800 disabled:opacity-50"
        >
          {submitting ? "Signing in…" : "Sign in"}
        </button>
      </form>
    </main>
  );
}
