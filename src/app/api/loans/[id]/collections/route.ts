import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { roundUpToTens } from "@/lib/utils/finance";

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

  const { data: loan, error: loanError } = await auth.supabase
    .from("loans")
    .select("*")
    .eq("id", params.id)
    .single();

  if (loanError || !loan) return jsonError("Loan not found", 404);

  if (kind === "collection") {
    const installment = Number(loan.repayment_amount);
    const collected =
      body.collected_amount !== undefined && body.collected_amount !== null
        ? Number(body.collected_amount)
        : roundUpToTens(installment);
    const savingsDelta = collected - installment;

    const { data: collection, error: insertError } = await auth.supabase
      .from("loan_collections")
      .insert({
        user_id: auth.user.id,
        loan_id: params.id,
        kind: "collection",
        collection_date: body.collection_date ?? undefined,
        installment_amount: installment,
        collected_amount: collected,
        savings_delta: savingsDelta,
        note: body.note ?? null,
      })
      .select()
      .single();

    if (insertError) return jsonError(insertError.message, 500);

    const newRemainingBalance = Math.max(0, Number(loan.remaining_balance) - installment);
    const newSavingsBalance = Number(loan.savings_balance) + savingsDelta;

    const { data: updatedLoan, error: updateError } = await auth.supabase
      .from("loans")
      .update({
        remaining_balance: newRemainingBalance,
        savings_balance: newSavingsBalance,
      })
      .eq("id", params.id)
      .select()
      .single();

    if (updateError) return jsonError(updateError.message, 500);

    return jsonOk({ collection, loan: updatedLoan }, 201);
  }

  // withdrawal
  const amount = Number(body.amount);
  if (!amount || amount <= 0) {
    return jsonError("Amount is required for a withdrawal");
  }

  const { data: collection, error: insertError } = await auth.supabase
    .from("loan_collections")
    .insert({
      user_id: auth.user.id,
      loan_id: params.id,
      kind: "withdrawal",
      installment_amount: 0,
      collected_amount: 0,
      savings_delta: -amount,
      note: body.note ?? null,
    })
    .select()
    .single();

  if (insertError) return jsonError(insertError.message, 500);

  const newSavingsBalance = Math.max(0, Number(loan.savings_balance) - amount);

  const { data: updatedLoan, error: updateError } = await auth.supabase
    .from("loans")
    .update({ savings_balance: newSavingsBalance })
    .eq("id", params.id)
    .select()
    .single();

  if (updateError) return jsonError(updateError.message, 500);

  return jsonOk({ collection, loan: updatedLoan }, 201);
}
