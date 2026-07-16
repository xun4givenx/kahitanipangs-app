import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { applyDebtPayment, applyLoanCollection } from "@/lib/server/ledger";

export async function GET(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const accountId = searchParams.get("account_id");

  let query = auth.supabase
    .from("transactions")
    .select("*, accounts(name, color), categories(name, color)")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (accountId) query = query.eq("account_id", accountId);

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);
  return jsonOk(data);
}

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const { account_id, category_id, amount, type, description, notes, date, loan_id, debt_id } = body;

  if (!account_id || !amount || !type) {
    return jsonError("Account, amount, and type are required");
  }

  const transactionDate = date || new Date().toISOString().split("T")[0];

  const { data, error } = await auth.supabase
    .from("transactions")
    .insert({
      user_id: auth.user.id,
      account_id,
      category_id,
      amount,
      type,
      description: description || "",
      notes,
      date: transactionDate,
      loan_id: loan_id ?? null,
      debt_id: debt_id ?? null,
    })
    .select("*, accounts(name), categories(name)")
    .single();

  if (error) return jsonError(error.message, 500);

  let linkedLoan = null;
  let linkedDebt = null;

  if (loan_id && type === "income") {
    const result = await applyLoanCollection(auth.supabase, auth.user.id, loan_id, {
      collectedAmount: Number(amount),
      collectionDate: transactionDate,
    });

    if (!result.ok) return jsonError(result.error, result.status ?? 500);
    linkedLoan = result.data.loan;
  }

  if (debt_id && type === "expense") {
    const result = await applyDebtPayment(auth.supabase, auth.user.id, debt_id, {
      amount: Number(amount),
      paymentDate: transactionDate,
      notes,
    });

    if (!result.ok) return jsonError(result.error, result.status ?? 500);
    linkedDebt = result.data.debt;
  }

  return jsonOk({ ...data, loan: linkedLoan, debt: linkedDebt }, 201);
}
