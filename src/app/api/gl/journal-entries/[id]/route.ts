import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import {
  getJournalEntry,
  updateJournalEntry,
  deleteJournalEntry,
} from "@/lib/server/ledger-gl";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const result = await getJournalEntry(auth.supabase, params.id);
  if (!result.ok) return jsonError(result.error, result.status ?? 404);
  return jsonOk(result.data);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const result = await updateJournalEntry(auth.supabase, params.id, body);
  if (!result.ok) return jsonError(result.error, result.status ?? 400);
  return jsonOk(result.data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const result = await deleteJournalEntry(auth.supabase, params.id);
  if (!result.ok) return jsonError(result.error, result.status ?? 500);
  return jsonOk(result.data);
}
