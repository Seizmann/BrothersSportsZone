"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

// Explicit team creation (§5.5) — the team row exists only after this form
// submits. Logo upload is optional: the key is minted after insert because it
// embeds the new team id.
export function CreateTeamForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const { data: team, error: insertError } = await supabase
        .from("teams")
        .insert({ name, description: description || null })
        .select("id, logo_r2_key")
        .single();
      if (insertError) throw new Error(insertError.message);

      if (logoFile) {
        // Best-effort logo upload after team row exists — team creation
        // succeeds even if R2 is not configured (logo can be added later).
        try {
          const res = await fetch("/api/upload", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ teamId: team.id, contentType: logoFile.type }),
          });
          if (res.ok) {
            const { url, key } = await res.json();
            await fetch(url, { method: "PUT", headers: { "Content-Type": logoFile.type }, body: logoFile });
            await supabase.from("teams").update({ logo_r2_key: key }).eq("id", team.id);
          }
        } catch {
          // Non-fatal — logo falls back to initials.
        }
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create team");
      setSaving(false);
    }
  }

  const supabase = createClient();

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      <h1 className="text-2xl font-semibold">Create your team</h1>
      <p className="text-sm opacity-70">
        You&apos;re eligible to register a team — give it a name and add players once it&apos;s created.
      </p>

      <label className="block">
        <span className="text-sm font-medium">Team name</span>
        <input
          required
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2"
          placeholder="e.g. Brothers FC"
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Description (optional)</span>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          className="mt-1 w-full rounded border px-3 py-2"
          rows={3}
        />
      </label>

      <label className="block">
        <span className="text-sm font-medium">Team logo (optional)</span>
        <input
          type="file"
          accept="image/png,image/jpeg,image/webp"
          onChange={(e) => setLogoFile(e.target.files?.[0] ?? null)}
          className="mt-1 block w-full text-sm"
        />
      </label>

      {error && <p className="text-sm text-red-600">{error}</p>}

      <button
        type="submit"
        disabled={saving}
        className="rounded bg-green-700 px-6 py-2 font-medium text-white hover:bg-green-800 disabled:opacity-50"
      >
        {saving ? "Creating…" : "Create team"}
      </button>
    </form>
  );
}
