import { addDays, addMonths, addWeeks, addYears, format, parseISO, startOfDay } from "date-fns";
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

export function roundToTens(n: number): number {
  return Math.round(n / 10) * 10;
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
  
  if (loan.advanced_interest) {
    // If interest was collected upfront, it is fully realized immediately.
    return { expected, realized: expected };
  }

  const originalDue = totalAmount + interest;
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

export interface LoanStatus {
  isDelayed: boolean;
  daysDelayed: number;
  missedPayments: number;
  expectedTotal: number;
  actualTotal: number;
  delayedAmount: number;
  nextExpectedPaymentDate: string | null;
  expectedEndDate: string | null;
  isAhead: boolean;
  daysAhead: number;
  advancedPayments: number;
  advancedAmount: number;
}

export function getLoanStatus(loan: Loan): LoanStatus {
  if (!loan.start_date || loan.remaining_balance <= 0) {
    return { isDelayed: false, daysDelayed: 0, missedPayments: 0, expectedTotal: 0, actualTotal: 0, delayedAmount: 0, nextExpectedPaymentDate: null, expectedEndDate: null, isAhead: false, daysAhead: 0, advancedPayments: 0, advancedAmount: 0 };
  }

  const startDate = parseISO(loan.start_date);
  const today = startOfDay(new Date());

  const totalAmount = Number(loan.total_amount);
  const interest = (totalAmount * Number(loan.interest_rate)) / 100;
  const originalDue = loan.advanced_interest ? totalAmount : totalAmount + interest;
  const actualTotal = originalDue - Number(loan.remaining_balance);
  const installment = Number(loan.repayment_amount);

  const installmentsPaid = installment > 0 ? Math.floor(actualTotal / installment) : 0;
  
  let nextExpectedPaymentDate = null;
  if (installmentsPaid < loan.installments) {
    let nextDate = startDate;
    for (let i = 0; i < installmentsPaid; i++) {
      switch (loan.frequency) {
        case "daily": nextDate = addDays(nextDate, 1); break;
        case "weekly": nextDate = addWeeks(nextDate, 1); break;
        case "biweekly": nextDate = addWeeks(nextDate, 2); break;
        case "monthly": nextDate = addMonths(nextDate, 1); break;
        default: nextDate = addMonths(nextDate, 1); break;
      }
    }
    nextExpectedPaymentDate = format(nextDate, "yyyy-MM-dd");
  }

  let expectedEndDate = null;
  if (loan.installments > 0) {
    let endDate = startDate;
    for (let i = 1; i < loan.installments; i++) {
      switch (loan.frequency) {
        case "daily": endDate = addDays(endDate, 1); break;
        case "weekly": endDate = addWeeks(endDate, 1); break;
        case "biweekly": endDate = addWeeks(endDate, 2); break;
        case "monthly": endDate = addMonths(endDate, 1); break;
        default: endDate = addMonths(endDate, 1); break;
      }
    }
    expectedEndDate = format(endDate, "yyyy-MM-dd");
  }

  let chronExpectedOccurrences = 0;
  let chronDate = startDate;
  while (chronDate <= today && chronExpectedOccurrences < loan.installments) {
    chronExpectedOccurrences++;
    switch (loan.frequency) {
      case "daily": chronDate = addDays(chronDate, 1); break;
      case "weekly": chronDate = addWeeks(chronDate, 1); break;
      case "biweekly": chronDate = addWeeks(chronDate, 2); break;
      case "monthly": chronDate = addMonths(chronDate, 1); break;
      default: chronDate = addMonths(chronDate, 1); break;
    }
  }

  const expectedTotal = Math.min(chronExpectedOccurrences * installment, originalDue);
  const delayedAmount = Math.max(0, expectedTotal - actualTotal);
  const advancedAmount = Math.max(0, actualTotal - expectedTotal);
  
  const missedPayments = delayedAmount > 0 && installment > 0 ? Math.ceil(delayedAmount / installment) : 0;
  const advancedPayments = advancedAmount > 0 && installment > 0 ? Math.floor(advancedAmount / installment) : 0;
  
  let daysDelayed = 0;
  if (missedPayments > 0) {
    if (loan.frequency === "daily") daysDelayed = missedPayments * 1;
    else if (loan.frequency === "weekly") daysDelayed = missedPayments * 7;
    else if (loan.frequency === "biweekly") daysDelayed = missedPayments * 14;
    else if (loan.frequency === "monthly") daysDelayed = missedPayments * 30;
    else if (loan.frequency === "yearly") daysDelayed = missedPayments * 365;
  }

  let daysAhead = 0;
  if (advancedPayments > 0) {
    if (loan.frequency === "daily") daysAhead = advancedPayments * 1;
    else if (loan.frequency === "weekly") daysAhead = advancedPayments * 7;
    else if (loan.frequency === "biweekly") daysAhead = advancedPayments * 14;
    else if (loan.frequency === "monthly") daysAhead = advancedPayments * 30;
    else if (loan.frequency === "yearly") daysAhead = advancedPayments * 365;
  }

  return {
    isDelayed: delayedAmount > 0,
    daysDelayed,
    missedPayments,
    expectedTotal,
    actualTotal,
    delayedAmount,
    nextExpectedPaymentDate,
    expectedEndDate,
    isAhead: advancedAmount > 0,
    daysAhead,
    advancedPayments,
    advancedAmount
  };
}
