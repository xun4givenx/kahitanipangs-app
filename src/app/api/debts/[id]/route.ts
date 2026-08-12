import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { error } = await auth.supabase
    .from("debts")
    .delete()
    .eq("id", params.id);
  if (error) return jsonError(error.message, 500);
  return jsonOk({ success: true });
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);
  const [debtResult, paymentResult] = await Promise.all([
    auth.supabase.from("debts").select("*").eq("id", params.id).single(),
    auth.supabase.from("debt_payments").select("*").eq("debt_id", params.id).order("payment_date", { ascending: false }),
  ]);
  if (debtResult.error || !debtResult.data) return jsonError("Debt account not found", 404);
  if (paymentResult.error) return jsonError(paymentResult.error.message, 500);
  return jsonOk({ debt: debtResult.data, payments: paymentResult.data || [] });
}
