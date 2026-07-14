import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { data, error } = await auth.supabase
    .from("debts")
    .select("*")
    .order("balance", { ascending: false });

  if (error) return jsonError(error.message, 500);
  return jsonOk(data);
}

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const {
    name, creditor, balance, original_balance,
    interest_rate, minimum_payment, due_day, notes,
  } = body;

  if (!name || balance === undefined) {
    return jsonError("Name and balance are required");
  }

  const { data, error } = await auth.supabase
    .from("debts")
    .insert({
      user_id: auth.user.id,
      name,
      creditor,
      balance,
      original_balance: original_balance ?? balance,
      interest_rate: interest_rate ?? 0,
      minimum_payment: minimum_payment ?? 0,
      due_day,
      notes,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk(data, 201);
}
