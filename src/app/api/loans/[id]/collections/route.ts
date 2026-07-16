import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { applyLoanCollection, applyLoanWithdrawal } from "@/lib/server/ledger";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { data, error } = await auth.supabase
    .from("loan_collections")
    .select("*")
    .eq("loan_id", params.id)
    .order("created_at", { ascending: false });

  if (error) return jsonError(error.message, 500);
  return jsonOk(data);
}

export async function POST(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const kind = body.kind === "withdrawal" ? "withdrawal" : "collection";

  if (kind === "collection") {
    const result = await applyLoanCollection(auth.supabase, auth.user.id, params.id, {
      collectedAmount: body.collected_amount,
      collectionDate: body.collection_date,
      note: body.note,
    });

    if (!result.ok) return jsonError(result.error, result.status ?? 500);
    return jsonOk(result.data, 201);
  }

  // withdrawal
  const result = await applyLoanWithdrawal(auth.supabase, auth.user.id, params.id, {
    amount: Number(body.amount),
    note: body.note,
  });

  if (!result.ok) return jsonError(result.error, result.status ?? 500);
  return jsonOk(result.data, 201);
}
