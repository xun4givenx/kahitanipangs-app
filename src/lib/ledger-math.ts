import type { LedgerAccountType, NormalBalance, Book } from "@/types/database";

// ---- Pure ledger math (no Supabase; client- and server-safe; unit-tested) ----
// This module MUST NOT import runtime code from `@/lib/server/*` or `@supabase/*`
// so it can be imported into client components as well as server routes.

export interface JournalLineInput {
  ledger_account_id: string;
  debit: number;
  credit: number;
  line_memo?: string | null;
}

const MONEY_EPSILON = 0.005;

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function normalBalanceFor(type: LedgerAccountType): NormalBalance {
  return type === "asset" || type === "expense" ? "debit" : "credit";
}

export function sumDebits(lines: JournalLineInput[]): number {
  return roundMoney(lines.reduce((s, l) => s + Number(l.debit || 0), 0));
}

export function sumCredits(lines: JournalLineInput[]): number {
  return roundMoney(lines.reduce((s, l) => s + Number(l.credit || 0), 0));
}

export function isBalanced(lines: JournalLineInput[]): boolean {
  return Math.abs(sumDebits(lines) - sumCredits(lines)) < MONEY_EPSILON;
}

export function validateLine(
  line: JournalLineInput
): { ok: true } | { ok: false; error: string } {
  const debit = Number(line.debit || 0);
  const credit = Number(line.credit || 0);
  if (debit < 0 || credit < 0) {
    return { ok: false, error: "Line amounts cannot be negative" };
  }
  const debitPos = debit > 0;
  const creditPos = credit > 0;
  if (debitPos && creditPos) {
    return { ok: false, error: "A line cannot have both a debit and a credit" };
  }
  if (!debitPos && !creditPos) {
    return { ok: false, error: "A line must have either a debit or a credit" };
  }
  return { ok: true };
}

export function validatePostedLines(
  lines: JournalLineInput[]
): { ok: true } | { ok: false; error: string } {
  if (lines.length < 2) {
    return { ok: false, error: "A posted entry needs at least 2 lines" };
  }
  for (const line of lines) {
    const res = validateLine(line);
    if (!res.ok) return res;
  }
  if (!isBalanced(lines)) {
    const diff = roundMoney(sumDebits(lines) - sumCredits(lines));
    return { ok: false, error: `Entry is out of balance by ${diff}` };
  }
  return { ok: true };
}

/** Drops lines with neither a debit nor a credit (blank/placeholder rows). */
export function stripEmptyLines(lines: JournalLineInput[]): JournalLineInput[] {
  return lines.filter((l) => Number(l.debit || 0) > 0 || Number(l.credit || 0) > 0);
}

export function computeAccountBalance(
  normal: NormalBalance,
  debitTotal: number,
  creditTotal: number
): number {
  return normal === "debit"
    ? roundMoney(debitTotal - creditTotal)
    : roundMoney(creditTotal - debitTotal);
}

export interface TrialBalanceRow {
  account_id: string;
  code: string;
  name: string;
  type: LedgerAccountType;
  book: Book;
  debit_total: number;
  credit_total: number;
  balance: number;
}

export interface TrialBalance {
  rows: TrialBalanceRow[];
  total_debits: number;
  total_credits: number;
  balanced: boolean;
}

type TbAccount = {
  id: string;
  code: string;
  name: string;
  type: LedgerAccountType;
  book: Book;
  normal_balance: NormalBalance;
};
type TbLine = { ledger_account_id: string; debit: number; credit: number };

export function buildTrialBalance(
  accounts: TbAccount[],
  lines: TbLine[],
  book?: Book
): TrialBalance {
  const scoped = book ? accounts.filter((a) => a.book === book) : accounts;
  const byId = new Map(scoped.map((a) => [a.id, a]));

  const totals = new Map<string, { debit: number; credit: number }>();
  for (const line of lines) {
    if (!byId.has(line.ledger_account_id)) continue;
    const t = totals.get(line.ledger_account_id) ?? { debit: 0, credit: 0 };
    t.debit += Number(line.debit || 0);
    t.credit += Number(line.credit || 0);
    totals.set(line.ledger_account_id, t);
  }

  const rows: TrialBalanceRow[] = scoped.map((a) => {
    const t = totals.get(a.id) ?? { debit: 0, credit: 0 };
    const debit_total = roundMoney(t.debit);
    const credit_total = roundMoney(t.credit);
    return {
      account_id: a.id,
      code: a.code,
      name: a.name,
      type: a.type,
      book: a.book,
      debit_total,
      credit_total,
      balance: computeAccountBalance(a.normal_balance, debit_total, credit_total),
    };
  });

  const total_debits = roundMoney(rows.reduce((s, r) => s + r.debit_total, 0));
  const total_credits = roundMoney(rows.reduce((s, r) => s + r.credit_total, 0));
  return {
    rows,
    total_debits,
    total_credits,
    balanced: Math.abs(total_debits - total_credits) < MONEY_EPSILON,
  };
}

// ---- Default Chart of Accounts template (seeded into BOTH books in Task 3) ----

export const DEFAULT_COA: {
  code: string;
  name: string;
  type: LedgerAccountType;
  subtype?: string;
  parent_code?: string;
}[] = [
  // Assets (1000)
  { code: "1000", name: "Assets", type: "asset" },
  { code: "1100", name: "Current Assets", type: "asset", parent_code: "1000" },
  { code: "1110", name: "Cash on Hand", type: "asset", subtype: "cash", parent_code: "1100" },
  { code: "1120", name: "Bank Accounts", type: "asset", subtype: "bank", parent_code: "1100" },
  { code: "1130", name: "Accounts Receivable", type: "asset", subtype: "receivable", parent_code: "1100" },
  { code: "1140", name: "Loans Receivable", type: "asset", subtype: "receivable", parent_code: "1100" },
  { code: "1150", name: "Cash on Collected Loans", type: "asset", subtype: "cash", parent_code: "1100" },
  { code: "1200", name: "Fixed Assets", type: "asset", parent_code: "1000" },
  { code: "1210", name: "Equipment", type: "asset", parent_code: "1200" },
  { code: "1220", name: "Real Estate", type: "asset", parent_code: "1200" },
  // Liabilities (2000)
  { code: "2000", name: "Liabilities", type: "liability" },
  { code: "2100", name: "Current Liabilities", type: "liability", parent_code: "2000" },
  { code: "2110", name: "Accounts Payable", type: "liability", subtype: "payable", parent_code: "2100" },
  { code: "2120", name: "Taxes Payable", type: "liability", subtype: "payable", parent_code: "2100" },
  { code: "2130", name: "Debts Payable", type: "liability", subtype: "payable", parent_code: "2100" },
  { code: "2140", name: "Borrower Savings Payable", type: "liability", subtype: "payable", parent_code: "2100" },
  { code: "2200", name: "Long-Term Liabilities", type: "liability", parent_code: "2000" },
  { code: "2210", name: "Long-Term Loans", type: "liability", parent_code: "2200" },
  // Equity (3000)
  { code: "3000", name: "Equity", type: "equity" },
  { code: "3100", name: "Owner's Equity", type: "equity", parent_code: "3000" },
  { code: "3200", name: "Owner's Contributions", type: "equity", parent_code: "3000" },
  { code: "3300", name: "Owner's Drawings", type: "equity", parent_code: "3000" },
  { code: "3900", name: "Retained Earnings", type: "equity", parent_code: "3000" },
  // Income (4000)
  { code: "4000", name: "Income", type: "income" },
  { code: "4100", name: "Operating Revenue", type: "income", parent_code: "4000" },
  { code: "4110", name: "Service Income", type: "income", parent_code: "4100" },
  { code: "4120", name: "Interest Income", type: "income", parent_code: "4100" },
  { code: "4200", name: "Other Income", type: "income", parent_code: "4000" },
  // Expenses (5000)
  { code: "5000", name: "Expenses", type: "expense" },
  { code: "5100", name: "Cost of Goods Sold", type: "expense", parent_code: "5000" },
  { code: "5200", name: "Operating Expenses", type: "expense", parent_code: "5000" },
  { code: "5210", name: "Supplies", type: "expense", parent_code: "5200" },
  { code: "5220", name: "Fees & Charges", type: "expense", parent_code: "5200" },
  { code: "5230", name: "Rent Expense", type: "expense", parent_code: "5200" },
  { code: "5240", name: "Tax Expense", type: "expense", parent_code: "5200" },
  { code: "5300", name: "Other Expenses", type: "expense", parent_code: "5000" },
];
