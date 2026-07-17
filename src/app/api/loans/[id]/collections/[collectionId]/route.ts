import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { deleteLoanCollection, editLoanCollection } from "@/lib/server/ledger";

export async function PATCH(
  request: Request,
  { params }: { params: { id: string; collectionId: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const body = await request.json();

  const result = await editLoanCollection(
    auth.supabase,
    auth.user.id,
    params.id,
    params.collectionId,
    {
      collectionDate: body.collection_date,
      collectedAmount: body.collected_amount,
      note: body.note,
    }
  );

  if (!result.ok) return jsonError(result.error, result.status ?? 500);
  return jsonOk(result.data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string; collectionId: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const result = await deleteLoanCollection(
    auth.supabase,
    auth.user.id,
    params.id,
    params.collectionId
  );

  if (!result.ok) return jsonError(result.error, result.status ?? 500);
  return jsonOk(result.data);
}
