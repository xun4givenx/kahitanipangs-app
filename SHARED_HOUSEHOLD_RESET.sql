-- KahitaNiPangs shared-household reset and migration
-- Run once in Supabase Dashboard > SQL Editor. This permanently deletes all
-- application finance data while keeping auth.users so both people can sign in.

CREATE TABLE IF NOT EXISTS public.households (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  currency TEXT NOT NULL DEFAULT 'PHP',
  invite_code TEXT NOT NULL UNIQUE DEFAULT upper(substr(replace(gen_random_uuid()::text, '-', ''), 1, 8)),
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.household_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  household_id UUID NOT NULL REFERENCES public.households(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'member')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (household_id, user_id),
  UNIQUE (user_id)
);

ALTER TABLE public.categories ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.accounts ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE CASCADE;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS contributor_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS contributor_name TEXT;
ALTER TABLE public.scheduled_transactions ADD COLUMN IF NOT EXISTS household_id UUID REFERENCES public.households(id) ON DELETE CASCADE;

-- This is the requested clean start. User accounts are intentionally retained.
DO $$
DECLARE table_name TEXT;
BEGIN
  FOREACH table_name IN ARRAY ARRAY[
    'journal_lines', 'journal_entries', 'ledger_accounts', 'loan_collections',
    'debt_payments', 'debt_plans', 'loans', 'debts', 'scheduled_transactions',
    'transactions', 'accounts', 'categories', 'household_members', 'households'
  ] LOOP
    IF to_regclass('public.' || table_name) IS NOT NULL THEN
      EXECUTE 'TRUNCATE TABLE public.' || quote_ident(table_name) || ' RESTART IDENTITY CASCADE';
    END IF;
  END LOOP;
END $$;

ALTER TABLE public.categories ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE public.accounts ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE public.transactions ALTER COLUMN household_id SET NOT NULL;
ALTER TABLE public.transactions ALTER COLUMN contributor_id SET NOT NULL;
ALTER TABLE public.transactions ALTER COLUMN contributor_name SET NOT NULL;
ALTER TABLE public.scheduled_transactions ALTER COLUMN household_id SET NOT NULL;

ALTER TABLE public.categories DROP CONSTRAINT IF EXISTS categories_user_id_name_type_key;
ALTER TABLE public.accounts DROP CONSTRAINT IF EXISTS accounts_user_id_name_key;
ALTER TABLE public.categories ADD CONSTRAINT categories_household_name_type_key UNIQUE (household_id, name, type);
ALTER TABLE public.accounts ADD CONSTRAINT accounts_household_name_key UNIQUE (household_id, name);
CREATE INDEX IF NOT EXISTS idx_household_members_household_id ON public.household_members(household_id);
CREATE INDEX IF NOT EXISTS idx_transactions_household_id ON public.transactions(household_id, date DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_contributor_id ON public.transactions(contributor_id, date DESC);

CREATE OR REPLACE FUNCTION public.is_household_member(target_household_id UUID)
RETURNS BOOLEAN AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.household_members
    WHERE household_id = target_household_id AND user_id = auth.uid()
  );
$$ LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public;

CREATE OR REPLACE FUNCTION public.join_household_with_code(p_invite_code TEXT, p_display_name TEXT)
RETURNS UUID AS $$
DECLARE selected_household UUID;
BEGIN
  SELECT id INTO selected_household FROM public.households
  WHERE invite_code = upper(trim(p_invite_code));
  IF selected_household IS NULL THEN RAISE EXCEPTION 'That household code was not found'; END IF;
  INSERT INTO public.household_members (household_id, user_id, display_name)
  VALUES (selected_household, auth.uid(), trim(p_display_name))
  ON CONFLICT (user_id) DO UPDATE SET household_id = EXCLUDED.household_id, display_name = EXCLUDED.display_name;
  RETURN selected_household;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

ALTER TABLE public.households ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.household_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Household members read household" ON public.households;
DROP POLICY IF EXISTS "Household creators create household" ON public.households;
DROP POLICY IF EXISTS "Household members read members" ON public.household_members;
DROP POLICY IF EXISTS "Users create their membership" ON public.household_members;
CREATE POLICY "Household members read household" ON public.households FOR SELECT USING (public.is_household_member(id));
CREATE POLICY "Household creators create household" ON public.households FOR INSERT WITH CHECK (created_by = auth.uid());
CREATE POLICY "Household members read members" ON public.household_members FOR SELECT USING (public.is_household_member(household_id));
CREATE POLICY "Users create their membership" ON public.household_members FOR INSERT WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "Users manage own categories" ON public.categories;
DROP POLICY IF EXISTS "Users manage own accounts" ON public.accounts;
DROP POLICY IF EXISTS "Users manage own transactions" ON public.transactions;
DROP POLICY IF EXISTS "Users manage own scheduled transactions" ON public.scheduled_transactions;
CREATE POLICY "Household manages categories" ON public.categories FOR ALL USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));
CREATE POLICY "Household manages accounts" ON public.accounts FOR ALL USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));
CREATE POLICY "Household manages transactions" ON public.transactions FOR ALL USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));
CREATE POLICY "Household manages scheduled transactions" ON public.scheduled_transactions FOR ALL USING (public.is_household_member(household_id)) WITH CHECK (public.is_household_member(household_id));

GRANT EXECUTE ON FUNCTION public.is_household_member(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.join_household_with_code(TEXT, TEXT) TO authenticated;
