-- ============================================================================
-- Linked ledger — incremental migration for an EXISTING Money Manager DB.
-- Safe to run once against your live Supabase project (SQL Editor → Run).
-- Adds `loan_id` and `debt_id` link columns to `transactions` so a single
-- transaction can drive a loan collection or a debt payment; does NOT touch
-- other existing tables.
-- Run AFTER LOANS_MIGRATION.sql and LOANS_COLLECTIONS_MIGRATION.sql.
-- ============================================================================

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS loan_id UUID;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS debt_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_loan_id_fkey'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_loan_id_fkey FOREIGN KEY (loan_id)
        REFERENCES public.loans(id) ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_debt_id_fkey'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_debt_id_fkey FOREIGN KEY (debt_id)
        REFERENCES public.debts(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_loan_id ON public.transactions(loan_id);
CREATE INDEX IF NOT EXISTS idx_transactions_debt_id ON public.transactions(debt_id);
