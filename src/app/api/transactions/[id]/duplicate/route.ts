import { getManilaToday } from "@/lib/utils/finance";
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
  if (original.debt_id) return jsonError("Debt payments cannot be duplicated. Record a new payment from Cash out instead.");

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
      date: getManilaToday(),
    })
    .select("*, accounts(name), categories(name)")
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk(data, 201);
}
