export type CategoryType = "income" | "expense";
export type AccountType = "checking" | "savings" | "credit" | "cash" | "investment";
export type TransactionType = "income" | "expense" | "transfer";
export type Frequency = "daily" | "weekly" | "biweekly" | "monthly" | "yearly";
export type DebtStrategy = "avalanche" | "snowball";

export interface Category {
  id: string;
  user_id: string;
  name: string;
  type: CategoryType;
  color: string;
  icon: string | null;
  created_at: string;
  updated_at: string;
}

export interface Account {
  id: string;
  user_id: string;
  name: string;
  type: AccountType;
  balance: number;
  currency: string;
  color: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface Transaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  scheduled_transaction_id: string | null;
  amount: number;
  type: TransactionType;
  description: string;
  notes: string | null;
  date: string;
  created_at: string;
  updated_at: string;
  accounts?: Account;
  categories?: Category;
}

export interface ScheduledTransaction {
  id: string;
  user_id: string;
  account_id: string;
  category_id: string | null;
  amount: number;
  type: TransactionType;
  description: string;
  frequency: Frequency;
  start_date: string;
  end_date: string | null;
  next_occurrence: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  accounts?: Account;
  categories?: Category;
}

export interface Debt {
  id: string;
  user_id: string;
  name: string;
  creditor: string | null;
  balance: number;
  original_balance: number | null;
  interest_rate: number;
  minimum_payment: number;
  due_day: number | null;
  notes: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DebtPlanMonth {
  month: number;
  payments: { debt_id: string; debt_name: string; payment: number; remaining: number }[];
  total_paid: number;
  total_interest: number;
}

export interface DebtPlan {
  id: string;
  user_id: string;
  strategy: DebtStrategy;
  monthly_budget: number;
  schedule: DebtPlanMonth[];
  ai_advice: string | null;
  total_interest: number | null;
  months_to_payoff: number | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface DebtPayment {
  id: string;
  user_id: string;
  debt_id: string;
  amount: number;
  payment_date: string;
  notes: string | null;
  created_at: string;
  debts?: Debt;
}

export interface DashboardStats {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  totalDebt: number;
  recentTransactions: Transaction[];
  upcomingPayments: ScheduledTransaction[];
}
