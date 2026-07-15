-- ============================================================================
-- Loan collections + borrower savings — incremental migration for an EXISTING
-- Money Manager DB. Safe to run once against your live Supabase project
-- (SQL Editor → Run). Adds `savings_balance` to `loans` and a new
-- `loan_collections` table; does NOT touch other existing tables.
-- The handle_updated_at() function already exists from the original setup.
-- ============================================================================

ALTER TABLE public.loans ADD COLUMN IF NOT EXISTS savings_balance NUMERIC(12, 2) NOT NULL DEFAULT 0;

CREATE TABLE IF NOT EXISTS public.loan_collections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  loan_id UUID NOT NULL REFERENCES public.loans(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'collection' CHECK (kind IN ('collection', 'withdrawal')),
  collection_date DATE NOT NULL DEFAULT current_date,
  installment_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  collected_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  savings_delta NUMERIC(12, 2) NOT NULL DEFAULT 0,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loan_collections_loan_id ON public.loan_collections(loan_id);
CREATE INDEX IF NOT EXISTS idx_loan_collections_user_id ON public.loan_collections(user_id);

ALTER TABLE public.loan_collections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own loan_collections" ON public.loan_collections;
CREATE POLICY "Users manage own loan_collections" ON public.loan_collections
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
