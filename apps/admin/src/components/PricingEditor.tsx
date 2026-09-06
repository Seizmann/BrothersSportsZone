import { DAY_NAMES } from "./constants";
import type { PricingRules } from "@brotherssportszone/shared";

interface Props {
  value: PricingRules;
  onChange: (next: PricingRules) => void;
}

// Structured editor for site_settings.pricing_rules_json, covering all three
// modes from REQUIREMENT.md §4.2: flat rate, day-wise, and hour-of-day
// (peak/off-peak). Produces/consumes the PricingRules shape shared with
// calculateBookingCost — precedence is hour > day > default.
export function PricingEditor({ value, onChange }: Props) {
  function toggleDay(dayKey: string, enabled: boolean) {
    const day_prices = { ...value.day_prices };
    if (enabled) {
      day_prices[dayKey] = value.default_price; // seed from default
    } else {
      delete day_prices[dayKey];
    }
    onChange({ ...value, day_prices: Object.keys(day_prices).length > 0 ? day_prices : undefined });
  }

  function setDayPrice(dayKey: string, price: number) {
    onChange({ ...value, day_prices: { ...value.day_prices, [dayKey]: price } });
  }

  function setHourPrice(hour: string, price: number) {
    onChange({ ...value, hour_prices: { ...value.hour_prices, [hour]: price } });
  }

  function removeHour(hour: string) {
    const hour_prices = { ...value.hour_prices };
    delete hour_prices[hour];
    onChange({ ...value, hour_prices: Object.keys(hour_prices).length > 0 ? hour_prices : undefined });
  }

  const usedHours = Object.keys(value.hour_prices ?? {});

  return (
    <div className="space-y-4">
      <fieldset className="rounded border p-4">
        <legend className="px-1 text-sm font-medium">Flat rate (per slot)</legend>
        <label className="text-sm">
          Default price (BDT)
          <input
            type="number"
            min={1}
            value={value.default_price}
            onChange={(e) => onChange({ ...value, default_price: Number(e.target.value) || 0 })}
            className="ml-2 w-32 rounded border px-2 py-1"
            required
          />
        </label>
      </fieldset>

      <fieldset className="rounded border p-4">
        <legend className="px-1 text-sm font-medium">Day-wise prices</legend>
        <div className="space-y-2">
          {DAY_NAMES.map((name, i) => {
            const key = String(i);
            const override = value.day_prices?.[key];
            return (
              <label key={key} className="flex items-center gap-3 text-sm">
                <input
                  type="checkbox"
                  checked={override !== undefined}
                  onChange={(e) => toggleDay(key, e.target.checked)}
                />
                <span className="w-20">{name}</span>
                {override !== undefined && (
                  <input
                    type="number"
                    min={1}
                    value={override}
                    onChange={(e) => setDayPrice(key, Number(e.target.value) || 0)}
                    className="w-32 rounded border px-2 py-1"
                  />
                )}
              </label>
            );
          })}
        </div>
      </fieldset>

      <fieldset className="rounded border p-4">
        <legend className="px-1 text-sm font-medium">Peak-hour prices</legend>
        {usedHours.map((hour) => (
          <div key={hour} className="mt-2 flex items-center gap-3 text-sm">
            <span className="w-24">
              {hour.padStart(2, "0")}:00–{hour.padStart(2, "0")}:59
            </span>
            <input
              type="number"
              min={1}
              value={value.hour_prices![hour]}
              onChange={(e) => setHourPrice(hour, Number(e.target.value) || 0)}
              className="w-32 rounded border px-2 py-1"
            />
            <button
              type="button"
              onClick={() => removeHour(hour)}
              className="text-red-700 hover:underline"
            >
              Remove
            </button>
          </div>
        ))}
        <AddHourRow usedHours={usedHours} onAdd={(hour) => setHourPrice(hour, value.default_price)} />
        <p className="mt-3 text-xs text-neutral-500">
          Hour overrides beat day overrides, which beat the flat rate — matches how booking
          costs are resolved.
        </p>
      </fieldset>
    </div>
  );
}

function AddHourRow({ usedHours, onAdd }: { usedHours: string[]; onAdd: (hour: string) => void }) {
  const available = Array.from({ length: 24 }, (_, h) => String(h)).filter(
    (h) => !usedHours.includes(h),
  );
  if (available.length === 0) return null;

  return (
    <label className="mt-3 block text-sm">
      Add hour override
      <select
        value=""
        onChange={(e) => {
          if (e.target.value) onAdd(e.target.value);
        }}
        className="ml-2 rounded border px-2 py-1"
      >
        <option value="">Select hour…</option>
        {available.map((h) => (
          <option key={h} value={h}>
            {h.padStart(2, "0")}:00
          </option>
        ))}
      </select>
    </label>
  );
}
