import type { createClient } from "@/lib/supabase/server";
import { roundUpToTens } from "@/lib/utils/finance";
import type { Debt, DebtPayment, Loan, LoanCollection } from "@/types/database";

type SupabaseClient = ReturnType<typeof createClient>;

export type LedgerResult<T> =
  | { ok: true; data: T; error?: undefined; status?: undefined }
  | { ok: false; data?: undefined; error: string; status?: number };

interface ApplyLoanCollectionParams {
  collectedAmount?: number | null;
  collectionDate?: string | null;
  note?: string | null;
}

interface ApplyLoanWithdrawalParams {
  amount: number;
  note?: string | null;
}

interface ApplyDebtPaymentParams {
  amount: number;
  paymentDate?: string | null;
  notes?: string | null;
}

/**
 * Records a loan collection (an installment collected from a borrower) and
 * updates the loan's remaining balance + borrower savings balance.
 */
export async function applyLoanCollection(
  supabase: SupabaseClient,
  userId: string,
  loanId: string,
  { collectedAmount, collectionDate, note }: ApplyLoanCollectionParams = {}
): Promise<LedgerResult<{ collection: LoanCollection; loan: Loan }>> {
  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .select("*")
    .eq("id", loanId)
    .single();

  if (loanError || !loan) return { ok: false, error: "Loan not found", status: 404 };

  const installment = Number(loan.repayment_amount);
  const collected =
    collectedAmount !== undefined && collectedAmount !== null
      ? Number(collectedAmount)
      : roundUpToTens(installment);
  const savingsDelta = collected - installment;

  const { data: collection, error: insertError } = await supabase
    .from("loan_collections")
    .insert({
      user_id: userId,
      loan_id: loanId,
      kind: "collection",
      collection_date: collectionDate ?? undefined,
      installment_amount: installment,
      collected_amount: collected,
      savings_delta: savingsDelta,
      note: note ?? null,
    })
    .select()
    .single();

  if (insertError) return { ok: false, error: insertError.message };

  const newRemainingBalance = Math.max(0, Number(loan.remaining_balance) - installment);
  const newSavingsBalance = Number(loan.savings_balance) + savingsDelta;

  const { data: updatedLoan, error: updateError } = await supabase
    .from("loans")
    .update({
      remaining_balance: newRemainingBalance,
      savings_balance: newSavingsBalance,
    })
    .eq("id", loanId)
    .select()
    .single();

  if (updateError) return { ok: false, error: updateError.message };

  return { ok: true, data: { collection, loan: updatedLoan } };
}

/**
 * Records a withdrawal from a borrower's accumulated savings balance and
 * decrements that balance (never below zero).
 */
export async function applyLoanWithdrawal(
  supabase: SupabaseClient,
  userId: string,
  loanId: string,
  { amount, note }: ApplyLoanWithdrawalParams
): Promise<LedgerResult<{ collection: LoanCollection; loan: Loan }>> {
  if (!amount || amount <= 0) {
    return { ok: false, error: "Amount is required for a withdrawal" };
  }

  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .select("*")
    .eq("id", loanId)
    .single();

  if (loanError || !loan) return { ok: false, error: "Loan not found", status: 404 };

  const { data: collection, error: insertError } = await supabase
    .from("loan_collections")
    .insert({
      user_id: userId,
      loan_id: loanId,
      kind: "withdrawal",
      installment_amount: 0,
      collected_amount: 0,
      savings_delta: -amount,
      note: note ?? null,
    })
    .select()
    .single();

  if (insertError) return { ok: false, error: insertError.message };

  const newSavingsBalance = Math.max(0, Number(loan.savings_balance) - amount);

  const { data: updatedLoan, error: updateError } = await supabase
    .from("loans")
    .update({ savings_balance: newSavingsBalance })
    .eq("id", loanId)
    .select()
    .single();

  if (updateError) return { ok: false, error: updateError.message };

  return { ok: true, data: { collection, loan: updatedLoan } };
}

/**
 * Records a debt payment and reduces the debt's outstanding balance (never
 * below zero).
 */
export async function applyDebtPayment(
  supabase: SupabaseClient,
  userId: string,
  debtId: string,
  { amount, paymentDate, notes }: ApplyDebtPaymentParams
): Promise<LedgerResult<{ payment: DebtPayment; debt: Debt }>> {
  if (!amount || amount <= 0) {
    return { ok: false, error: "Amount is required for a debt payment" };
  }

  const { data: debt, error: debtError } = await supabase
    .from("debts")
    .select("*")
    .eq("id", debtId)
    .single();

  if (debtError || !debt) return { ok: false, error: "Debt not found", status: 404 };

  const { data: payment, error: insertError } = await supabase
    .from("debt_payments")
    .insert({
      user_id: userId,
      debt_id: debtId,
      amount,
      payment_date: paymentDate || new Date().toISOString().split("T")[0],
      notes: notes ?? null,
    })
    .select("*, debts(name)")
    .single();

  if (insertError) return { ok: false, error: insertError.message };

  // NOTE: the DB trigger `debt_payments_balance_trigger` (see SUPABASE_SETUP.sql)
  // already decrements debts.balance on INSERT. Do NOT subtract again here or the
  // payment is double-counted. Re-fetch to return the trigger-updated balance.
  const { data: updatedDebt, error: refetchError } = await supabase
    .from("debts")
    .select("*")
    .eq("id", debtId)
    .single();

  if (refetchError || !updatedDebt) {
    return { ok: false, error: refetchError?.message ?? "Debt not found", status: 404 };
  }

  return { ok: true, data: { payment, debt: updatedDebt } };
}
