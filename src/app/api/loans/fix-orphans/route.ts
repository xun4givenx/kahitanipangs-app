import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { data: txs, error: txError } = await auth.supabase
    .from('transactions')
    .select('id, loan_id, description')
    .not('loan_id', 'is', null);

  if (txError) return jsonError(txError.message, 500);

  const { data: loans, error: loanError } = await auth.supabase
    .from('loans')
    .select('id');

  if (loanError) return jsonError(loanError.message, 500);
  
  const validLoanIds = new Set(loans.map(l => l.id));

  const orphaned = txs.filter(tx => !validLoanIds.has(tx.loan_id));

  if (orphaned.length > 0) {
    const orphanedIds = orphaned.map(t => t.id);
    const { error: delError } = await auth.supabase
      .from('transactions')
      .delete()
      .in('id', orphanedIds);
      
    if (delError) return jsonError(delError.message, 500);
  }

  return jsonOk({ deleted: orphaned.length, orphanedIds: orphaned.map(t => t.id) });
}
