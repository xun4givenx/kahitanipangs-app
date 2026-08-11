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
import type { Account, Category } from "@/types/database";

export function QuickRecordDialog({ type, onSuccess }: { type: "income" | "expense"; onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ account_id: "", category_id: "", amount: "", description: "", date: getManilaToday() });
  const isIncome = type === "income";

  useEffect(() => {
    if (!open) return;
    Promise.all([fetch("/api/accounts").then((response) => response.json()), fetch("/api/categories").then((response) => response.json())])
      .then(([accountData, categoryData]) => {
        setAccounts(Array.isArray(accountData) ? accountData : []);
        setCategories(Array.isArray(categoryData) ? categoryData.filter((category: Category) => category.type === type) : []);
      });
  }, [open, type]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    if (!form.account_id || !form.amount) return toast.error("Choose an account and enter an amount");
    setSaving(true);
    const response = await fetch("/api/transactions", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...form, amount: Number(form.amount), category_id: form.category_id || null, type }) });
    setSaving(false);
    if (!response.ok) return toast.error("Could not save this record");
    toast.success(isIncome ? "Money in recorded" : "Money out recorded");
    setOpen(false);
    setForm({ account_id: "", category_id: "", amount: "", description: "", date: getManilaToday() });
    onSuccess?.();
  }

  return <Dialog open={open} onOpenChange={setOpen}>
    <DialogTrigger asChild><Button className={isIncome ? "quick-income" : "quick-expense"}>{isIncome ? <ArrowUpRight className="h-4 w-4" /> : <ArrowDownRight className="h-4 w-4" />}{isIncome ? "Record money in" : "Record money out"}</Button></DialogTrigger>
    <DialogContent><DialogHeader><DialogTitle>{isIncome ? "Record money in" : "Record money out"}</DialogTitle></DialogHeader>
      <form className="space-y-4" onSubmit={submit}>
        <div className="space-y-2"><Label>Amount</Label><Input type="number" step="0.01" inputMode="decimal" placeholder="₱0.00" value={form.amount} onChange={(event) => setForm({ ...form, amount: event.target.value })} required /></div>
        <div className="space-y-2"><Label>Where did it go?</Label><Select value={form.account_id} onValueChange={(account_id) => setForm({ ...form, account_id })}><SelectTrigger><SelectValue placeholder="Choose shared account" /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>Category</Label><Select value={form.category_id} onValueChange={(category_id) => setForm({ ...form, category_id })}><SelectTrigger><SelectValue placeholder="Optional" /></SelectTrigger><SelectContent>{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select></div>
        <div className="space-y-2"><Label>What was it for?</Label><Input value={form.description} placeholder={isIncome ? "e.g. August salary" : "e.g. Sunday groceries"} onChange={(event) => setForm({ ...form, description: event.target.value })} /></div>
        <div className="space-y-2"><Label>Date</Label><Input type="date" value={form.date} onChange={(event) => setForm({ ...form, date: event.target.value })} required /></div>
        <Button type="submit" className="w-full" disabled={saving}>{saving ? "Saving…" : "Save record"}</Button>
      </form>
    </DialogContent>
  </Dialog>;
}
