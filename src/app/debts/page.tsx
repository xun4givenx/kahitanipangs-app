"use client";

import { useEffect, useState } from "react";
import { CreditCard, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { CashRecordActions } from "@/components/cash-record-actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, formatDate } from "@/lib/utils/finance";
import type { Debt } from "@/types/database";

const emptyForm = { name: "", creditor: "", startingBalance: "", dueDate: "", dueDay: "" };

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);

  async function load() {
    const response = await fetch("/api/debts");
    if (!response.ok) return toast.error("Could not load debts");
    setDebts(await response.json());
  }

  useEffect(() => { void load(); }, []);

  async function createDebt(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/debts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Could not create debt account");
      toast.success("Debt account created");
      setForm(emptyForm);
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create debt account");
    } finally {
      setSaving(false);
    }
  }

  async function deleteDebt(debt: Debt) {
    if (!window.confirm(`Delete ${debt.name}? Its debt-payment link will be removed, but your cash-out records will remain.`)) return;
    const response = await fetch(`/api/debts/${debt.id}`, { method: "DELETE" });
    if (!response.ok) return toast.error("Could not delete debt account");
    toast.success("Debt account deleted");
    await load();
  }

  const activeDebts = debts.filter((debt) => debt.is_active && Number(debt.balance) > 0);
  const totalOwed = activeDebts.reduce((sum, debt) => sum + Number(debt.balance), 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="section-kicker">LIABILITIES</p>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Debt accounts</h1>
            <p className="mt-1 text-sm text-muted-foreground sm:text-base">Track what you owe separately from your cash and cash equivalents.</p>
          </div>
          <div className="dashboard-actions">
            <CashRecordActions onSuccess={() => void load()} />
            <Dialog open={open} onOpenChange={setOpen}>
              <DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add debt</Button></DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New debt account</DialogTitle></DialogHeader>
                <form className="space-y-4" onSubmit={createDebt}>
                  <div className="space-y-2"><Label htmlFor="debt-name">Debt name</Label><Input id="debt-name" placeholder="e.g. BPI credit card" value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} required /></div>
                  <div className="space-y-2"><Label htmlFor="debt-creditor">Creditor <span className="text-muted-foreground">(optional)</span></Label><Input id="debt-creditor" placeholder="e.g. BPI" value={form.creditor} onChange={(event) => setForm({ ...form, creditor: event.target.value })} /></div>
                  <div className="space-y-2"><Label htmlFor="debt-balance">Starting balance</Label><Input id="debt-balance" type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="₱0.00" value={form.startingBalance} onChange={(event) => setForm({ ...form, startingBalance: event.target.value })} required /><p className="text-xs text-muted-foreground">This records what you owe only. It does not change cash or cash flow.</p></div>
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2"><div className="space-y-2"><Label htmlFor="debt-due-date">Due date <span className="text-muted-foreground">(optional)</span></Label><Input id="debt-due-date" type="date" value={form.dueDate} onChange={(event) => setForm({ ...form, dueDate: event.target.value })} /></div><div className="space-y-2"><Label htmlFor="debt-due-day">Due day <span className="text-muted-foreground">(optional)</span></Label><Input id="debt-due-day" type="number" min="1" max="31" inputMode="numeric" value={form.dueDay} onChange={(event) => setForm({ ...form, dueDay: event.target.value })} /><p className="text-xs text-muted-foreground">Use this only for recurring weekly or monthly payments.</p></div></div>
                  <Button type="submit" className="w-full" disabled={saving}>{saving ? "Creating…" : "Create debt account"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="border-primary/20 bg-primary/5"><CardContent className="flex flex-col gap-1 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-primary">Total outstanding debt</p><strong className="text-3xl tracking-tight">{formatCurrency(totalOwed)}</strong></div><p className="max-w-md text-sm text-muted-foreground">Adding a debt is not a cash transaction. Its balance only changes when you record a cash-out as <strong>Debt payment</strong> and choose the debt account.</p></CardContent></Card>

        {activeDebts.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{activeDebts.map((debt) => {
          const original = Number(debt.original_balance) || Number(debt.balance);
          const paid = Math.max(0, original - Number(debt.balance));
          const percentage = original > 0 ? Math.min(100, Math.round((paid / original) * 100)) : 0;
          return <Card key={debt.id} className="overflow-hidden"><CardContent className="p-5"><div className="flex items-start justify-between gap-3"><div><h2 className="font-semibold">{debt.name}</h2>{debt.creditor && <p className="mt-1 text-sm text-muted-foreground">{debt.creditor}</p>}</div><div className="flex items-center gap-1"><CreditCard className="h-5 w-5 text-primary" /><Button type="button" variant="ghost" size="icon" className="text-muted-foreground hover:text-destructive" onClick={() => void deleteDebt(debt)} aria-label={`Delete ${debt.name}`}><Trash2 className="h-4 w-4" /></Button></div></div><p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Remaining balance</p><strong className="text-3xl tracking-tight">{formatCurrency(Number(debt.balance))}</strong><div className="mt-5 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} /></div><div className="mt-2 flex justify-between text-xs text-muted-foreground"><span>{formatCurrency(paid)} paid</span><span>of {formatCurrency(original)}</span></div>{(debt.due_date || debt.due_day) && <p className="mt-4 border-t pt-4 text-sm text-muted-foreground">{debt.due_date ? `Due ${formatDate(debt.due_date)}` : ""}{debt.due_date && debt.due_day ? " · " : ""}{debt.due_day ? `Recurring due day: ${debt.due_day}${ordinal(debt.due_day)}` : ""}</p>}</CardContent></Card>;
        })}</div> : <Card><CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center"><CreditCard className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No active debt accounts yet. Add a starting balance to begin tracking what you owe.</p></CardContent></Card>}
      </div>
    </AppShell>
  );
}

function ordinal(day: number) {
  const remainder = day % 100;
  if (remainder >= 11 && remainder <= 13) return "th";
  return ({ 1: "st", 2: "nd", 3: "rd" } as Record<number, string>)[day % 10] || "th";
}
