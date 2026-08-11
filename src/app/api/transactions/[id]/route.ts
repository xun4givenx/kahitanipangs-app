import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { data, error } = await auth.supabase
    .from("transactions")
    .select("*, accounts(name), categories(name)")
    .eq("id", params.id)
    .single();

  if (error) return jsonError(error.message, 404);
  return jsonOk(data);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const body = await request.json();

  const { data: existing, error: existingError } = await auth.supabase
    .from("transactions")
    .select("debt_id")
    .eq("id", params.id)
    .single();
  if (existingError || !existing) return jsonError("Transaction not found", 404);
  if (existing.debt_id) return jsonError("Debt payments cannot be edited. Delete and record a corrected payment instead.");

  const { data, error } = await auth.supabase
    .from("transactions")
    .update(body)
    .eq("id", params.id)
    .select("*, accounts(name), categories(name)")
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { data: transaction, error: findError } = await auth.supabase
    .from("transactions")
    .select("id, notes, debt_id")
    .eq("id", params.id)
    .single();
  if (findError || !transaction) return jsonError("Transaction not found", 404);

  if (transaction.debt_id) {
    const { error: paymentError } = await auth.supabase
      .from("debt_payments")
      .delete()
      .eq("debt_id", transaction.debt_id)
      .like("notes", `[cash:${transaction.id}]%`);
    if (paymentError) return jsonError(paymentError.message, 500);
  }

  const transferId = transaction.notes?.startsWith("Internal transfer:") ? transaction.notes : null;
  const { error } = transferId
    ? await auth.supabase.from("transactions").delete().eq("notes", transferId)
    : await auth.supabase.from("transactions").delete().eq("id", params.id);

  if (error) return jsonError(error.message, 500);
  return jsonOk({ success: true });
}
