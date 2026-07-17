-- ============================================================================
-- Collection links — incremental migration for an EXISTING Money Manager DB.
-- Safe to run once against your live Supabase project (SQL Editor → Run).
-- Adds a `collection_id` link column to `transactions` so each loan collection
-- maps to its EXACT linked transaction (loan_id alone is ambiguous once a loan
-- has more than one collection). Enables editing/deleting a collection and its
-- linked transaction consistently.
-- Run AFTER LOANS_MIGRATION.sql, LOANS_COLLECTIONS_MIGRATION.sql, and
-- TRANSACTION_LINKS_MIGRATION.sql. Does NOT touch other existing tables.
-- The handle_updated_at() function already exists from the original setup.
-- ============================================================================

ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS collection_id UUID;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'transactions_collection_id_fkey'
  ) THEN
    ALTER TABLE public.transactions
      ADD CONSTRAINT transactions_collection_id_fkey FOREIGN KEY (collection_id)
        REFERENCES public.loan_collections(id) ON DELETE SET NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_transactions_collection_id ON public.transactions(collection_id);

-- Track edits on collections (the original loan_collections table has no
-- updated_at; editing benefits from it).
ALTER TABLE public.loan_collections ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ NOT NULL DEFAULT now();

DROP TRIGGER IF EXISTS loan_collections_updated_at ON public.loan_collections;
CREATE TRIGGER loan_collections_updated_at BEFORE UPDATE ON public.loan_collections
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Best-effort backfill for collections created before this migration. Matches on
-- loan_id + date + amount for collection-kind rows; rows that cannot be matched
-- 1:1 (e.g. duplicate same-day/same-amount collections) stay unlinked and the
-- app degrades gracefully (balances still reverse; linked-tx update is skipped).
UPDATE public.transactions t
SET collection_id = lc.id
FROM public.loan_collections lc
WHERE t.collection_id IS NULL
  AND t.loan_id = lc.loan_id
  AND t.date = lc.collection_date
  AND t.amount = lc.collected_amount
  AND lc.kind = 'collection';
