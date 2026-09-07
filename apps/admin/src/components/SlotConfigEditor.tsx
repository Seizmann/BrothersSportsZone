import { DAY_NAMES } from "./constants";
import type { DaySlotConfig, SlotConfig } from "@brotherssportszone/shared";

// Time input value ("HH:mm") — <input type="time"> produces exactly this.
interface Props {
  value: SlotConfig;
  onChange: (next: SlotConfig) => void;
}

// Structured editor for site_settings.slot_per_day_json. A default day layout
// plus optional per-day overrides (REQUIREMENT.md §4.2). Produces/consumes the
// SlotConfig shape shared with the booking slot generator — validated with
// slotConfigSchema before save, so typos can't break slot generation.
export function SlotConfigEditor({ value, onChange }: Props) {
  function setDefault(next: DaySlotConfig) {
    onChange({ ...value, default: next });
  }

  function toggleDay(dayKey: string, enabled: boolean) {
    const days = { ...value.days };
    if (enabled) {
      days[dayKey] = { ...value.default }; // seed from default for quick editing
    } else {
      delete days[dayKey];
    }
    onChange({ ...value, days: Object.keys(days).length > 0 ? days : undefined });
  }

  function setDay(dayKey: string, next: DaySlotConfig) {
    onChange({ ...value, days: { ...value.days, [dayKey]: next } });
  }

  return (
    <div className="space-y-4">
      <fieldset className="rounded border p-4">
        <legend className="px-1 text-sm font-medium">Default hours (all days)</legend>
        <DayConfigFields value={value.default} onChange={setDefault} />
      </fieldset>

      <fieldset className="rounded border p-4">
        <legend className="px-1 text-sm font-medium">Per-day overrides</legend>
        <div className="space-y-3">
          {DAY_NAMES.map((name, i) => {
            const key = String(i);
            const override = value.days?.[key];
            return (
              <label key={key} className="flex flex-wrap items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={override !== undefined}
                  onChange={(e) => toggleDay(key, e.target.checked)}
                />
                <span className="w-20">{name}</span>
                {override && (
                  <DayConfigFields
                    value={override}
                    onChange={(next) => setDay(key, next)}
                  />
                )}
              </label>
            );
          })}
        </div>
        <p className="mt-3 text-xs text-neutral-500">
          Unchecked days use the default hours. Overrides apply on top of the default.
        </p>
      </fieldset>
    </div>
  );
}

function DayConfigFields({
  value,
  onChange,
}: {
  value: DaySlotConfig;
  onChange: (next: DaySlotConfig) => void;
}) {
  return (
    <span className="flex flex-wrap items-center gap-3">
      <label className="text-sm">
        Open
        <input
          type="time"
          value={value.open}
          onChange={(e) => onChange({ ...value, open: e.target.value })}
          className="ml-1 rounded border px-2 py-1"
          required
        />
      </label>
      <label className="text-sm">
        Close
        <input
          type="time"
          value={value.close}
          onChange={(e) => onChange({ ...value, close: e.target.value })}
          className="ml-1 rounded border px-2 py-1"
          required
        />
      </label>
      <label className="text-sm">
        Slot length (min)
        <input
          type="number"
          min={15}
          step={5}
          value={value.duration_minutes}
          onChange={(e) =>
            onChange({ ...value, duration_minutes: Number(e.target.value) || 0 })
          }
          className="ml-1 w-24 rounded border px-2 py-1"
          required
        />
      </label>
    </span>
  );
}
