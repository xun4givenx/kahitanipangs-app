import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import {
  applyLoanCollection,
  applyLoanWithdrawal,
  ensureCashCollectionsAccount,
} from "@/lib/server/ledger";

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

    const { collection, loan } = result.data;
    const cashAccountId = await ensureCashCollectionsAccount(auth.supabase, auth.user.id);

    const { error: txError } = await auth.supabase.from("transactions").insert({
      user_id: auth.user.id,
      account_id: cashAccountId,
      amount: collection.collected_amount,
      type: "income",
      description: "Loan collection – " + loan.person_name,
      date: collection.collection_date,
      loan_id: params.id,
      collection_id: collection.id,
    });

    if (txError) return jsonError(txError.message, 500);

    return jsonOk(result.data, 201);
  }

  // withdrawal
  const result = await applyLoanWithdrawal(auth.supabase, auth.user.id, params.id, {
    amount: Number(body.amount),
    note: body.note,
  });

  if (!result.ok) return jsonError(result.error, result.status ?? 500);

  const { collection, loan } = result.data;
  const cashAccountId = await ensureCashCollectionsAccount(auth.supabase, auth.user.id);

  const { error: txError } = await auth.supabase.from("transactions").insert({
    user_id: auth.user.id,
    account_id: cashAccountId,
    amount: Number(body.amount),
    type: "expense",
    description: "Savings refund – " + loan.person_name,
    date: new Date().toISOString().split("T")[0],
    loan_id: params.id,
    collection_id: collection.id,
  });

  if (txError) return jsonError(txError.message, 500);

  return jsonOk(result.data, 201);
}
