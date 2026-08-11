"use client";

import { useState } from "react";
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

const CASH_IN_OPTIONS = ["Salary", "Business / freelance", "Allowance", "Gift", "Prize / winning", "Refund", "Other income"];
const CASH_OUT_OPTIONS = EXPENSE_CATEGORIES;

export function QuickRecordDialog({ type, onSuccess }: { type: "income" | "expense"; onSuccess?: () => void }) {
  const [open, setOpen] = useState(false); const [saving, setSaving] = useState(false); const [amount, setAmount] = useState(""); const [category, setCategory] = useState(""); const [customCategory, setCustomCategory] = useState(""); const [subcategory, setSubcategory] = useState(""); const [note, setNote] = useState(""); const [date, setDate] = useState(getManilaToday()); const cashIn = type === "income"; const options = cashIn ? CASH_IN_OPTIONS : CASH_OUT_OPTIONS; const custom = category.startsWith("Other");
  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const categoryName = custom ? customCategory : category;
    if (!categoryName) return toast.error("Choose or type a category");

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Your session has expired. Please sign in again.");

      const { data: existingAccount, error: accountError } = await supabase
        .from("accounts")
        .select("id")
        .eq("name", "Cash wallet")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (accountError) throw accountError;

      let accountId = existingAccount?.id;
      if (!accountId) {
        const { data: account, error } = await supabase
          .from("accounts")
          .insert({ user_id: user.id, name: "Cash wallet", type: "cash", balance: 0, currency: "PHP", color: "#16845a" })
          .select("id")
          .single();
        if (error) throw error;
        accountId = account.id;
      }

      const cleanCategory = categoryName.trim();
      const { data: existingCategory, error: categoryError } = await supabase
        .from("categories")
        .select("id")
        .eq("name", cleanCategory)
        .eq("type", type)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (categoryError) throw categoryError;

      let categoryId = existingCategory?.id ?? null;
      if (!categoryId) {
        const { data: categoryRecord, error } = await supabase
          .from("categories")
          .insert({ user_id: user.id, name: cleanCategory, type, color: cashIn ? "#16845a" : "#d17a5e" })
          .select("id")
          .single();
        if (error) throw error;
        categoryId = categoryRecord.id;
      }

      const { error: transactionError } = await supabase.from("transactions").insert({
        user_id: user.id,
        account_id: accountId,
        category_id: categoryId,
        amount: Number(amount),
        type,
        description: subcategory.trim() || note.trim() || cleanCategory,
        notes: note.trim() || null,
        date,
      });
      if (transactionError) throw transactionError;

      toast.success(cashIn ? "Cash in recorded" : "Cash out recorded");
      window.dispatchEvent(new Event("cash-recorded"));
      setOpen(false);
      setAmount("");
      setCategory("");
      setCustomCategory("");
      setSubcategory("");
      setNote("");
      onSuccess?.();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not save this cash record");
    } finally {
      setSaving(false);
    }
  }
  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button className={cashIn ? "quick-income" : "quick-expense"}>{cashIn ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{cashIn ? "Cash in" : "Cash out"}</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>{cashIn ? "Record cash in" : "Record cash out"}</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={submit}><div className="space-y-2"><Label>Amount</Label><Input type="number" step="0.01" inputMode="decimal" autoFocus placeholder="₱0.00" value={amount} onChange={(event) => setAmount(event.target.value)} required /></div><div className="space-y-2"><Label>{cashIn ? "Where did this money come from?" : "What did you spend it on?"}</Label><Select value={category} onValueChange={setCategory}><SelectTrigger><SelectValue placeholder={cashIn ? "Choose a cash-in source" : "Choose a spending type"} /></SelectTrigger><SelectContent>{options.map((option) => <SelectItem key={option} value={option}><span className="category-select-option">{!cashIn && <CategoryIconBadge compact category={option} />}{option}</span></SelectItem>)}</SelectContent></Select></div>{custom && <div className="space-y-2"><Label>{cashIn ? "Cash-in source" : "Spending type"}</Label><Input placeholder="Type it here" value={customCategory} onChange={(event) => setCustomCategory(event.target.value)} required /></div>}<div className="space-y-2"><Label>Subcategory <span className="text-muted-foreground">(optional)</span></Label><Input placeholder={cashIn ? "e.g. Acme Corp or Client name" : "e.g. Converge, Meralco, or Grab"} value={subcategory} onChange={(event) => setSubcategory(event.target.value)} /></div><div className="space-y-2"><Label>Note <span className="text-muted-foreground">(optional)</span></Label><Input placeholder={cashIn ? "e.g. August payroll" : "e.g. Market basket"} value={note} onChange={(event) => setNote(event.target.value)} /></div><div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></div><Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving…" : "Save cash record"}</Button></form></DialogContent></Dialog>;
}
