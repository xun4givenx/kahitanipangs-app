import { addDays, addMonths, addWeeks, addYears, format, parseISO } from "date-fns";
import type { Debt, DebtPlanMonth, DebtStrategy, Loan } from "@/types/database";

export function formatCurrency(amount: number, currency = "PHP") {
  return new Intl.NumberFormat("en-PH", {
    style: "currency",
    currency,
  }).format(amount);
}

export function formatDate(date: string) {
  return format(parseISO(date), "MMM d, yyyy");
}

export function roundUpToTens(n: number): number {
  return Math.ceil(n / 10) * 10;
}

type LoanProfitInput = Pick<
  Loan,
  "total_amount" | "interest_rate" | "advanced_interest" | "amount_released" | "remaining_balance"
>;

/**
 * Computes expected (full interest) and realized (cash-basis) profit for a loan.
 * See docs/superpowers/specs/2026-07-16-loan-cash-and-profit-design.md ("Profit definitions").
 */
export function loanProfit(loan: LoanProfitInput): { expected: number; realized: number } {
  const totalAmount = Number(loan.total_amount);
  const interest = (totalAmount * Number(loan.interest_rate)) / 100;
  const expected = interest;
  const originalDue = loan.advanced_interest ? totalAmount : totalAmount + interest;
  const recovered = originalDue - Number(loan.remaining_balance);
  const realized = Math.min(Math.max(recovered - Number(loan.amount_released), 0), expected);

  return { expected, realized };
}

export function getNextOccurrence(
  current: string,
  frequency: string
): string {
  const date = parseISO(current);
  let next: Date;
  switch (frequency) {
    case "daily":
      next = addDays(date, 1);
      break;
    case "weekly":
      next = addWeeks(date, 1);
      break;
    case "biweekly":
      next = addWeeks(date, 2);
      break;
    case "monthly":
      next = addMonths(date, 1);
      break;
    case "yearly":
      next = addYears(date, 1);
      break;
    default:
      next = addMonths(date, 1);
  }
  return format(next, "yyyy-MM-dd");
}

interface DebtState {
  id: string;
  name: string;
  balance: number;
  interest_rate: number;
  minimum_payment: number;
}

export function calculateDebtPayoff(
  debts: Debt[],
  monthlyBudget: number,
  strategy: DebtStrategy
): { schedule: DebtPlanMonth[]; totalInterest: number; monthsToPayoff: number } {
  const activeDebts: DebtState[] = debts
    .filter((d) => d.is_active && d.balance > 0)
    .map((d) => ({
      id: d.id,
      name: d.name,
      balance: Number(d.balance),
      interest_rate: Number(d.interest_rate),
      minimum_payment: Number(d.minimum_payment),
    }));

  if (activeDebts.length === 0) {
    return { schedule: [], totalInterest: 0, monthsToPayoff: 0 };
  }

  const schedule: DebtPlanMonth[] = [];
  let totalInterest = 0;
  let month = 0;
  const maxMonths = 600;

  while (activeDebts.some((d) => d.balance > 0.01) && month < maxMonths) {
    month++;
    let monthInterest = 0;
    const payments: DebtPlanMonth["payments"] = [];

    for (const debt of activeDebts) {
      if (debt.balance <= 0) continue;
      const monthlyRate = debt.interest_rate / 100 / 12;
      const interest = debt.balance * monthlyRate;
      monthInterest += interest;
      debt.balance += interest;
    }

    totalInterest += monthInterest;

    let remaining = monthlyBudget;
    for (const debt of activeDebts) {
      if (debt.balance <= 0) continue;
      const payment = Math.min(debt.minimum_payment, debt.balance, remaining);
      debt.balance -= payment;
      remaining -= payment;
      payments.push({
        debt_id: debt.id,
        debt_name: debt.name,
        payment,
        remaining: Math.max(debt.balance, 0),
      });
    }

    const openDebts = activeDebts.filter((d) => d.balance > 0.01);
    if (openDebts.length > 0 && remaining > 0) {
      const sorted = [...openDebts].sort((a, b) => {
        if (strategy === "avalanche") {
          return b.interest_rate - a.interest_rate || b.balance - a.balance;
        }
        return a.balance - b.balance || b.interest_rate - a.interest_rate;
      });

      const target = sorted[0];
      const extra = Math.min(remaining, target.balance);
      target.balance -= extra;
      const existing = payments.find((p) => p.debt_id === target.id);
      if (existing) {
        existing.payment += extra;
        existing.remaining = Math.max(target.balance, 0);
      }
    }

    schedule.push({
      month,
      payments,
      total_paid: payments.reduce((s, p) => s + p.payment, 0),
      total_interest: monthInterest,
    });
  }

  return {
    schedule,
    totalInterest: Math.round(totalInterest * 100) / 100,
    monthsToPayoff: month,
  };
}

export const ACCOUNT_TYPES = [
  { value: "checking", label: "Checking" },
  { value: "savings", label: "Savings" },
  { value: "credit", label: "Credit Card" },
  { value: "cash", label: "Cash" },
  { value: "investment", label: "Investment" },
] as const;

export const CATEGORY_COLORS = [
  "#6366f1", "#8b5cf6", "#ec4899", "#ef4444", "#f97316",
  "#eab308", "#22c55e", "#14b8a6", "#06b6d4", "#3b82f6",
];

export const FREQUENCIES = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "yearly", label: "Yearly" },
] as const;
