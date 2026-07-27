import { parseISO, startOfDay, addDays } from "date-fns";

const loan = {
  start_date: "2026-07-26",
  total_amount: 3000,
  interest_rate: 15,
  advanced_interest: true,
  remaining_balance: 2500,
  repayment_amount: 100,
  installments: 30,
  frequency: "daily"
};

const startDate = parseISO(loan.start_date);
const today = startOfDay(new Date("2026-07-27T12:00:00-04:00"));

const totalAmount = Number(loan.total_amount);
const interest = (totalAmount * Number(loan.interest_rate)) / 100;
const originalDue = loan.advanced_interest ? totalAmount : totalAmount + interest;
const actualTotal = originalDue - Number(loan.remaining_balance);
const installment = Number(loan.repayment_amount);

let chronExpectedOccurrences = 0;
let chronDate = startDate;
while (chronDate <= today && chronExpectedOccurrences < loan.installments) {
  chronExpectedOccurrences++;
  chronDate = addDays(chronDate, 1);
}

const expectedTotal = Math.min(chronExpectedOccurrences * installment, originalDue);
const advancedAmount = Math.max(0, actualTotal - expectedTotal);
const advancedPayments = advancedAmount > 0 && installment > 0 ? Math.floor(advancedAmount / installment) : 0;

console.log({
  startDate,
  today,
  chronExpectedOccurrences,
  expectedTotal,
  actualTotal,
  advancedAmount,
  advancedPayments
});
