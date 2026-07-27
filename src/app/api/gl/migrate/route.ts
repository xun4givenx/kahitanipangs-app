import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import {
  recordLoanDisbursementGL,
  recordLoanCollectionGL,
  recordTransactionGL,
  recordDebtCreationGL,
  recordDebtPaymentGL,
} from "@/lib/server/gl-integration";

export async function POST() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const supabase = auth.supabase;
  const userId = auth.user.id;

  // 1. Wipe all existing journal entries to start fresh
  const { error: deleteError } = await supabase
    .from("journal_entries")
    .delete()
    .eq("user_id", userId);

  if (deleteError) {
    return jsonError(`Failed to clear existing journal entries: ${deleteError.message}`, 500);
  }

  // 2. Migrate Loans (Disbursements)
  const { data: loans, error: loansError } = await supabase
    .from("loans")
    .select("*")
    .eq("user_id", userId);

  if (loansError) return jsonError(loansError.message, 500);

  for (const loan of loans) {
    await recordLoanDisbursementGL(supabase, userId, {
      loanId: loan.id,
      personName: loan.person_name,
      startDate: loan.start_date,
      principalAmount: Number(loan.total_amount),
      amountReleased: Number(loan.amount_released),
      advancedInterestAmount: loan.advanced_interest
        ? Number(loan.total_amount) * (Number(loan.interest_rate) / 100)
        : 0,
      fundingSource: loan.funding_source as "reinvested" | "fresh_capital",
    });
  }

  // 3. Migrate Loan Collections & Withdrawals
  const { data: collections, error: colError } = await supabase
    .from("loan_collections")
    .select("*, loans(*)")
    .eq("user_id", userId);

  if (colError) return jsonError(colError.message, 500);

  for (const col of collections) {
    const loan = Array.isArray(col.loans) ? col.loans[0] : col.loans;
    if (!loan) continue;

    if (col.kind === "collection") {
      const principalPortion = loan.total_amount / loan.installments;
      const interestPortion = loan.advanced_interest ? 0 : Number(loan.repayment_amount) - principalPortion;

      await recordLoanCollectionGL(supabase, userId, {
        collectionId: col.id,
        loanId: loan.id,
        personName: loan.person_name,
        collectionDate: col.collection_date || loan.start_date, // fallback to loan start date if missing
        totalCashCollected: Number(col.collected_amount),
        principalPortion,
        interestPortion,
        savingsPortion: Number(col.savings_delta),
      });
    } else if (col.kind === "withdrawal") {
      // Withdrawal
      await recordLoanCollectionGL(supabase, userId, {
        collectionId: col.id,
        loanId: loan.id,
        personName: loan.person_name,
        collectionDate: col.collection_date || loan.start_date,
        totalCashCollected: -Number(Math.abs(col.savings_delta)), // Cash outflow
        principalPortion: 0,
        interestPortion: 0,
        savingsPortion: -Number(Math.abs(col.savings_delta)), // Deducting savings
      });
    }
  }

  // 4. Migrate Debts
  const { data: debts, error: debtsError } = await supabase
    .from("debts")
    .select("*")
    .eq("user_id", userId);

  if (debtsError) return jsonError(debtsError.message, 500);

  for (const debt of debts) {
    await recordDebtCreationGL(supabase, userId, {
      debtId: debt.id,
      name: debt.name,
      date: new Date(debt.created_at).toISOString().split("T")[0],
      amount: Number(debt.original_balance ?? debt.balance), // original_balance is typically the amount
    });
  }

  // 5. Migrate Debt Payments
  const { data: debtPayments, error: dpError } = await supabase
    .from("debt_payments")
    .select("*, debts(name)")
    .eq("user_id", userId);

  if (dpError) return jsonError(dpError.message, 500);

  for (const dp of debtPayments) {
    const debtName = Array.isArray(dp.debts) ? dp.debts[0]?.name : dp.debts?.name;
    await recordDebtPaymentGL(supabase, userId, {
      paymentId: dp.id,
      debtId: dp.debt_id,
      name: debtName || "Unknown Debt",
      date: dp.payment_date,
      amount: Number(dp.amount),
    });
  }

  // 6. Migrate Generic Transactions
  // We only want transactions that are NOT linked to loans or debts (because those are handled above)
  const { data: transactions, error: txError } = await supabase
    .from("transactions")
    .select("*")
    .is("loan_id", null)
    .is("debt_id", null)
    .eq("user_id", userId);

  if (txError) return jsonError(txError.message, 500);

  for (const tx of transactions) {
    await recordTransactionGL(supabase, userId, {
      transactionId: tx.id,
      type: tx.type as "income" | "expense" | "transfer",
      amount: Number(tx.amount),
      date: tx.date,
      description: tx.description || "",
    });
  }

  return jsonOk({ success: true, message: "Migration completed successfully" });
}
