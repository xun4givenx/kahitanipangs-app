import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { listAccounts, createAccount } from "@/lib/server/ledger-gl";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const result = await listAccounts(auth.supabase);
  if (!result.ok) return jsonError(result.error, result.status ?? 500);
  return jsonOk(result.data);
}

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const result = await createAccount(auth.supabase, auth.user.id, body);
  if (!result.ok) return jsonError(result.error, result.status ?? 400);
  return jsonOk(result.data, 201);
}
