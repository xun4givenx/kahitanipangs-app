import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { listJournalEntries, createJournalEntry } from "@/lib/server/ledger-gl";

export async function GET(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from") ?? undefined;
  const to = searchParams.get("to") ?? undefined;

  const result = await listJournalEntries(auth.supabase, { from, to });
  if (!result.ok) return jsonError(result.error, result.status ?? 500);
  return jsonOk(result.data);
}

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const result = await createJournalEntry(auth.supabase, auth.user.id, body);
  if (!result.ok) return jsonError(result.error, result.status ?? 400);
  return jsonOk(result.data, 201);
}
