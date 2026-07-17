import type {
  LedgerAccount,
  Book,
  LedgerAccountType,
  JournalStatus,
  JournalEntryWithLines,
} from "@/types/database";
import type { createClient } from "@/lib/supabase/server";
import type { LedgerResult } from "@/lib/server/ledger";
import {
  normalBalanceFor,
  roundMoney,
  validateLine,
  validatePostedLines,
  stripEmptyLines,
  buildTrialBalance,
  DEFAULT_COA,
  type JournalLineInput,
  type TrialBalance,
} from "@/lib/ledger-math";

// Re-export the pure ledger math so existing consumers (routes, tests) that
// import these names from `@/lib/server/ledger-gl` keep working unchanged.
// The pure math lives in `@/lib/ledger-math` (client-safe: no Supabase imports).
export * from "@/lib/ledger-math";

type SupabaseClient = ReturnType<typeof createClient>;

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

// ---- Reporting: trial balance + account register ----

export async function getTrialBalance(
  supabase: SupabaseClient,
  opts?: { book?: Book; asOf?: string }
): Promise<LedgerResult<TrialBalance>> {
  const { data: accounts, error: accErr } = await supabase
    .from("ledger_accounts")
    .select("id, code, name, type, book, normal_balance");
  if (accErr) return { ok: false, error: accErr.message };

  let lineQuery = supabase
    .from("journal_lines")
    .select("ledger_account_id, debit, credit, journal_entries!inner(entry_date, status)")
    .eq("journal_entries.status", "posted");
  if (opts?.asOf) {
    lineQuery = lineQuery.lte("journal_entries.entry_date", opts.asOf);
  }
  const { data: lines, error: lineErr } = await lineQuery;
  if (lineErr) return { ok: false, error: lineErr.message };

  const tb = buildTrialBalance(
    (accounts ?? []) as never,
    ((lines ?? []) as { ledger_account_id: string; debit: number; credit: number }[]),
    opts?.book
  );
  return { ok: true, data: tb };
}

export interface RegisterRow {
  line_id: string;
  entry_id: string;
  entry_date: string;
  memo: string | null;
  debit: number;
  credit: number;
  running_balance: number;
}

export async function getAccountRegister(
  supabase: SupabaseClient,
  accountId: string
): Promise<LedgerResult<{ account: LedgerAccount; rows: RegisterRow[] }>> {
  const { data: account, error: accErr } = await supabase
    .from("ledger_accounts")
    .select("*")
    .eq("id", accountId)
    .single();
  if (accErr || !account) {
    return { ok: false, error: accErr?.message ?? "Account not found", status: 404 };
  }

  const { data: lines, error: lineErr } = await supabase
    .from("journal_lines")
    .select("id, debit, credit, journal_entry_id, journal_entries!inner(entry_date, memo, status)")
    .eq("ledger_account_id", accountId)
    .eq("journal_entries.status", "posted");
  if (lineErr) return { ok: false, error: lineErr.message };

  type Row = {
    id: string;
    debit: number;
    credit: number;
    journal_entry_id: string;
    journal_entries: { entry_date: string; memo: string | null };
  };
  const sorted = ((lines ?? []) as unknown as Row[]).sort((a, b) =>
    a.journal_entries.entry_date.localeCompare(b.journal_entries.entry_date)
  );

  const acct = account as LedgerAccount;
  const rows: RegisterRow[] = sorted.map((l) => ({
    line_id: l.id,
    entry_id: l.journal_entry_id,
    entry_date: l.journal_entries.entry_date,
    memo: l.journal_entries.memo,
    debit: Number(l.debit || 0),
    credit: Number(l.credit || 0),
    running_balance: 0,
  }));

  // Running balance accumulates by the account's normal side.
  let bal = 0;
  for (const r of rows) {
    bal =
      acct.normal_balance === "debit"
        ? roundMoney(bal + r.debit - r.credit)
        : roundMoney(bal + r.credit - r.debit);
    r.running_balance = bal;
  }

  return { ok: true, data: { account: acct, rows } };
}
