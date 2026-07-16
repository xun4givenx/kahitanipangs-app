import { describe, it, expect } from "vitest";
import {
  normalBalanceFor,
  isBalanced,
  validateLine,
  validatePostedLines,
  computeAccountBalance,
  buildTrialBalance,
  DEFAULT_COA,
  type JournalLineInput,
} from "@/lib/server/ledger-gl";

const acc = (
  id: string,
  code: string,
  type: "asset" | "liability" | "equity" | "income" | "expense",
  book: "personal" | "business"
) => ({ id, code, name: code, type, book, normal_balance: normalBalanceFor(type) });

describe("normalBalanceFor", () => {
  it("assets and expenses are debit-normal", () => {
    expect(normalBalanceFor("asset")).toBe("debit");
    expect(normalBalanceFor("expense")).toBe("debit");
  });
  it("liability, equity, income are credit-normal", () => {
    expect(normalBalanceFor("liability")).toBe("credit");
    expect(normalBalanceFor("equity")).toBe("credit");
    expect(normalBalanceFor("income")).toBe("credit");
  });
});

describe("validateLine", () => {
  it("accepts a line with exactly one positive side", () => {
    expect(validateLine({ ledger_account_id: "a", debit: 100, credit: 0 }).ok).toBe(true);
    expect(validateLine({ ledger_account_id: "a", debit: 0, credit: 100 }).ok).toBe(true);
  });
  it("rejects a line with both sides positive", () => {
    expect(validateLine({ ledger_account_id: "a", debit: 50, credit: 50 }).ok).toBe(false);
  });
  it("rejects a line with neither side positive", () => {
    expect(validateLine({ ledger_account_id: "a", debit: 0, credit: 0 }).ok).toBe(false);
  });
  it("rejects negative amounts", () => {
    expect(validateLine({ ledger_account_id: "a", debit: -10, credit: 0 }).ok).toBe(false);
  });
});

describe("isBalanced / validatePostedLines", () => {
  const balanced: JournalLineInput[] = [
    { ledger_account_id: "a", debit: 100, credit: 0 },
    { ledger_account_id: "b", debit: 0, credit: 100 },
  ];
  it("accepts a balanced 2-line entry", () => {
    expect(isBalanced(balanced)).toBe(true);
    expect(validatePostedLines(balanced).ok).toBe(true);
  });
  it("rejects an unbalanced posted entry", () => {
    const bad = [
      { ledger_account_id: "a", debit: 100, credit: 0 },
      { ledger_account_id: "b", debit: 0, credit: 90 },
    ];
    expect(isBalanced(bad)).toBe(false);
    expect(validatePostedLines(bad).ok).toBe(false);
  });
  it("rejects a posted entry with fewer than 2 lines", () => {
    expect(validatePostedLines([{ ledger_account_id: "a", debit: 100, credit: 0 }]).ok).toBe(false);
  });
  it("tolerates sub-centavo float noise", () => {
    const noisy = [
      { ledger_account_id: "a", debit: 0.1 + 0.2, credit: 0 },
      { ledger_account_id: "b", debit: 0, credit: 0.3 },
    ];
    expect(isBalanced(noisy)).toBe(true);
  });
});

describe("computeAccountBalance", () => {
  it("debit-normal balance = debit - credit", () => {
    expect(computeAccountBalance("debit", 500, 200)).toBe(300);
  });
  it("credit-normal balance = credit - debit", () => {
    expect(computeAccountBalance("credit", 200, 500)).toBe(300);
  });
});

describe("buildTrialBalance", () => {
  const accounts = [
    acc("cash", "1000", "asset", "business"),
    acc("income", "4000", "income", "business"),
    acc("pcash", "1000", "asset", "personal"),
    acc("draw", "3200", "equity", "personal"),
  ];

  it("nets to zero across balanced entries", () => {
    const lines = [
      { ledger_account_id: "cash", debit: 1000, credit: 0 },
      { ledger_account_id: "income", debit: 0, credit: 1000 },
    ];
    const tb = buildTrialBalance(accounts, lines);
    expect(tb.total_debits).toBe(1000);
    expect(tb.total_credits).toBe(1000);
    expect(tb.balanced).toBe(true);
  });

  it("cross-book bridge: each book balances independently", () => {
    // Personal wallet (personal) pays a business fee via Owner's equity bridge.
    const bizFee = acc("fee", "5100", "expense", "business");
    const bizContrib = acc("contrib", "3100", "equity", "business");
    const allAccounts = [...accounts, bizFee, bizContrib];
    const lines = [
      { ledger_account_id: "fee", debit: 100, credit: 0 }, // business expense up
      { ledger_account_id: "contrib", debit: 0, credit: 100 }, // business equity up
      { ledger_account_id: "draw", debit: 100, credit: 0 }, // personal drawings up
      { ledger_account_id: "pcash", debit: 0, credit: 100 }, // personal cash down
    ];
    const bizTb = buildTrialBalance(allAccounts, lines, "business");
    const perTb = buildTrialBalance(allAccounts, lines, "personal");
    expect(bizTb.total_debits).toBe(100);
    expect(bizTb.total_credits).toBe(100);
    expect(bizTb.balanced).toBe(true);
    expect(perTb.total_debits).toBe(100);
    expect(perTb.total_credits).toBe(100);
    expect(perTb.balanced).toBe(true);
  });
});

describe("DEFAULT_COA template", () => {
  it("has unique codes and every account maps to a known type", () => {
    const codes = DEFAULT_COA.map((a) => a.code);
    expect(new Set(codes).size).toBe(codes.length);
    for (const a of DEFAULT_COA) {
      expect(["asset", "liability", "equity", "income", "expense"]).toContain(a.type);
    }
  });
  it("includes the loan-niche and equity-bridge accounts", () => {
    const names = DEFAULT_COA.map((a) => a.name);
    expect(names).toContain("Loans Receivable");
    expect(names).toContain("Cash on Collected Loans");
    expect(names).toContain("Owner's Contributions");
    expect(names).toContain("Owner's Drawings");
  });
});
