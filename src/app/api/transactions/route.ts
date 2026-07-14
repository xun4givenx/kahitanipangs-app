import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

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
  const { account_id, category_id, amount, type, description, notes, date } = body;

  if (!account_id || !amount || !type) {
    return jsonError("Account, amount, and type are required");
  }

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
      date: date || new Date().toISOString().split("T")[0],
    })
    .select("*, accounts(name), categories(name)")
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk(data, 201);
}
