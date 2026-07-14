-- ============================================================================
-- Money Manager — Supabase setup
-- Run this ONCE against a fresh Supabase project:
--   Supabase Dashboard → SQL Editor → New query → paste all of this → Run
--
-- This is the schema that matches the Next.js app (src/types/database.ts).
-- Do NOT also run supabase/migrations/20240301000000_initial_schema.sql —
-- that older migration uses a different, incompatible schema.
-- ============================================================================

-- ---------------------------------------------------------------------------
-- SECTION 1 — Core schema (REQUIRED)
-- ---------------------------------------------------------------------------

-- Categories
CREATE TABLE public.categories (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  color TEXT NOT NULL DEFAULT '#6366f1',
  icon TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name, type)
);

-- Accounts
CREATE TABLE public.accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('checking', 'savings', 'credit', 'cash', 'investment')),
  balance NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'USD',
  color TEXT NOT NULL DEFAULT '#10b981',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, name)
);

-- Scheduled / recurring transactions
CREATE TABLE public.scheduled_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense')),
  description TEXT NOT NULL DEFAULT '',
  frequency TEXT NOT NULL CHECK (frequency IN ('daily', 'weekly', 'biweekly', 'monthly', 'yearly')),
  start_date DATE NOT NULL,
  end_date DATE,
  next_occurrence DATE NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Transactions
CREATE TABLE public.transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.accounts(id) ON DELETE CASCADE,
  category_id UUID REFERENCES public.categories(id) ON DELETE SET NULL,
  scheduled_transaction_id UUID REFERENCES public.scheduled_transactions(id) ON DELETE SET NULL,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  type TEXT NOT NULL CHECK (type IN ('income', 'expense', 'transfer')),
  description TEXT NOT NULL DEFAULT '',
  notes TEXT,
  date DATE NOT NULL DEFAULT CURRENT_DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Debts
CREATE TABLE public.debts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  creditor TEXT,
  balance NUMERIC(12, 2) NOT NULL CHECK (balance >= 0),
  original_balance NUMERIC(12, 2),
  interest_rate NUMERIC(5, 2) NOT NULL DEFAULT 0 CHECK (interest_rate >= 0),
  minimum_payment NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (minimum_payment >= 0),
  due_day INTEGER CHECK (due_day BETWEEN 1 AND 31),
  notes TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Debt payoff plans
CREATE TABLE public.debt_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  strategy TEXT NOT NULL CHECK (strategy IN ('avalanche', 'snowball')),
  monthly_budget NUMERIC(12, 2) NOT NULL CHECK (monthly_budget > 0),
  schedule JSONB NOT NULL DEFAULT '[]'::jsonb,
  ai_advice TEXT,
  total_interest NUMERIC(12, 2),
  months_to_payoff INTEGER,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Debt payments
CREATE TABLE public.debt_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  debt_id UUID NOT NULL REFERENCES public.debts(id) ON DELETE CASCADE,
  amount NUMERIC(12, 2) NOT NULL CHECK (amount > 0),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_categories_user_id ON public.categories(user_id);
CREATE INDEX idx_accounts_user_id ON public.accounts(user_id);
CREATE INDEX idx_transactions_user_id ON public.transactions(user_id);
CREATE INDEX idx_transactions_date ON public.transactions(date DESC);
CREATE INDEX idx_transactions_account_id ON public.transactions(account_id);
CREATE INDEX idx_scheduled_transactions_user_id ON public.scheduled_transactions(user_id);
CREATE INDEX idx_scheduled_transactions_next ON public.scheduled_transactions(next_occurrence) WHERE is_active = true;
CREATE INDEX idx_debts_user_id ON public.debts(user_id);
CREATE INDEX idx_debt_plans_user_id ON public.debt_plans(user_id);
CREATE INDEX idx_debt_payments_debt_id ON public.debt_payments(debt_id);

-- updated_at trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER categories_updated_at BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER accounts_updated_at BEFORE UPDATE ON public.accounts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER transactions_updated_at BEFORE UPDATE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER scheduled_transactions_updated_at BEFORE UPDATE ON public.scheduled_transactions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER debts_updated_at BEFORE UPDATE ON public.debts
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();
CREATE TRIGGER debt_plans_updated_at BEFORE UPDATE ON public.debt_plans
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Keep account balances in sync with transactions
CREATE OR REPLACE FUNCTION public.update_account_balance()
RETURNS TRIGGER AS $$
DECLARE
  delta NUMERIC(12, 2);
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.type = 'income' THEN
      delta := NEW.amount;
    ELSIF NEW.type = 'expense' THEN
      delta := -NEW.amount;
    ELSE
      delta := 0;
    END IF;
    UPDATE public.accounts SET balance = balance + delta WHERE id = NEW.account_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.type = 'income' THEN
      delta := -OLD.amount;
    ELSIF OLD.type = 'expense' THEN
      delta := OLD.amount;
    ELSE
      delta := 0;
    END IF;
    UPDATE public.accounts SET balance = balance + delta WHERE id = OLD.account_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.account_id = NEW.account_id THEN
      IF OLD.type = 'income' THEN delta := -OLD.amount;
      ELSIF OLD.type = 'expense' THEN delta := OLD.amount;
      ELSE delta := 0; END IF;
      IF NEW.type = 'income' THEN delta := delta + NEW.amount;
      ELSIF NEW.type = 'expense' THEN delta := delta - NEW.amount;
      END IF;
      UPDATE public.accounts SET balance = balance + delta WHERE id = NEW.account_id;
    ELSE
      IF OLD.type = 'income' THEN
        UPDATE public.accounts SET balance = balance - OLD.amount WHERE id = OLD.account_id;
      ELSIF OLD.type = 'expense' THEN
        UPDATE public.accounts SET balance = balance + OLD.amount WHERE id = OLD.account_id;
      END IF;
      IF NEW.type = 'income' THEN
        UPDATE public.accounts SET balance = balance + NEW.amount WHERE id = NEW.account_id;
      ELSIF NEW.type = 'expense' THEN
        UPDATE public.accounts SET balance = balance - NEW.amount WHERE id = NEW.account_id;
      END IF;
    END IF;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER transactions_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.transactions
  FOR EACH ROW EXECUTE FUNCTION public.update_account_balance();

-- Keep debt balances in sync with payments
CREATE OR REPLACE FUNCTION public.update_debt_balance()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.debts SET balance = GREATEST(balance - NEW.amount, 0) WHERE id = NEW.debt_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.debts SET balance = balance + OLD.amount WHERE id = OLD.debt_id;
    RETURN OLD;
  ELSIF TG_OP = 'UPDATE' THEN
    UPDATE public.debts SET balance = balance + OLD.amount - NEW.amount WHERE id = NEW.debt_id;
    UPDATE public.debts SET balance = GREATEST(balance, 0) WHERE id = NEW.debt_id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER debt_payments_balance_trigger
  AFTER INSERT OR UPDATE OR DELETE ON public.debt_payments
  FOR EACH ROW EXECUTE FUNCTION public.update_debt_balance();

-- Row Level Security — each user only sees their own rows
ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.accounts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.scheduled_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.debt_payments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own categories" ON public.categories
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own accounts" ON public.accounts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own transactions" ON public.transactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own scheduled transactions" ON public.scheduled_transactions
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own debts" ON public.debts
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own debt plans" ON public.debt_plans
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users manage own debt payments" ON public.debt_payments
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT USAGE ON SCHEMA public TO postgres, anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO postgres, service_role;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO authenticated;
GRANT SELECT ON ALL TABLES IN SCHEMA public TO anon;

-- ---------------------------------------------------------------------------
-- SECTION 2 — Daily recurring-transaction processor (OPTIONAL)
-- Requires the pg_cron extension. If your project doesn't have it enabled, you
-- can skip this whole section; the app still works, recurring items just won't
-- auto-post each day. To enable pg_cron: Dashboard → Database → Extensions.
-- ---------------------------------------------------------------------------

-- CREATE EXTENSION IF NOT EXISTS "pg_cron" WITH SCHEMA extensions;
--
-- CREATE OR REPLACE FUNCTION public.process_recurring_transactions()
-- RETURNS INTEGER AS $$
-- DECLARE
--   rec RECORD;
--   processed INTEGER := 0;
--   new_next DATE;
-- BEGIN
--   FOR rec IN
--     SELECT * FROM public.scheduled_transactions
--     WHERE is_active = true
--       AND next_occurrence <= CURRENT_DATE
--       AND (end_date IS NULL OR end_date >= CURRENT_DATE)
--   LOOP
--     INSERT INTO public.transactions (
--       user_id, account_id, category_id, scheduled_transaction_id,
--       amount, type, description, date
--     ) VALUES (
--       rec.user_id, rec.account_id, rec.category_id, rec.id,
--       rec.amount, rec.type, rec.description, rec.next_occurrence
--     );
--     new_next := rec.next_occurrence;
--     LOOP
--       new_next := CASE rec.frequency
--         WHEN 'daily' THEN new_next + INTERVAL '1 day'
--         WHEN 'weekly' THEN new_next + INTERVAL '1 week'
--         WHEN 'biweekly' THEN new_next + INTERVAL '2 weeks'
--         WHEN 'monthly' THEN new_next + INTERVAL '1 month'
--         WHEN 'yearly' THEN new_next + INTERVAL '1 year'
--         ELSE new_next + INTERVAL '1 month'
--       END;
--       EXIT WHEN new_next > CURRENT_DATE;
--     END LOOP;
--     IF rec.end_date IS NOT NULL AND new_next > rec.end_date THEN
--       UPDATE public.scheduled_transactions
--       SET is_active = false, next_occurrence = new_next, updated_at = now()
--       WHERE id = rec.id;
--     ELSE
--       UPDATE public.scheduled_transactions
--       SET next_occurrence = new_next, updated_at = now()
--       WHERE id = rec.id;
--     END IF;
--     processed := processed + 1;
--   END LOOP;
--   RETURN processed;
-- END;
-- $$ LANGUAGE plpgsql SECURITY DEFINER;
--
-- SELECT cron.schedule(
--   'process-recurring-transactions',
--   '0 1 * * *',
--   $$SELECT public.process_recurring_transactions()$$
-- );
