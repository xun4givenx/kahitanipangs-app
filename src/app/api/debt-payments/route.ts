import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const debtId = searchParams.get("debt_id");

  let query = auth.supabase
    .from("debt_payments")
    .select("*, debts(name)")
    .order("payment_date", { ascending: false });

  if (debtId) query = query.eq("debt_id", debtId);

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);
  return jsonOk(data);
}

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const { debt_id, amount, payment_date, notes } = body;

  if (!debt_id || !amount) return jsonError("Debt and amount are required");

  const { data, error } = await auth.supabase
    .from("debt_payments")
    .insert({
      user_id: auth.user.id,
      debt_id,
      amount,
      payment_date: payment_date || new Date().toISOString().split("T")[0],
      notes,
    })
    .select("*, debts(name)")
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk(data, 201);
}
