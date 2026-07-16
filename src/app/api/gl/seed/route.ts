import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { seedDefaultCoA } from "@/lib/server/ledger-gl";

export async function POST() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const result = await seedDefaultCoA(auth.supabase, auth.user.id);
  if (!result.ok) return jsonError(result.error, result.status ?? 500);
  return jsonOk(result.data);
}
