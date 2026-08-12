import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET(_request: Request, { params }: { params: { id: string } }) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);
  const [loanResult, collectionResult, transactionResult] = await Promise.all([
    auth.supabase.from("loans").select("*").eq("id", params.id).single(),
    auth.supabase.from("loan_collections").select("*").eq("loan_id", params.id).order("collection_date", { ascending: false }),
    auth.supabase.from("transactions").select("*").eq("loan_id", params.id).order("date", { ascending: false }),
  ]);
  if (loanResult.error || !loanResult.data) return jsonError("Loan account not found", 404);
  if (collectionResult.error || transactionResult.error) return jsonError("Could not load loan activity", 500);
  return jsonOk({ loan: loanResult.data, collections: collectionResult.data || [], transactions: transactionResult.data || [] });
}

export async function DELETE(_request: Request, { params }: { params: { id: string } }) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);
  const { error } = await auth.supabase.from("loans").delete().eq("id", params.id);
  if (error) return jsonError(error.message, 500);
  return jsonOk({ success: true });
}
