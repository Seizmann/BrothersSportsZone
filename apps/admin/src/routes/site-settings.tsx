import { useEffect, useState, type FormEvent } from "react";
import {
  pricingRulesSchema,
  slotConfigSchema,
  type PricingRules,
  type SlotConfig,
} from "@brotherssportszone/shared";
import { supabase } from "../lib/supabase";
import { useAuth } from "../lib/auth";
import { SlotConfigEditor } from "../components/SlotConfigEditor";
import { PricingEditor } from "../components/PricingEditor";
import { OwnerDetailsEditor } from "../components/OwnerDetailsEditor";

interface SettingsRow {
  id: string;
  slot_duration_minutes: number;
  slot_per_day_json: SlotConfig;
  pricing_rules_json: PricingRules;
  owner_details_json: Record<string, unknown>;
}

// site_settings is a single-row table (unique index on (true)) — id is stable.
// slot_duration_minutes is kept in sync with slot_per_day_json.default
// .duration_minutes on save; the column predates the per-day config and the
// slot generator only reads the jsonb, but the column is NOT NULL so it must
// stay valid.
export function SiteSettingsPage() {
  const { session } = useAuth();
  const [row, setRow] = useState<SettingsRow | null>(null);
  const [slotConfig, setSlotConfig] = useState<SlotConfig | null>(null);
  const [pricing, setPricing] = useState<PricingRules | null>(null);
  const [ownerDetails, setOwnerDetails] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    (async () => {
      const { data, error } = await supabase.from("site_settings").select("*").limit(1).maybeSingle();
      if (error) {
        setError(error.message);
      } else if (data) {
        const r = data as SettingsRow;
        setRow(r);
        // The single slot_duration_minutes column seeds the default day config.
        setSlotConfig(
          slotConfigSchema.safeParse(r.slot_per_day_json).success
            ? r.slot_per_day_json
            : {
                default: {
                  open: "16:00",
                  close: "23:00",
                  duration_minutes: r.slot_duration_minutes,
                },
              },
        );
        setPricing(
          pricingRulesSchema.safeParse(r.pricing_rules_json).success
            ? r.pricing_rules_json
            : { default_price: 1 },
        );
        setOwnerDetails(r.owner_details_json ?? {});
      }
      setLoading(false);
    })();
  }, []);

  async function handleSave(e: FormEvent) {
    e.preventDefault();
    if (!row || !slotConfig || !pricing) return;
    setError(null);
    setSaved(false);

    // Validate against the shared schemas — same validators the booking
    // endpoint applies. Refuse to save shapes that would break slot
    // generation or cost calculation.
    const slotParsed = slotConfigSchema.safeParse(slotConfig);
    if (!slotParsed.success) {
      setError(`Slot config invalid: ${slotParsed.error.issues[0]?.message}`);
      return;
    }
    const pricingParsed = pricingRulesSchema.safeParse(pricing);
    if (!pricingParsed.success) {
      setError(`Pricing invalid: ${pricingParsed.error.issues[0]?.message}`);
      return;
    }
    if (slotConfig.default.close <= slotConfig.default.open) {
      setError("Default hours: close must be after open.");
      return;
    }

    setSaving(true);
    // site_settings_admin_write RLS permits sudo_admin only; the UI gate in
    // ProtectedRoute mirrors this.
    const { error: updateError } = await supabase
      .from("site_settings")
      .update({
        slot_duration_minutes: slotConfig.default.duration_minutes,
        slot_per_day_json: slotParsed.data,
        pricing_rules_json: pricingParsed.data,
        owner_details_json: ownerDetails,
        updated_at: new Date().toISOString(),
      })
      .eq("id", row.id);

    if (updateError) {
      setSaving(false);
      setError(updateError.message);
      return;
    }

    // Audit trail (REQUIREMENT.md §4.6). staff_id comes from the caller's own
    // staff row; before/after values captured in details_json. Note: the
    // update above has already committed when this runs — if the log write
    // fails the settings change still stands (acceptable for MVP; the two
    // calls can't share a transaction via PostgREST).
    const { data: staffRow } = await supabase
      .from("staff")
      .select("id")
      .eq("user_id", session!.user.id)
      .maybeSingle();

    const { error: logError } = await supabase.from("activity_log").insert({
      staff_id: staffRow?.id ?? null,
      action_type: "site_settings_updated",
      resource_type: "site_settings",
      resource_id: row.id,
      details_json: {
        before: {
          slot_duration_minutes: row.slot_duration_minutes,
          slot_per_day_json: row.slot_per_day_json,
          pricing_rules_json: row.pricing_rules_json,
          owner_details_json: row.owner_details_json,
        },
        after: {
          slot_duration_minutes: slotConfig.default.duration_minutes,
          slot_per_day_json: slotParsed.data,
          pricing_rules_json: pricingParsed.data,
          owner_details_json: ownerDetails,
        },
      },
    });

    setSaving(false);
    if (logError) {
      setError(`Saved, but activity log write failed: ${logError.message}`);
      return;
    }
    setSaved(true);
  }

  if (loading) return <p className="text-neutral-500">Loading…</p>;
  if (!row) return <p className="text-red-700">No site_settings row found. Seed one first.</p>;

  return (
    <div>
      <h1 className="text-2xl font-semibold">Site settings</h1>
      <p className="mt-1 text-sm text-neutral-500">
        Changes apply to new bookings immediately — no redeploy needed.
      </p>

      <form onSubmit={handleSave} className="mt-6 space-y-6">
        {slotConfig && <SlotConfigEditor value={slotConfig} onChange={setSlotConfig} />}
        {pricing && <PricingEditor value={pricing} onChange={setPricing} />}
        <OwnerDetailsEditor value={ownerDetails} onChange={setOwnerDetails} />

        {error && <p className="text-sm text-red-700">{error}</p>}
        {saved && <p className="text-sm text-green-700">Settings saved.</p>}

        <button
          type="submit"
          disabled={saving}
          className="rounded bg-neutral-900 px-6 py-2 text-sm font-medium text-white hover:bg-neutral-700 disabled:opacity-50"
        >
          {saving ? "Saving…" : "Save settings"}
        </button>
      </form>
    </div>
  );
}
