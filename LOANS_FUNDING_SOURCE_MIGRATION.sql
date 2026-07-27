-- ============================================================================
-- Add funding_source to loans — incremental migration
-- Safe to run once against your live Supabase project (SQL Editor → Run).
-- ============================================================================

ALTER TABLE public.loans 
ADD COLUMN IF NOT EXISTS funding_source TEXT NOT NULL DEFAULT 'reinvested' 
CHECK (funding_source IN ('reinvested', 'fresh_capital'));

-- Update existing loans to 'reinvested' (already handled by default)
