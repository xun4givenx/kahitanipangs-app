import type { createClient } from "@/lib/supabase/server";
import { createJournalEntry } from "@/lib/server/ledger-gl";

type SupabaseClient = ReturnType<typeof createClient>;

/** Resolves an account ID by its preset code (e.g., '1140'). */
async function resolveAccountByCode(supabase: SupabaseClient, userId: string, code: string): Promise<string | null> {
  const { data } = await supabase
    .from("ledger_accounts")
    .select("id")
    .eq("user_id", userId)
    .eq("book", "personal") // We'll default to personal book for loans, or we could look up both. Let's strictly use 'personal' for standard consumer loans.
    .eq("code", code)
    .single();
  return data?.id ?? null;
}

export async function recordLoanDisbursementGL(
  supabase: SupabaseClient,
  userId: string,
  params: {
    loanId: string;
    personName: string;
    startDate: string;
    principalAmount: number;
    amountReleased: number;
    advancedInterestAmount: number;
  }
) {
  // 1140 - Loans Receivable
  // 1150 - Cash on Collected Loans (Using this as the cash source for now, could be dynamic later)
  // 4120 - Interest Income (if advanced interest)
  const loansReceivableId = await resolveAccountByCode(supabase, userId, "1140");
  const cashAccountId = await resolveAccountByCode(supabase, userId, "1150");
  const interestIncomeId = await resolveAccountByCode(supabase, userId, "4120");

  if (!loansReceivableId || !cashAccountId || !interestIncomeId) {
    console.error("Missing required GL accounts for loan disbursement.");
    return { ok: false, error: "Missing GL accounts." };
  }

  const lines = [];

  // Debit: Loans Receivable (Total Principal)
  lines.push({
    ledger_account_id: loansReceivableId,
    debit: params.principalAmount,
    credit: 0,
    line_memo: `Loan principal - ${params.personName}`,
  });

  // Credit: Cash out
  lines.push({
    ledger_account_id: cashAccountId,
    debit: 0,
    credit: params.amountReleased,
    line_memo: `Loan disbursement - ${params.personName}`,
  });

  // Credit: Advanced Interest Income (if any)
  if (params.advancedInterestAmount > 0) {
    lines.push({
      ledger_account_id: interestIncomeId,
      debit: 0,
      credit: params.advancedInterestAmount,
      line_memo: `Upfront interest - ${params.personName}`,
    });
  }

  return await createJournalEntry(supabase, userId, {
    entry_date: params.startDate,
    memo: `Disbursed loan to ${params.personName}`,
    reference: `loan_${params.loanId}`,
    status: "posted",
    lines,
  });
}

export async function recordLoanCollectionGL(
  supabase: SupabaseClient,
  userId: string,
  params: {
    collectionId: string;
    loanId: string;
    personName: string;
    collectionDate: string;
    totalCashCollected: number;
    principalPortion: number;
    interestPortion: number;
    savingsPortion: number;
  }
) {
  // 1150 - Cash on Collected Loans
  // 1140 - Loans Receivable
  // 4120 - Interest Income
  // 2140 - Borrower Savings Payable
  const cashAccountId = await resolveAccountByCode(supabase, userId, "1150");
  const loansReceivableId = await resolveAccountByCode(supabase, userId, "1140");
  const interestIncomeId = await resolveAccountByCode(supabase, userId, "4120");
  const savingsPayableId = await resolveAccountByCode(supabase, userId, "2140");

  if (!cashAccountId || !loansReceivableId || !interestIncomeId || !savingsPayableId) {
    console.error("Missing required GL accounts for loan collection.");
    return { ok: false, error: "Missing GL accounts." };
  }

  const lines = [];

  // Debit: Cash collected
  if (params.totalCashCollected > 0) {
    lines.push({
      ledger_account_id: cashAccountId,
      debit: params.totalCashCollected,
      credit: 0,
      line_memo: `Collection from ${params.personName}`,
    });
  } else {
    // If it's a refund/withdrawal (negative collection)
    lines.push({
      ledger_account_id: cashAccountId,
      debit: 0,
      credit: Math.abs(params.totalCashCollected),
      line_memo: `Refund to ${params.personName}`,
    });
  }

  // Credit: Loans Receivable (Principal paid)
  if (params.principalPortion > 0) {
    lines.push({
      ledger_account_id: loansReceivableId,
      debit: 0,
      credit: params.principalPortion,
      line_memo: `Principal payment - ${params.personName}`,
    });
  }

  // Credit: Interest Income
  if (params.interestPortion > 0) {
    lines.push({
      ledger_account_id: interestIncomeId,
      debit: 0,
      credit: params.interestPortion,
      line_memo: `Interest payment - ${params.personName}`,
    });
  }

  // Credit/Debit: Savings
  if (params.savingsPortion > 0) {
    // Adding to savings
    lines.push({
      ledger_account_id: savingsPayableId,
      debit: 0,
      credit: params.savingsPortion,
      line_memo: `Savings deposit - ${params.personName}`,
    });
  } else if (params.savingsPortion < 0) {
    // Withdrawing from savings
    lines.push({
      ledger_account_id: savingsPayableId,
      debit: Math.abs(params.savingsPortion),
      credit: 0,
      line_memo: `Savings withdrawal - ${params.personName}`,
    });
  }

  return await createJournalEntry(supabase, userId, {
    entry_date: params.collectionDate,
    memo: `Collection for loan ${params.personName}`,
    reference: `col_${params.collectionId}`,
    status: "posted",
    lines,
  });
}
