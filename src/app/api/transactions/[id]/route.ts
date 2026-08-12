import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { data, error } = await auth.supabase
    .from("transactions")
    .select("*, accounts(name), categories(name)")
    .eq("id", params.id)
    .single();

  if (error) return jsonError(error.message, 404);
  return jsonOk(data);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const body = await request.json();

  const { data: existing, error: existingError } = await auth.supabase
    .from("transactions")
    .select("debt_id, loan_id, amount, type, date")
    .eq("id", params.id)
    .single();
  if (existingError || !existing) return jsonError("Transaction not found", 404);
  if (existing.debt_id) return jsonError("Debt payments cannot be edited. Delete and record a corrected payment instead.");

  const requestedLoanId = typeof body.loan_id === "string" && body.loan_id.trim() ? body.loan_id : null;
  const existingAmount = Number(existing.amount);
  const updatedAmount = body.amount === undefined ? existingAmount : Number(body.amount);
  if (!Number.isFinite(updatedAmount) || updatedAmount <= 0) return jsonError("Enter a positive amount");
  const updatedDate = typeof body.date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.date) ? body.date : existing.date;
  if (requestedLoanId && existing.type !== "income") return jsonError("Only cash-in records can be linked to a loan collection");
  if (requestedLoanId && requestedLoanId === existing.loan_id) {
    const { data: linkedLoan, error: linkedLoanError } = await auth.supabase.from("loans").select("remaining_balance").eq("id", requestedLoanId).single();
    if (linkedLoanError || !linkedLoan) return jsonError("The linked loan account is unavailable", 404);
    const adjustedBalance = Number(linkedLoan.remaining_balance) + existingAmount - updatedAmount;
    if (adjustedBalance < 0) return jsonError("Collection cannot exceed the outstanding loan balance");
    const { error: balanceError } = await auth.supabase.from("loans").update({ remaining_balance: adjustedBalance }).eq("id", requestedLoanId);
    if (balanceError) return jsonError(balanceError.message, 500);
    const { error: collectionError } = await auth.supabase.from("loan_collections").update({ collection_date: updatedDate, installment_amount: updatedAmount, collected_amount: updatedAmount }).eq("loan_id", requestedLoanId).like("note", `[cash:${params.id}]%`);
    if (collectionError) return jsonError(collectionError.message, 500);
  }
  if (requestedLoanId !== existing.loan_id) {
    if (existing.loan_id) {
      const { data: previousLoan, error: previousLoanError } = await auth.supabase.from("loans").select("remaining_balance").eq("id", existing.loan_id).single();
      if (previousLoanError || !previousLoan) return jsonError("The current loan account is unavailable", 404);
      const { error: restoreError } = await auth.supabase.from("loans").update({ remaining_balance: Number(previousLoan.remaining_balance) + existingAmount }).eq("id", existing.loan_id);
      if (restoreError) return jsonError(restoreError.message, 500);
      const { error: removeCollectionError } = await auth.supabase.from("loan_collections").delete().eq("loan_id", existing.loan_id).like("note", `[cash:${params.id}]%`);
      if (removeCollectionError) return jsonError(removeCollectionError.message, 500);
    }
    if (requestedLoanId) {
      const { data: nextLoan, error: nextLoanError } = await auth.supabase.from("loans").select("remaining_balance").eq("id", requestedLoanId).single();
      if (nextLoanError || !nextLoan) return jsonError("The selected loan account is unavailable", 404);
      if (updatedAmount > Number(nextLoan.remaining_balance)) return jsonError("Collection cannot exceed the outstanding loan balance");
      const { error: reduceError } = await auth.supabase.from("loans").update({ remaining_balance: Number(nextLoan.remaining_balance) - updatedAmount }).eq("id", requestedLoanId);
      if (reduceError) return jsonError(reduceError.message, 500);
      const { error: collectionError } = await auth.supabase.from("loan_collections").insert({ user_id: auth.user.id, loan_id: requestedLoanId, kind: "collection", collection_date: updatedDate, installment_amount: updatedAmount, collected_amount: updatedAmount, savings_delta: 0, note: `[cash:${params.id}] Reclassified loan collection` });
      if (collectionError) return jsonError(collectionError.message, 500);
    }
  }

  const { data, error } = await auth.supabase
    .from("transactions")
    .update({ ...body, loan_id: requestedLoanId })
    .eq("id", params.id)
    .select("*, accounts(name), categories(name)")
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { data: transaction, error: findError } = await auth.supabase
    .from("transactions")
    .select("id, notes, debt_id, loan_id, amount")
    .eq("id", params.id)
    .single();
  if (findError || !transaction) return jsonError("Transaction not found", 404);

  if (transaction.debt_id) {
    const { error: paymentError } = await auth.supabase
      .from("debt_payments")
      .delete()
      .eq("debt_id", transaction.debt_id)
      .like("notes", `[cash:${transaction.id}]%`);
    if (paymentError) return jsonError(paymentError.message, 500);
  }
  if (transaction.loan_id) {
    const { data: loan } = await auth.supabase.from("loans").select("remaining_balance").eq("id", transaction.loan_id).single();
    if (loan) await auth.supabase.from("loans").update({ remaining_balance: Number(loan.remaining_balance) + Number(transaction.amount) }).eq("id", transaction.loan_id);
    const { error: collectionError } = await auth.supabase.from("loan_collections").delete().eq("loan_id", transaction.loan_id).like("note", `[cash:${transaction.id}]%`);
    if (collectionError) return jsonError(collectionError.message, 500);
  }

  const transferId = transaction.notes?.startsWith("Internal transfer:") ? transaction.notes : null;
  const { error } = transferId
    ? await auth.supabase.from("transactions").delete().eq("notes", transferId)
    : await auth.supabase.from("transactions").delete().eq("id", params.id);

  if (error) return jsonError(error.message, 500);
  return jsonOk({ success: true });
}
