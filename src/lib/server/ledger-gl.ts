import type {
  LedgerAccountType,
  NormalBalance,
  Book,
  LedgerAccount,
  JournalStatus,
  JournalEntryWithLines,
} from "@/types/database";
import type { createClient } from "@/lib/supabase/server";
import type { LedgerResult } from "@/lib/server/ledger";

type SupabaseClient = ReturnType<typeof createClient>;

// ---- Pure ledger math (no Supabase; unit-tested) ----

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
}[] = [
  // Assets (1xxx)
  { code: "1000", name: "Cash on Hand", type: "asset", subtype: "cash" },
  { code: "1010", name: "Bank", type: "asset", subtype: "bank" },
  { code: "1100", name: "Accounts Receivable", type: "asset", subtype: "receivable" },
  { code: "1200", name: "Loans Receivable", type: "asset", subtype: "receivable" },
  { code: "1210", name: "Cash on Collected Loans", type: "asset", subtype: "cash" },
  // Liabilities (2xxx)
  { code: "2000", name: "Accounts Payable", type: "liability", subtype: "payable" },
  { code: "2100", name: "Debts Payable", type: "liability", subtype: "payable" },
  { code: "2200", name: "Borrower Savings Payable", type: "liability", subtype: "payable" },
  // Equity (3xxx)
  { code: "3000", name: "Owner's Equity", type: "equity" },
  { code: "3100", name: "Owner's Contributions", type: "equity" },
  { code: "3200", name: "Owner's Drawings", type: "equity" },
  { code: "3900", name: "Retained Earnings", type: "equity" },
  // Income (4xxx)
  { code: "4000", name: "Service Income", type: "income" },
  { code: "4100", name: "Interest Income", type: "income" },
  // Expenses (5xxx)
  { code: "5000", name: "Supplies", type: "expense" },
  { code: "5100", name: "Fees", type: "expense" },
];

// ---- Chart of Accounts (Supabase-backed) ----

export interface CreateAccountInput {
  code: string;
  name: string;
  type: LedgerAccountType;
  book: Book;
  subtype?: string | null;
  parent_id?: string | null;
  description?: string | null;
}

export type UpdateAccountInput = Partial<{
  code: string;
  name: string;
  type: LedgerAccountType;
  book: Book;
  subtype: string | null;
  parent_id: string | null;
  description: string | null;
  is_active: boolean;
}>;

export async function seedDefaultCoA(
  supabase: SupabaseClient,
  userId: string
): Promise<LedgerResult<{ inserted: number }>> {
  const { count } = await supabase
    .from("ledger_accounts")
    .select("*", { count: "exact", head: true });

  if (count && count > 0) return { ok: true, data: { inserted: 0 } };

  const books: Book[] = ["business", "personal"];
  const rows = books.flatMap((book) =>
    DEFAULT_COA.map((a) => ({
      user_id: userId,
      code: a.code,
      name: a.name,
      type: a.type,
      subtype: a.subtype ?? null,
      book,
      normal_balance: normalBalanceFor(a.type),
      is_active: true,
    }))
  );

  const { error } = await supabase.from("ledger_accounts").insert(rows);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { inserted: rows.length } };
}

export async function listAccounts(
  supabase: SupabaseClient
): Promise<LedgerResult<LedgerAccount[]>> {
  const { data, error } = await supabase
    .from("ledger_accounts")
    .select("*")
    .order("book", { ascending: true })
    .order("code", { ascending: true });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as LedgerAccount[] };
}

export async function createAccount(
  supabase: SupabaseClient,
  userId: string,
  input: CreateAccountInput
): Promise<LedgerResult<LedgerAccount>> {
  if (!input.code || !input.name || !input.type || !input.book) {
    return { ok: false, error: "Code, name, type, and book are required" };
  }
  const { data, error } = await supabase
    .from("ledger_accounts")
    .insert({
      user_id: userId,
      code: input.code,
      name: input.name,
      type: input.type,
      subtype: input.subtype ?? null,
      book: input.book,
      normal_balance: normalBalanceFor(input.type),
      parent_id: input.parent_id ?? null,
      description: input.description ?? null,
      is_active: true,
    })
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as LedgerAccount };
}

export async function updateAccount(
  supabase: SupabaseClient,
  id: string,
  patch: UpdateAccountInput
): Promise<LedgerResult<LedgerAccount>> {
  const next: Record<string, unknown> = { ...patch };
  if (patch.type) next.normal_balance = normalBalanceFor(patch.type);
  const { data, error } = await supabase
    .from("ledger_accounts")
    .update(next)
    .eq("id", id)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as LedgerAccount };
}

export async function deactivateAccount(
  supabase: SupabaseClient,
  id: string
): Promise<LedgerResult<LedgerAccount>> {
  const { data, error } = await supabase
    .from("ledger_accounts")
    .update({ is_active: false })
    .eq("id", id)
    .select()
    .single();
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as LedgerAccount };
}

// ---- Journal entries (Supabase-backed) ----

export interface CreateJournalEntryInput {
  entry_date: string;
  memo?: string | null;
  reference?: string | null;
  status?: JournalStatus;
  lines: JournalLineInput[];
}

const ENTRY_SELECT = "*, journal_lines(*, ledger_accounts(*))";

export async function createJournalEntry(
  supabase: SupabaseClient,
  userId: string,
  input: CreateJournalEntryInput
): Promise<LedgerResult<JournalEntryWithLines>> {
  const status: JournalStatus = input.status ?? "posted";
  const lines = input.lines ?? [];
  const activeLines = stripEmptyLines(lines);

  if (!input.entry_date) return { ok: false, error: "Entry date is required" };

  if (status === "posted") {
    const check = validatePostedLines(activeLines);
    if (!check.ok) return { ok: false, error: check.error };
  } else {
    for (const line of activeLines) {
      if (line.debit || line.credit) {
        const res = validateLine(line);
        if (!res.ok) return { ok: false, error: res.error };
      }
    }
  }

  const { data: entry, error: entryError } = await supabase
    .from("journal_entries")
    .insert({
      user_id: userId,
      entry_date: input.entry_date,
      memo: input.memo ?? null,
      reference: input.reference ?? null,
      status,
    })
    .select()
    .single();
  if (entryError || !entry) {
    return { ok: false, error: entryError?.message ?? "Failed to create entry" };
  }

  const lineRows = activeLines.map((l) => ({
    user_id: userId,
    journal_entry_id: entry.id,
    ledger_account_id: l.ledger_account_id,
    debit: roundMoney(Number(l.debit || 0)),
    credit: roundMoney(Number(l.credit || 0)),
    line_memo: l.line_memo ?? null,
  }));

  const { error: linesError } = await supabase.from("journal_lines").insert(lineRows);
  if (linesError) {
    // best-effort rollback of the orphan header
    await supabase.from("journal_entries").delete().eq("id", entry.id);
    return { ok: false, error: linesError.message };
  }

  return getJournalEntry(supabase, entry.id);
}

export async function listJournalEntries(
  supabase: SupabaseClient,
  filters?: { from?: string; to?: string }
): Promise<LedgerResult<JournalEntryWithLines[]>> {
  let query = supabase.from("journal_entries").select(ENTRY_SELECT);
  if (filters?.from) query = query.gte("entry_date", filters.from);
  if (filters?.to) query = query.lte("entry_date", filters.to);
  const { data, error } = await query
    .order("entry_date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: data as JournalEntryWithLines[] };
}

export async function getJournalEntry(
  supabase: SupabaseClient,
  id: string
): Promise<LedgerResult<JournalEntryWithLines>> {
  const { data, error } = await supabase
    .from("journal_entries")
    .select(ENTRY_SELECT)
    .eq("id", id)
    .single();
  if (error) return { ok: false, error: error.message, status: 404 };
  return { ok: true, data: data as JournalEntryWithLines };
}

export async function updateJournalEntry(
  supabase: SupabaseClient,
  id: string,
  input: CreateJournalEntryInput
): Promise<LedgerResult<JournalEntryWithLines>> {
  const status: JournalStatus = input.status ?? "posted";
  const lines = input.lines ?? [];
  const activeLines = stripEmptyLines(lines);

  if (status === "posted") {
    const check = validatePostedLines(activeLines);
    if (!check.ok) return { ok: false, error: check.error };
  }

  const { error: updateError } = await supabase
    .from("journal_entries")
    .update({
      entry_date: input.entry_date,
      memo: input.memo ?? null,
      reference: input.reference ?? null,
      status,
    })
    .eq("id", id);
  if (updateError) return { ok: false, error: updateError.message };

  // Replace lines wholesale (simplest correct approach for an edit).
  const { error: delError } = await supabase
    .from("journal_lines")
    .delete()
    .eq("journal_entry_id", id);
  if (delError) return { ok: false, error: delError.message };

  const { data: entry } = await supabase
    .from("journal_entries")
    .select("user_id")
    .eq("id", id)
    .single();
  const userId = entry?.user_id as string;

  const lineRows = activeLines.map((l) => ({
    user_id: userId,
    journal_entry_id: id,
    ledger_account_id: l.ledger_account_id,
    debit: roundMoney(Number(l.debit || 0)),
    credit: roundMoney(Number(l.credit || 0)),
    line_memo: l.line_memo ?? null,
  }));

  const { error: insError } = await supabase.from("journal_lines").insert(lineRows);
  if (insError) return { ok: false, error: insError.message };

  return getJournalEntry(supabase, id);
}

export async function deleteJournalEntry(
  supabase: SupabaseClient,
  id: string
): Promise<LedgerResult<{ success: true }>> {
  const { error } = await supabase.from("journal_entries").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  return { ok: true, data: { success: true } };
}
