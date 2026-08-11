-- Restores the single-user data model after the retired shared-household
-- version of KahitaNiPangs. Run once in Supabase Dashboard > SQL Editor.
-- It keeps existing financial records and simply makes the legacy columns
-- optional, then restores per-user access rules.

ALTER TABLE public.categories ALTER COLUMN household_id DROP NOT NULL;
ALTER TABLE public.accounts ALTER COLUMN household_id DROP NOT NULL;
ALTER TABLE public.transactions ALTER COLUMN household_id DROP NOT NULL;
ALTER TABLE public.transactions ALTER COLUMN contributor_id DROP NOT NULL;
ALTER TABLE public.transactions ALTER COLUMN contributor_name DROP NOT NULL;
ALTER TABLE public.scheduled_transactions ALTER COLUMN household_id DROP NOT NULL;

ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_household_name_type_key;
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_household_name_key;

CREATE UNIQUE INDEX IF NOT EXISTS categories_user_name_type_key
  ON public.categories (user_id, name, type);
CREATE UNIQUE INDEX IF NOT EXISTS accounts_user_name_key
  ON public.accounts (user_id, name);

DROP POLICY IF EXISTS "Household manages categories" ON public.categories;
DROP POLICY IF EXISTS "Household manages accounts" ON public.accounts;
DROP POLICY IF EXISTS "Household manages transactions" ON public.transactions;
DROP POLICY IF EXISTS "Household manages scheduled transactions" ON public.scheduled_transactions;
DROP POLICY IF EXISTS "Users manage own categories" ON public.categories;
DROP POLICY IF EXISTS "Users manage own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users manage own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users manage own scheduled transactions" ON public.scheduled_transactions;

CREATE POLICY "Users manage own categories" ON public.categories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own accounts" ON public.accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own transactions" ON public.transactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own scheduled transactions" ON public.scheduled_transactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
