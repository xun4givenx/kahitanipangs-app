-- ============================================================================
-- Double-Entry General Ledger — incremental migration for an EXISTING Money
-- Manager DB. Safe to run once against your live Supabase project
-- (SQL Editor -> Run). Idempotent. Adds three GL tables; does NOT touch
-- existing accounts/transactions/loans/debts tables or their triggers.
-- handle_updated_at() already exists from the original SUPABASE_SETUP.sql.
-- ============================================================================

-- Chart of Accounts
CREATE TABLE IF NOT EXISTS public.ledger_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('asset','liability','equity','income','expense')),
  subtype TEXT,
  book TEXT NOT NULL CHECK (book IN ('personal','business')),
  normal_balance TEXT NOT NULL CHECK (normal_balance IN ('debit','credit')),
  parent_id UUID REFERENCES public.ledger_accounts(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, book, code)
);
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_user_id ON public.ledger_accounts(user_id);

-- Journal entry header
CREATE TABLE IF NOT EXISTS public.journal_entries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  entry_date DATE NOT NULL DEFAULT current_date,
  memo TEXT,
  reference TEXT,
  status TEXT NOT NULL DEFAULT 'posted' CHECK (status IN ('draft','posted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_journal_entries_user_id ON public.journal_entries(user_id);
CREATE INDEX IF NOT EXISTS idx_journal_entries_entry_date ON public.journal_entries(entry_date);

-- Journal lines
CREATE TABLE IF NOT EXISTS public.journal_lines (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  journal_entry_id UUID NOT NULL REFERENCES public.journal_entries(id) ON DELETE CASCADE,
  ledger_account_id UUID NOT NULL REFERENCES public.ledger_accounts(id),
  debit NUMERIC(14, 2) NOT NULL DEFAULT 0,
  credit NUMERIC(14, 2) NOT NULL DEFAULT 0,
  line_memo TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON public.journal_lines(journal_entry_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON public.journal_lines(ledger_account_id);
CREATE INDEX IF NOT EXISTS idx_journal_lines_user_id ON public.journal_lines(user_id);

-- updated_at triggers
DROP TRIGGER IF EXISTS ledger_accounts_updated_at ON public.ledger_accounts;
CREATE TRIGGER ledger_accounts_updated_at BEFORE UPDATE ON public.ledger_accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP TRIGGER IF EXISTS journal_entries_updated_at ON public.journal_entries;
CREATE TRIGGER journal_entries_updated_at BEFORE UPDATE ON public.journal_entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS
ALTER TABLE public.ledger_accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.journal_lines ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own ledger_accounts" ON public.ledger_accounts;
CREATE POLICY "Users manage own ledger_accounts" ON public.ledger_accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own journal_entries" ON public.journal_entries;
CREATE POLICY "Users manage own journal_entries" ON public.journal_entries
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users manage own journal_lines" ON public.journal_lines;
CREATE POLICY "Users manage own journal_lines" ON public.journal_lines
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
