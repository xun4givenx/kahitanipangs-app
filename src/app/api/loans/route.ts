import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

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
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk(data, 201);
}
