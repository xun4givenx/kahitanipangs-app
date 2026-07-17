import { describe, expect, it } from "vitest";
import { collectionBalanceEffects } from "@/lib/server/ledger";

const loan = { remaining_balance: 800, savings_balance: 50, total_amount: 1000 };

describe("collectionBalanceEffects — edit", () => {
  it("increasing a collection's collected amount adds the difference to savings, leaves remaining untouched", () => {
    // existing: installment 100, collected 110 → savings_delta 10
    const existing = { kind: "collection" as const, installment_amount: 100, savings_delta: 10 };
    // new collected 130 → newSavingsDelta 30 (a +20 swing)
    const result = collectionBalanceEffects(loan, existing, { action: "edit", newSavingsDelta: 30 });
    expect(result.savings_balance).toBe(70); // 50 + (30 - 10)
    expect(result.remaining_balance).toBe(800); // unchanged
  });

  it("decreasing a collection below available savings clamps savings at 0", () => {
    const existing = { kind: "collection" as const, installment_amount: 100, savings_delta: 10 };
    // newSavingsDelta -100 → swing of -110, would drop savings to -60 → clamp 0
    const result = collectionBalanceEffects(loan, existing, { action: "edit", newSavingsDelta: -100 });
    expect(result.savings_balance).toBe(0);
    expect(result.remaining_balance).toBe(800);
  });

  it("editing a withdrawal amount adjusts savings by the swing, leaves remaining untouched", () => {
    // existing withdrawal of 20 → savings_delta -20
    const existing = { kind: "withdrawal" as const, installment_amount: 0, savings_delta: -20 };
    // new withdrawal of 5 → newSavingsDelta -5 (a +15 swing)
    const result = collectionBalanceEffects(loan, existing, { action: "edit", newSavingsDelta: -5 });
    expect(result.savings_balance).toBe(65); // 50 + (-5 - -20)
    expect(result.remaining_balance).toBe(800);
  });
});

describe("collectionBalanceEffects — delete", () => {
  it("deleting a collection restores the installment to remaining and removes its savings", () => {
    const existing = { kind: "collection" as const, installment_amount: 100, savings_delta: 10 };
    const result = collectionBalanceEffects(loan, existing, { action: "delete" });
    expect(result.remaining_balance).toBe(900); // 800 + 100
    expect(result.savings_balance).toBe(40); // 50 - 10
  });

  it("caps restored remaining at the loan's total_amount", () => {
    const nearlyFull = { remaining_balance: 950, savings_balance: 50, total_amount: 1000 };
    const existing = { kind: "collection" as const, installment_amount: 100, savings_delta: 0 };
    const result = collectionBalanceEffects(nearlyFull, existing, { action: "delete" });
    expect(result.remaining_balance).toBe(1000); // 950 + 100 capped at 1000
  });

  it("deleting a withdrawal restores the withdrawn amount to savings, leaves remaining untouched", () => {
    const existing = { kind: "withdrawal" as const, installment_amount: 0, savings_delta: -20 };
    const result = collectionBalanceEffects(loan, existing, { action: "delete" });
    expect(result.savings_balance).toBe(70); // 50 - (-20)
    expect(result.remaining_balance).toBe(800); // unchanged
  });

  it("clamps savings at 0 when deleting a collection whose savings exceed the current balance", () => {
    const lowSavings = { remaining_balance: 800, savings_balance: 5, total_amount: 1000 };
    const existing = { kind: "collection" as const, installment_amount: 100, savings_delta: 10 };
    const result = collectionBalanceEffects(lowSavings, existing, { action: "delete" });
    expect(result.savings_balance).toBe(0); // 5 - 10 clamped
  });
});
