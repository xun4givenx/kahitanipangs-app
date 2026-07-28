import { getManilaToday } from "@/lib/utils/finance";
import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import {
  applyLoanCollection,
  applyLoanWithdrawal,
  ensureCashCollectionsAccount,
} from "@/lib/server/ledger";
import { recordLoanCollectionGL } from "@/lib/server/gl-integration";

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
    .order("collection_date", { ascending: false })
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
      applyExcessToPrincipal: body.apply_excess_to_principal,
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

    // GL Integration
    const standardPrincipal = loan.total_amount / loan.installments;
    const standardInterest = loan.advanced_interest ? 0 : Number(loan.repayment_amount) - standardPrincipal;
    
    // Scale by how many installments were actually paid (e.g. advanced payments)
    const multiplier = Number(loan.repayment_amount) > 0 
      ? Number(collection.installment_amount) / Number(loan.repayment_amount)
      : 1;

    const principalPortion = standardPrincipal * multiplier;
    const interestPortion = standardInterest * multiplier;

    await recordLoanCollectionGL(auth.supabase, auth.user.id, {
      collectionId: collection.id,
      loanId: loan.id,
      personName: loan.person_name,
      collectionDate: collection.collection_date,
      totalCashCollected: collection.collected_amount,
      principalPortion,
      interestPortion,
      savingsPortion: collection.savings_delta,
    });

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
  const withdrawalDate = getManilaToday();

  const { error: txError } = await auth.supabase.from("transactions").insert({
    user_id: auth.user.id,
    account_id: cashAccountId,
    amount: Number(body.amount),
    type: "expense",
    description: "Savings refund – " + loan.person_name,
    date: withdrawalDate,
    loan_id: params.id,
    collection_id: collection.id,
  });

  if (txError) return jsonError(txError.message, 500);

  // GL Integration for withdrawal
  await recordLoanCollectionGL(auth.supabase, auth.user.id, {
    collectionId: collection.id,
    loanId: loan.id,
    personName: loan.person_name,
    collectionDate: withdrawalDate,
    totalCashCollected: -Number(body.amount), // Negative cash means outflow
    principalPortion: 0,
    interestPortion: 0,
    savingsPortion: -Number(body.amount), // Withdrawing savings
  });

  return jsonOk(result.data, 201);
}
