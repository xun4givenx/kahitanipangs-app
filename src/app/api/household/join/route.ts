import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);
  const { inviteCode, displayName } = await request.json();
  if (!inviteCode?.trim() || !displayName?.trim()) return jsonError("Household code and display name are required");
  const { data, error } = await auth.supabase.rpc("join_household_with_code", {
    p_invite_code: inviteCode,
    p_display_name: displayName,
  });
  if (error) return jsonError(error.message, 400);
  return jsonOk({ householdId: data });
}
