import type { ReactNode } from "react";

interface Props {
  value: Record<string, unknown>;
  onChange: (next: Record<string, unknown>) => void;
  children?: ReactNode;
}

// owner_details_json has no fixed schema (REQUIREMENT.md doesn't define one),
// so this is a generic key/value editor: structured enough to avoid raw-JSON
// typos, flexible enough for whatever branding fields get added later.
// Values stay strings — jsonb accepts them and consumers only read display text.
export function OwnerDetailsEditor({ value, onChange, children }: Props) {
  const entries = Object.entries(value);

  function setEntry(key: string, newValue: string) {
    onChange({ ...value, [key]: newValue });
  }

  function removeEntry(key: string) {
    const next = { ...value };
    delete next[key];
    onChange(next);
  }

  function addEntry() {
    let n = 1;
    while (`field_${n}` in value) n++;
    onChange({ ...value, [`field_${n}`]: "" });
  }

  return (
    <fieldset className="rounded border p-4">
      <legend className="px-1 text-sm font-medium">Owner details</legend>
      <div className="space-y-2">
        {entries.map(([key, val]) => (
          <div key={key} className="flex flex-wrap items-center gap-2 text-sm">
            <input
              value={key}
              onChange={(e) => {
                // Rename in place: rebuild preserving order.
                const next: Record<string, unknown> = {};
                for (const [k, v] of entries) next[k === key ? e.target.value : k] = v;
                onChange(next);
              }}
              className="w-40 rounded border px-2 py-1 font-mono"
              aria-label="Field name"
            />
            <input
              value={String(val ?? "")}
              onChange={(e) => setEntry(key, e.target.value)}
              className="flex-1 rounded border px-2 py-1"
              aria-label="Field value"
            />
            <button
              type="button"
              onClick={() => removeEntry(key)}
              className="text-red-700 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
      </div>
      <button
        type="button"
        onClick={addEntry}
        className="mt-3 text-sm text-green-800 hover:underline"
      >
        + Add field
      </button>
      {children}
    </fieldset>
  );
}
