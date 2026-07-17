import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { getAccountRegister } from "@/lib/server/ledger-gl";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const result = await getAccountRegister(auth.supabase, params.id);
  // Account-not-found sets status:404 explicitly; any other (e.g. line-query) failure is a 500.
  if (!result.ok) return jsonError(result.error, result.status ?? 500);
  return jsonOk(result.data);
}
