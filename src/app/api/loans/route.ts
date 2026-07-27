import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { recordLoanDisbursementGL } from "@/lib/server/gl-integration";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { data, error } = await auth.supabase
    .from("loans")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) return jsonError(error.message, 500);
  return jsonOk(data);
}

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const {
    person_name,
    total_amount,
    interest_rate,
    start_date,
    frequency,
    installments,
    repayment_amount,
    remaining_balance,
    advanced_interest,
    amount_released,
    funding_source,
  } = body;

  if (!person_name || total_amount === undefined || !start_date || !frequency) {
    return jsonError("Person name, total amount, start date, and frequency are required");
  }

  const { data, error } = await auth.supabase
    .from("loans")
    .insert({
      user_id: auth.user.id,
      person_name,
      total_amount,
      interest_rate: interest_rate ?? 0,
      start_date,
      frequency,
      installments: installments ?? 0,
      repayment_amount: repayment_amount ?? 0,
      remaining_balance: remaining_balance ?? 0,
      advanced_interest: advanced_interest ?? false,
      amount_released: amount_released ?? 0,
      funding_source: funding_source ?? "reinvested",
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);

  // Trigger GL Integration
  const interestTotal = data.total_amount * (data.interest_rate / 100);
  await recordLoanDisbursementGL(auth.supabase, auth.user.id, {
    loanId: data.id,
    personName: data.person_name,
    startDate: data.start_date,
    principalAmount: data.total_amount,
    amountReleased: data.amount_released,
    advancedInterestAmount: data.advanced_interest ? interestTotal : 0,
  });

  return jsonOk(data, 201);
}
