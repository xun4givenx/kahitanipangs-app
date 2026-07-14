import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

export async function POST(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { data: original, error: fetchError } = await auth.supabase
    .from("transactions")
    .select("*")
    .eq("id", params.id)
    .single();

  if (fetchError || !original) return jsonError("Transaction not found", 404);

  const { data, error } = await auth.supabase
    .from("transactions")
    .insert({
      user_id: auth.user.id,
      account_id: original.account_id,
      category_id: original.category_id,
      amount: original.amount,
      type: original.type,
      description: `${original.description} (copy)`,
      notes: original.notes,
      date: new Date().toISOString().split("T")[0],
    })
    .select("*, accounts(name), categories(name)")
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk(data, 201);
}
