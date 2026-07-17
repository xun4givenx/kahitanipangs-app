import type { createClient } from "@/lib/supabase/server";
import { roundUpToTens } from "@/lib/utils/finance";
import type { Debt, DebtPayment, Loan, LoanCollection, LoanCollectionKind } from "@/types/database";

const clamp0 = (n: number) => Math.max(0, n);

/**
 * Pure math for how a loan's app-managed balances change when a collection row
 * is edited or deleted. Kept side-effect-free so it can be unit-tested without
 * Supabase. (The linked transaction's effect on the *account* balance is handled
 * separately by the `transactions_balance_trigger`; this only covers the loan's
 * `remaining_balance` / `savings_balance`, which are updated in application code.)
 *
 * - Edit: `installment_amount` is loan-derived and never changes, so
 *   `remaining_balance` is untouched; only savings moves by the swing in
 *   `savings_delta`.
 * - Delete collection: restore the deducted installment to `remaining_balance`
 *   (capped at `total_amount`) and remove the row's `savings_delta`.
 * - Delete withdrawal: restore the withdrawn amount to savings (its
 *   `savings_delta` is negative); `remaining_balance` untouched.
 */
export function collectionBalanceEffects(
  loan: { remaining_balance: number; savings_balance: number; total_amount: number },
  existing: { kind: LoanCollectionKind; installment_amount: number; savings_delta: number },
  op: { action: "edit"; newSavingsDelta: number } | { action: "delete" }
): { remaining_balance: number; savings_balance: number } {
  if (op.action === "edit") {
    return {
      remaining_balance: loan.remaining_balance,
      savings_balance: clamp0(loan.savings_balance + (op.newSavingsDelta - existing.savings_delta)),
    };
  }
  // delete: reverse this row's effects
  const remaining_balance =
    existing.kind === "collection"
      ? Math.min(loan.total_amount, loan.remaining_balance + existing.installment_amount)
      : loan.remaining_balance;
  return {
    remaining_balance,
    savings_balance: clamp0(loan.savings_balance - existing.savings_delta),
  };
}

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

const CASH_COLLECTIONS_ACCOUNT_NAME = "Cash on Collected Loans";

/**
 * Gets or creates the "Cash on Collected Loans" account for a user, returning
 * its id. Used to deposit collected cash / withdraw savings refunds without
 * requiring the user to pick an account.
 */
export async function ensureCashCollectionsAccount(
  supabase: SupabaseClient,
  userId: string
): Promise<string> {
  const { data: existing } = await supabase
    .from("accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("name", CASH_COLLECTIONS_ACCOUNT_NAME)
    .maybeSingle();

  if (existing) return existing.id;

  const { data: created, error } = await supabase
    .from("accounts")
    .insert({
      user_id: userId,
      name: CASH_COLLECTIONS_ACCOUNT_NAME,
      type: "cash",
      balance: 0,
      currency: "PHP",
      color: "#10b981",
      is_active: true,
    })
    .select("id")
    .single();

  if (error || !created) {
    throw new Error(error?.message ?? "Failed to create Cash on Collected Loans account");
  }

  return created.id;
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

interface EditLoanCollectionParams {
  collectionDate?: string | null;
  collectedAmount?: number | null;
  note?: string | null;
}

/**
 * Edits an existing loan collection (or withdrawal) and keeps the linked
 * transaction + the loan's app-managed balances consistent.
 *
 * - collection: date, collected amount, and note are editable. Changing the
 *   collected amount re-derives `savings_delta` and adjusts `savings_balance`
 *   (installment is loan-derived, so `remaining_balance` is untouched).
 * - withdrawal: amount (passed as `collectedAmount`) and note are editable;
 *   `savings_delta` becomes `-amount` and savings is adjusted by the swing.
 *
 * The linked transaction (found via `collection_id`) has its amount/date updated
 * so the `transactions_balance_trigger` fixes the account balance. Old rows with
 * no linked transaction (pre-migration) skip that step gracefully.
 */
export async function editLoanCollection(
  supabase: SupabaseClient,
  userId: string,
  loanId: string,
  collectionId: string,
  { collectionDate, collectedAmount, note }: EditLoanCollectionParams = {}
): Promise<LedgerResult<{ collection: LoanCollection; loan: Loan }>> {
  const { data: existing, error: existingError } = await supabase
    .from("loan_collections")
    .select("*")
    .eq("id", collectionId)
    .eq("user_id", userId)
    .eq("loan_id", loanId)
    .single();

  if (existingError || !existing) return { ok: false, error: "Collection not found", status: 404 };

  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .select("*")
    .eq("id", loanId)
    .single();

  if (loanError || !loan) return { ok: false, error: "Loan not found", status: 404 };

  const isCollection = existing.kind === "collection";

  // Derive the new amount + savings_delta for whichever kind this is.
  const newAmount =
    collectedAmount !== undefined && collectedAmount !== null
      ? Number(collectedAmount)
      : isCollection
        ? Number(existing.collected_amount)
        : -Number(existing.savings_delta); // withdrawal amount is stored as -savings_delta

  const newSavingsDelta = isCollection
    ? newAmount - Number(existing.installment_amount)
    : -newAmount;

  const { savings_balance } = collectionBalanceEffects(loan, existing, {
    action: "edit",
    newSavingsDelta,
  });

  // Update the collection row.
  const collectionUpdate: Record<string, unknown> = {
    savings_delta: newSavingsDelta,
    note: note !== undefined ? note : existing.note,
  };
  if (isCollection) {
    collectionUpdate.collected_amount = newAmount;
    if (collectionDate) collectionUpdate.collection_date = collectionDate;
  }

  const { data: collection, error: updateCollectionError } = await supabase
    .from("loan_collections")
    .update(collectionUpdate)
    .eq("id", collectionId)
    .select()
    .single();

  if (updateCollectionError) return { ok: false, error: updateCollectionError.message };

  // Update the loan's savings balance (remaining is unchanged on edit).
  const { data: updatedLoan, error: loanUpdateError } = await supabase
    .from("loans")
    .update({ savings_balance })
    .eq("id", loanId)
    .select()
    .single();

  if (loanUpdateError) return { ok: false, error: loanUpdateError.message };

  // Update the linked transaction (amount + date) if one exists.
  const txUpdate: Record<string, unknown> = { amount: newAmount };
  if (isCollection && collectionDate) txUpdate.date = collectionDate;

  const { error: txError } = await supabase
    .from("transactions")
    .update(txUpdate)
    .eq("collection_id", collectionId);

  if (txError) return { ok: false, error: txError.message };

  return { ok: true, data: { collection, loan: updatedLoan } };
}

/**
 * Deletes a loan collection (or withdrawal): removes the linked transaction
 * first (so the account-balance trigger reverses cleanly), reverses the loan's
 * app-managed `remaining_balance` / `savings_balance`, then deletes the row.
 */
export async function deleteLoanCollection(
  supabase: SupabaseClient,
  userId: string,
  loanId: string,
  collectionId: string
): Promise<LedgerResult<{ loan: Loan }>> {
  const { data: existing, error: existingError } = await supabase
    .from("loan_collections")
    .select("*")
    .eq("id", collectionId)
    .eq("user_id", userId)
    .eq("loan_id", loanId)
    .single();

  if (existingError || !existing) return { ok: false, error: "Collection not found", status: 404 };

  const { data: loan, error: loanError } = await supabase
    .from("loans")
    .select("*")
    .eq("id", loanId)
    .single();

  if (loanError || !loan) return { ok: false, error: "Loan not found", status: 404 };

  // Delete the linked transaction first — the trigger reverses the account balance.
  const { error: txError } = await supabase
    .from("transactions")
    .delete()
    .eq("collection_id", collectionId);

  if (txError) return { ok: false, error: txError.message };

  const { remaining_balance, savings_balance } = collectionBalanceEffects(loan, existing, {
    action: "delete",
  });

  const { data: updatedLoan, error: loanUpdateError } = await supabase
    .from("loans")
    .update({ remaining_balance, savings_balance })
    .eq("id", loanId)
    .select()
    .single();

  if (loanUpdateError) return { ok: false, error: loanUpdateError.message };

  const { error: deleteError } = await supabase
    .from("loan_collections")
    .delete()
    .eq("id", collectionId);

  if (deleteError) return { ok: false, error: deleteError.message };

  return { ok: true, data: { loan: updatedLoan } };
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
