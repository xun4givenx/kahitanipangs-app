import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { getAccountRegister } from "@/lib/server/ledger-gl";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const result = await getAccountRegister(auth.supabase, params.id);
  if (!result.ok) return jsonError(result.error, result.status ?? 404);
  return jsonOk(result.data);
}
