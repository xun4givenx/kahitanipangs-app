import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { updateAccount, deactivateAccount } from "@/lib/server/ledger-gl";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const result = await updateAccount(auth.supabase, params.id, body);
  if (!result.ok) return jsonError(result.error, result.status ?? 500);
  return jsonOk(result.data);
}

// Soft-delete: deactivate rather than hard-delete so referenced accounts survive.
export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const result = await deactivateAccount(auth.supabase, params.id);
  if (!result.ok) return jsonError(result.error, result.status ?? 500);
  return jsonOk(result.data);
}
