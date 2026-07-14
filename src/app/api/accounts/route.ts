import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { data, error } = await auth.supabase
    .from("accounts")
    .select("*")
    .order("name");

  if (error) return jsonError(error.message, 500);
  return jsonOk(data);
}

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const { name, type, balance, currency, color } = body;

  if (!name || !type) return jsonError("Name and type are required");

  const { data, error } = await auth.supabase
    .from("accounts")
    .insert({
      user_id: auth.user.id,
      name,
      type,
      balance: balance ?? 0,
      currency: currency ?? "USD",
      color,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk(data, 201);
}
