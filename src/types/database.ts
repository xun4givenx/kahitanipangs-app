export type CategoryType = "income" | "expense";
export type AccountType = "checking" | "savings" | "credit" | "cash" | "investment";
export type TransactionType = "income" | "expense" | "transfer";
export type Frequency = "daily" | "weekly" | "biweekly" | "monthly" | "yearly";
export type DebtStrategy = "avalanche" | "snowball";
export type LoanFrequency = "daily" | "weekly" | "biweekly" | "monthly";
export type LoanCollectionKind = "collection" | "withdrawal";

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
  loan_id: string | null;
  debt_id: string | null;
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

export interface Loan {
  id: string;
  user_id: string;
  person_name: string;
  total_amount: number;
  interest_rate: number;
  start_date: string;
  frequency: LoanFrequency;
  installments: number;
  repayment_amount: number;
  remaining_balance: number;
  advanced_interest: boolean;
  amount_released: number;
  savings_balance: number;
  created_at: string;
  updated_at: string;
}

export interface LoanCollection {
  id: string;
  user_id: string;
  loan_id: string;
  kind: LoanCollectionKind;
  collection_date: string;
  installment_amount: number;
  collected_amount: number;
  savings_delta: number;
  note: string | null;
  created_at: string;
}

export interface DashboardStats {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  totalDebt: number;
  recentTransactions: Transaction[];
  upcomingPayments: ScheduledTransaction[];
}

// ---- General Ledger (double-entry) ----
export type LedgerAccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type Book = "personal" | "business";
export type NormalBalance = "debit" | "credit";
export type JournalStatus = "draft" | "posted";

export interface LedgerAccount {
  id: string;
  user_id: string;
  code: string;
  name: string;
  type: LedgerAccountType;
  subtype: string | null;
  book: Book;
  normal_balance: NormalBalance;
  parent_id: string | null;
  is_active: boolean;
  description: string | null;
  created_at: string;
  updated_at: string;
}

export interface JournalEntry {
  id: string;
  user_id: string;
  entry_date: string;
  memo: string | null;
  reference: string | null;
  status: JournalStatus;
  created_at: string;
  updated_at: string;
}

export interface JournalLine {
  id: string;
  user_id: string;
  journal_entry_id: string;
  ledger_account_id: string;
  debit: number;
  credit: number;
  line_memo: string | null;
  created_at: string;
  ledger_accounts?: LedgerAccount;
}

export interface JournalEntryWithLines extends JournalEntry {
  journal_lines: JournalLine[];
}
