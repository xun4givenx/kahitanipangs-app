-- ============================================================================
-- Loans ("Loans Out") — incremental migration for an EXISTING Money Manager DB.
-- Safe to run once against your live Supabase project (SQL Editor → Run).
-- Only adds the new `loans` table; does NOT touch existing tables.
-- The handle_updated_at() function already exists from the original setup.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  person_name TEXT NOT NULL,
  total_amount NUMERIC(12, 2) NOT NULL,
  interest_rate NUMERIC(6, 3) NOT NULL DEFAULT 0,
  start_date DATE NOT NULL,
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly')),
  installments INTEGER NOT NULL DEFAULT 0,
  repayment_amount NUMERIC(12, 2) NOT NULL DEFAULT 0,
  remaining_balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  advanced_interest BOOLEAN NOT NULL DEFAULT false,
  amount_released NUMERIC(12, 2) NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_loans_user_id ON public.loans(user_id);

DROP TRIGGER IF EXISTS loans_updated_at ON public.loans;
CREATE TRIGGER loans_updated_at BEFORE UPDATE ON public.loans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.loans ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own loans" ON public.loans;
CREATE POLICY "Users manage own loans" ON public.loans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
