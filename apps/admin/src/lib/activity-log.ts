import type { SupabaseClient } from "@supabase/supabase-js";

// Centralised activity_log append (§4.6 audit trail). Two sequential calls —
// staff-id lookup then insert — because PostgREST offers no transaction over
// separate requests; the same non-transactional tradeoff as the payment form
// and settings save. Only the log write can therefore "fail after success" —
// callers surface that as a warning, never roll back the primary write.
//
// Intended also for staff-change logging when the staff management UI lands:
//   logActivity(supabase, userId, {
//     actionType: "staff_updated",
//     resourceType: "staff",
//     resourceId: <staff row id>,
//     details: { before: { role, active_status }, after: { ... } },
//   })
export async function logActivity(
  supabase: SupabaseClient,
  userId: string,
  params: {
    actionType: string;
    resourceType: string;
    resourceId: string;
    details: Record<string, unknown>;
  },
): Promise<{ error: string | null }> {
  const { data: staffRow } = await supabase
    .from("staff")
    .select("id")
    .eq("user_id", userId)
    .maybeSingle();

  const { error } = await supabase.from("activity_log").insert({
    staff_id: staffRow?.id ?? null,
    action_type: params.actionType,
    resource_type: params.resourceType,
    resource_id: params.resourceId,
    details_json: params.details,
  });

  return { error: error ? error.message : null };
}
