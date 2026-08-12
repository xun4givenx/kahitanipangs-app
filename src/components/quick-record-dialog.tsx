"use client";

import { useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getManilaToday } from "@/lib/utils/finance";
import { CategoryIconBadge, getExpenseCategoryOptions } from "@/components/category-icon";
import { createClient } from "@/lib/supabase/client";
import type { Account, Category, Debt, Loan } from "@/types/database";

const CASH_IN_OPTIONS = ["Salary", "Business / freelance", "Allowance", "Gift", "Prize / winning", "Refund", "Loan collection", "Other income"];

export function QuickRecordDialog({ type, onSuccess }: { type: "income" | "expense"; onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [customCategory, setCustomCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [note, setNote] = useState("");
  const [date, setDate] = useState(getManilaToday());
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [customCategorySuggestions, setCustomCategorySuggestions] = useState<string[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [depositAccountId, setDepositAccountId] = useState("");
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtId, setDebtId] = useState("");
  const [loans, setLoans] = useState<Loan[]>([]);
  const [loanId, setLoanId] = useState("");
  const [savedCategories, setSavedCategories] = useState<Category[]>([]);
  const cashIn = type === "income";
  const options = useMemo(
    () => cashIn
      ? Array.from(new Set([...CASH_IN_OPTIONS, ...savedCategories.filter((item) => item.type === type).map((item) => item.name)]))
      : getExpenseCategoryOptions(savedCategories),
    [cashIn, savedCategories, type]
  );
  const custom = category.startsWith("Other");
  const isDebtPayment = !cashIn && category.toLowerCase() === "debt payment";
  const isLoanCollection = cashIn && category.toLowerCase() === "loan collection";
  const subcategoryListId = `cash-${type}-subcategory-options`;
  const customCategoryListId = `cash-${type}-custom-category-options`;

  useEffect(() => {
    if (!open) return;
    void createClient().from("accounts").select("*").eq("is_active", true).order("name").then(({ data, error }) => {
      if (error) return toast.error(error.message);
      const accountRows = (data || []) as Account[];
      setAccounts(accountRows);
      setDepositAccountId((current) => current || accountRows.find((account) => account.type === "cash")?.id || accountRows[0]?.id || "cash-wallet");
    });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void fetch("/api/categories")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((records: Category[]) => { if (!cancelled) setSavedCategories(records); })
      .catch(() => { if (!cancelled) setSavedCategories([]); });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open || cashIn) return;
    let cancelled = false;
    void fetch("/api/debts")
      .then((response) => response.ok ? response.json() : Promise.reject(new Error("Could not load debts")))
      .then((records: Debt[]) => { if (!cancelled) setDebts(records.filter((debt) => debt.is_active && Number(debt.balance) > 0)); })
      .catch((error: unknown) => { if (!cancelled) toast.error(error instanceof Error ? error.message : "Could not load debts"); });
    return () => { cancelled = true; };
  }, [open, cashIn]);

  useEffect(() => {
    if (!open || !cashIn) return;
    let cancelled = false;
    void fetch("/api/loans")
      .then((response) => response.ok ? response.json() : Promise.reject())
      .then((records: Loan[]) => { if (!cancelled) setLoans(records.filter((loan) => Number(loan.remaining_balance) > 0)); })
      .catch(() => { if (!cancelled) setLoans([]); });
    return () => { cancelled = true; };
  }, [open, cashIn]);

  useEffect(() => {
    if (!open || !custom) {
      setCustomCategorySuggestions([]);
      return;
    }
    let cancelled = false;
    void createClient().from("categories").select("name").eq("type", type).order("name").then(({ data, error }) => {
      if (error || cancelled) return;
      setCustomCategorySuggestions(Array.from(new Set((data || []).map((record) => record.name.trim()).filter((name) => name && !options.includes(name)))));
    });
    return () => { cancelled = true; };
  }, [open, custom, options, type]);

  useEffect(() => {
    const categoryName = (custom ? customCategory : category).trim();
    if (!open || cashIn || !categoryName) {
      setSuggestions([]);
      return;
    }
    let cancelled = false;
    async function loadSuggestions() {
      const supabase = createClient();
      const { data: categoryRecord, error: categoryError } = await supabase.from("categories").select("id").eq("name", categoryName).eq("type", type).maybeSingle();
      if (categoryError || !categoryRecord || cancelled) return;
      const { data: records, error } = await supabase.from("transactions").select("description").eq("category_id", categoryRecord.id).eq("type", type).order("date", { ascending: false }).limit(50);
      if (error || cancelled) return;
      setSuggestions(Array.from(new Set((records || []).map((record) => record.description?.trim()).filter((value): value is string => Boolean(value) && value !== categoryName))));
    }
    void loadSuggestions();
    return () => { cancelled = true; };
  }, [open, cashIn, category, customCategory, custom, type]);

  function reset() {
    setAmount("");
    setCategory("");
    setCustomCategory("");
    setSubcategory("");
    setNote("");
    setDepositAccountId("");
    setDebtId("");
    setLoanId("");
  }

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const categoryName = custom ? customCategory : category;
    if (!categoryName) return toast.error("Choose or type a category");
    if (isDebtPayment && !debtId) return toast.error("Choose the debt you are paying");
    if (isLoanCollection && !loanId) return toast.error("Choose the loan collection");
    setSaving(true);
    try {
      const response = await fetch("/api/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ amount: Number(amount), type, categoryName: categoryName.trim(), subcategoryName: subcategory.trim(), description: note.trim(), date, accountId: depositAccountId || null, debtId: isDebtPayment ? debtId : null, loanId: isLoanCollection ? loanId : null }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Could not save this cash record");
      toast.success(isDebtPayment ? "Debt payment recorded" : isLoanCollection ? "Loan collection recorded" : cashIn ? "Cash in recorded" : "Cash out recorded");
      window.dispatchEvent(new Event("cash-recorded"));
      setOpen(false);
      reset();
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this cash record");
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open={open} onOpenChange={(value) => { setOpen(value); if (!value) reset(); }}><DialogTrigger asChild><Button className={cashIn ? "quick-income" : "quick-expense"}>{cashIn ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{cashIn ? "Cash in" : "Cash out"}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{cashIn ? "Record cash in" : "Record cash out"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={submit}><div className="space-y-2"><Label>Amount</Label><Input type="number" step="0.01" inputMode="decimal" autoFocus placeholder="₱0.00" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div><div className="space-y-2"><Label>{cashIn ? "Deposit to" : "Fund source"}</Label><Select value={depositAccountId} onValueChange={setDepositAccountId}><SelectTrigger><SelectValue placeholder={cashIn ? "Choose where to deposit it" : "Choose the account being used"} /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}{!accounts.some((account) => account.type === "cash") && <SelectItem value="cash-wallet">Cash wallet</SelectItem>}</SelectContent></Select>{!cashIn && <p className="text-xs text-muted-foreground">Cash out will be deducted from this account.</p>}</div><div className="space-y-2"><Label>{cashIn ? "Where did this money come from?" : "What did you spend it on?"}</Label><Select value={category} onValueChange={(value) => { setCategory(value); if (value !== "Debt payment") setDebtId(""); if (value !== "Loan collection") setLoanId(""); }}><SelectTrigger><SelectValue placeholder={cashIn ? "Choose a cash-in source" : "Choose a spending type"} /></SelectTrigger><SelectContent>{options.map((option) => { const saved = savedCategories.find((item) => item.type === type && item.name === option); return <SelectItem key={option} value={option}><span className="category-select-option">{!cashIn && <CategoryIconBadge compact category={option} icon={saved?.icon} />}{option}</span></SelectItem>; })}</SelectContent></Select></div>{isLoanCollection && <div className="space-y-2"><Label>Loan account</Label><Select value={loanId} onValueChange={setLoanId}><SelectTrigger><SelectValue placeholder="Choose the person who paid" /></SelectTrigger><SelectContent>{loans.length ? loans.map((loan) => <SelectItem key={loan.id} value={loan.id}>{loan.person_name} · {Number(loan.remaining_balance).toLocaleString("en-PH", { style: "currency", currency: "PHP" })} outstanding</SelectItem>) : <SelectItem value="no-loan" disabled>Create a loan account first</SelectItem>}</SelectContent></Select><p className="text-xs text-muted-foreground">The collection reduces this person&apos;s outstanding loan and deposits the cash above.</p></div>}{isDebtPayment && <div className="space-y-2"><Label>Debt account</Label><Select value={debtId} onValueChange={setDebtId}><SelectTrigger><SelectValue placeholder="Choose the debt to pay" /></SelectTrigger><SelectContent>{debts.length ? debts.map((debt) => <SelectItem key={debt.id} value={debt.id}>{debt.name} · {Number(debt.balance).toLocaleString("en-PH", { style: "currency", currency: "PHP" })} remaining</SelectItem>) : <SelectItem value="no-debt" disabled>Create a debt account first</SelectItem>}</SelectContent></Select></div>}{custom && <div className="space-y-2"><Label>{cashIn ? "Cash-in source" : "Spending type"}</Label><Input list={customCategoryListId} placeholder="Type or choose a saved value" value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} required /><datalist id={customCategoryListId}>{customCategorySuggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist></div>}{!isDebtPayment && <div className="space-y-2"><Label>Subcategory <span className="text-muted-foreground">(optional)</span></Label><Input list={subcategoryListId} placeholder={cashIn ? "e.g. Acme Corp or Client name" : "e.g. Converge, Meralco, or Grab"} value={subcategory} onChange={(event) => setSubcategory(event.target.value)} /><datalist id={subcategoryListId}>{suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist></div>}<div className="space-y-2"><Label>Note <span className="text-muted-foreground">(optional)</span></Label><Input placeholder={isDebtPayment ? "e.g. August payment" : cashIn ? "e.g. August payroll" : "e.g. Market basket"} value={note} onChange={(event) => setNote(event.target.value)} /></div><div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></div><Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving…" : isDebtPayment ? "Record debt payment" : isLoanCollection ? "Record loan collection" : "Save cash record"}</Button></form></DialogContent></Dialog>;
}
