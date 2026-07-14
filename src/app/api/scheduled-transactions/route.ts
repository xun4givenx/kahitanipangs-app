import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { data, error } = await auth.supabase
    .from("scheduled_transactions")
    .select("*, accounts(name), categories(name)")
    .order("next_occurrence");

  if (error) return jsonError(error.message, 500);
  return jsonOk(data);
}

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const {
    account_id, category_id, amount, type, description,
    frequency, start_date, end_date,
  } = body;

  if (!account_id || !amount || !type || !frequency || !start_date) {
    return jsonError("Missing required fields");
  }

  const { data, error } = await auth.supabase
    .from("scheduled_transactions")
    .insert({
      user_id: auth.user.id,
      account_id,
      category_id,
      amount,
      type,
      description: description || "",
      frequency,
      start_date,
      end_date,
      next_occurrence: start_date,
    })
    .select("*, accounts(name), categories(name)")
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk(data, 201);
}
