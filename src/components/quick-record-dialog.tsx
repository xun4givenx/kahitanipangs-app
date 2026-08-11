"use client";

import { useEffect, useState } from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { getManilaToday } from "@/lib/utils/finance";
import { CategoryIconBadge, EXPENSE_CATEGORIES } from "@/components/category-icon";
import { createClient } from "@/lib/supabase/client";
import type { Account, Debt } from "@/types/database";

const CASH_IN_OPTIONS = ["Salary", "Business / freelance", "Allowance", "Gift", "Prize / winning", "Refund", "Other income"];
const CASH_OUT_OPTIONS = EXPENSE_CATEGORIES;

export function QuickRecordDialog({ type, onSuccess }: { type: "income" | "expense"; onSuccess?: () => void }) {
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false); const [amount, setAmount] = useState(""); const [category, setCategory] = useState(""); const [customCategory, setCustomCategory] = useState(""); const [subcategory, setSubcategory] = useState(""); const [note, setNote] = useState(""); const [date, setDate] = useState(getManilaToday()); const [suggestions, setSuggestions] = useState<string[]>([]); const [customCategorySuggestions, setCustomCategorySuggestions] = useState<string[]>([]); const [incomeAccounts, setIncomeAccounts] = useState<Account[]>([]); const [depositAccountId, setDepositAccountId] = useState(""); const [debts, setDebts] = useState<Debt[]>([]); const [debtId, setDebtId] = useState(""); const cashIn = type === "income"; const options = cashIn ? CASH_IN_OPTIONS : CASH_OUT_OPTIONS; const custom = category.startsWith("Other"); const isDebtPayment = !cashIn && category === "Debt payment"; const subcategoryListId = `cash-${type}-subcategory-options`; const customCategoryListId = `cash-${type}-custom-category-options`;

  useEffect(() => {
    if (!open || !cashIn) return;
    void createClient().from("accounts").select("*").eq("is_active", true).order("name").then(({ data, error }) => {
      if (error) return toast.error(error.message);
      const accounts = (data || []) as Account[];
      setIncomeAccounts(accounts);
      setDepositAccountId((current) => current || accounts.find((account) => account.type === "cash")?.id || accounts[0]?.id || "cash-wallet");
    });
  }, [open, cashIn]);

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
    if (!open || !custom) {
      setCustomCategorySuggestions([]);
      return;
    }

    let cancelled = false;
    void createClient().from("categories").select("name").eq("type", type).order("name").then(({ data, error }) => {
      if (error || cancelled) return;
      setCustomCategorySuggestions(Array.from(new Set(
        (data || []).map((record) => record.name.trim()).filter((name) => name && !options.includes(name))
      )));
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
      const { data: categoryRecord, error: categoryError } = await supabase
        .from("categories")
        .select("id")
        .eq("name", categoryName)
        .eq("type", type)
        .maybeSingle();
      if (categoryError || !categoryRecord || cancelled) return;

      const { data: records, error } = await supabase
        .from("transactions")
        .select("description")
        .eq("category_id", categoryRecord.id)
        .eq("type", type)
        .order("date", { ascending: false })
        .limit(50);
      if (error || cancelled) return;

      setSuggestions(Array.from(new Set(
        (records || [])
          .map((record) => record.description?.trim())
          .filter((value): value is string => Boolean(value) && value !== categoryName)
      )));
    }

    void loadSuggestions();
    return () => { cancelled = true; };
  }, [open, cashIn, category, customCategory, custom, type]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const categoryName = custom ? customCategory : category;
    if (!categoryName) return toast.error("Choose or type a category");
    if (isDebtPayment && !debtId) return toast.error("Choose the debt you are paying");

    setSaving(true);
    try {
      const response = await fetch("/api/cash", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(amount), type, categoryName: categoryName.trim(), subcategoryName: subcategory.trim(), description: note.trim(), date,
          accountId: cashIn ? depositAccountId || null : null,
          debtId: isDebtPayment ? debtId : null,
        }),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Could not save this cash record");

      toast.success(isDebtPayment ? "Debt payment recorded" : cashIn ? "Cash in recorded" : "Cash out recorded");
      window.dispatchEvent(new Event("cash-recorded"));
      setOpen(false);
      setAmount("");
      setCategory("");
      setCustomCategory("");
      setSubcategory("");
      setNote("");
      setDepositAccountId("");
      setDebtId("");
      onSuccess?.();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : typeof error === "object" && error !== null && "message" in error && typeof error.message === "string"
            ? error.message
            : "Could not save this cash record";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className={cashIn ? "quick-income" : "quick-expense"}>{cashIn ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{cashIn ? "Cash in" : "Cash out"}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{cashIn ? "Record cash in" : "Record cash out"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={submit}><div className="space-y-2"><Label>Amount</Label><Input type="number" step="0.01" inputMode="decimal" autoFocus placeholder="₱0.00" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div>{cashIn && <div className="space-y-2"><Label>Deposit to</Label><Select value={depositAccountId} onValueChange={setDepositAccountId}><SelectTrigger><SelectValue placeholder="Choose where to deposit it" /></SelectTrigger><SelectContent>{incomeAccounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}{!incomeAccounts.some((account) => account.type === "cash") && <SelectItem value="cash-wallet">Cash wallet</SelectItem>}</SelectContent></Select></div>}<div className="space-y-2"><Label>{cashIn ? "Where did this money come from?" : "What did you spend it on?"}</Label><Select value={category} onValueChange={(value) => { setCategory(value); if (value !== "Debt payment") setDebtId(""); }}><SelectTrigger><SelectValue placeholder={cashIn ? "Choose a cash-in source" : "Choose a spending type"} /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option} value={option}><span className="category-select-option">{!cashIn && <CategoryIconBadge compact category={option} />}{option}</span></SelectItem>)}</SelectContent></Select></div>{isDebtPayment && <div className="space-y-2"><Label>Debt account</Label><Select value={debtId} onValueChange={setDebtId}><SelectTrigger><SelectValue placeholder="Choose the debt to pay" /></SelectTrigger><SelectContent>{debts.length ? debts.map((debt) => <SelectItem key={debt.id} value={debt.id}>{debt.name} · {Number(debt.balance).toLocaleString("en-PH", { style: "currency", currency: "PHP" })} remaining</SelectItem>) : <SelectItem value="no-debt" disabled>Create a debt account first</SelectItem>}</SelectContent></Select></div>}{custom && <div className="space-y-2"><Label>{cashIn ? "Cash-in source" : "Spending type"}</Label><Input list={customCategoryListId} placeholder="Type or choose a saved value" value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} required /><datalist id={customCategoryListId}>{customCategorySuggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>{customCategorySuggestions.length > 0 && <p className="text-xs text-muted-foreground">Choose a previously used type or enter a new one.</p>}</div>}{!isDebtPayment && <div className="space-y-2"><Label>Subcategory <span className="text-muted-foreground">(optional)</span></Label><Input list={subcategoryListId} placeholder={cashIn ? "e.g. Acme Corp or Client name" : "e.g. Converge, Meralco, or Grab"} value={subcategory} onChange={(event) => setSubcategory(event.target.value)} /><datalist id={subcategoryListId}>{suggestions.map((suggestion) => <option key={suggestion} value={suggestion} />)}</datalist>{suggestions.length > 0 && <p className="text-xs text-muted-foreground">Choose a previously used subcategory or type a new one.</p>}</div>}<div className="space-y-2"><Label>Note <span className="text-muted-foreground">(optional)</span></Label><Input placeholder={isDebtPayment ? "e.g. August payment" : cashIn ? "e.g. August payroll" : "e.g. Market basket"} value={note} onChange={(event) => setNote(event.target.value)} /></div><div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></div><Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving…" : isDebtPayment ? "Record debt payment" : "Save cash record"}</Button></form></DialogContent></Dialog>;
}
