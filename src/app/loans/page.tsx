"use client";

import { useEffect, useState } from "react";
import { HandCoins, Plus, Trash2, UserRound } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { CashRecordActions } from "@/components/cash-record-actions";
import { TAccount } from "@/components/t-account";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { formatCurrency, getManilaToday } from "@/lib/utils/finance";
import type { Loan, LoanCollection, Transaction } from "@/types/database";

const emptyForm = { personName: "", startingBalance: "", startDate: getManilaToday() };

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [detail, setDetail] = useState<{ loan: Loan; collections: LoanCollection[]; transactions: Transaction[] } | null>(null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  async function load() {
    const response = await fetch("/api/loans");
    if (!response.ok) return toast.error("Could not load loan accounts");
    setLoans(await response.json());
  }

  useEffect(() => { void load(); }, []);

  async function createLoan(event: React.FormEvent) {
    event.preventDefault();
    setSaving(true);
    try {
      const response = await fetch("/api/loans", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(form) });
      const payload = await response.json().catch(() => null) as { error?: string } | null;
      if (!response.ok) throw new Error(payload?.error || "Could not create loan account");
      toast.success("Loan account created");
      setForm(emptyForm);
      setOpen(false);
      await load();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not create loan account");
    } finally {
      setSaving(false);
    }
  }

  async function openLoan(loan: Loan) {
    setLoadingDetail(true);
    try {
      const response = await fetch(`/api/loans/${loan.id}`);
      if (!response.ok) throw new Error();
      setDetail(await response.json());
    } catch {
      toast.error("Could not load loan activity");
    } finally {
      setLoadingDetail(false);
    }
  }

  async function deleteLoan(loan: Loan) {
    if (!window.confirm(`Delete ${loan.person_name}'s loan account? Linked collection mappings will be removed, but cash records will remain.`)) return;
    const response = await fetch(`/api/loans/${loan.id}`, { method: "DELETE" });
    if (!response.ok) return toast.error("Could not delete loan account");
    toast.success("Loan account deleted");
    setDetail(null);
    await load();
  }

  const totalOutstanding = loans.reduce((sum, loan) => sum + Number(loan.remaining_balance), 0);

  return <AppShell><div className="space-y-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between"><div><p className="section-kicker">RECEIVABLES</p><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Loans out</h1><p className="mt-1 text-sm text-muted-foreground sm:text-base">Track individual loans separately. Cash only moves when a collection is deposited.</p></div><div className="dashboard-actions"><CashRecordActions onSuccess={() => void load()} /><Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button><Plus className="mr-2 h-4 w-4" />Add loan</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>New loan account</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={createLoan}><div className="space-y-2"><Label>Person</Label><Input placeholder="e.g. Juan dela Cruz" value={form.personName} onChange={(event) => setForm({ ...form, personName: event.target.value })} required /></div><div className="space-y-2"><Label>Starting balance</Label><Input type="number" min="0.01" step="0.01" inputMode="decimal" placeholder="₱0.00" value={form.startingBalance} onChange={(event) => setForm({ ...form, startingBalance: event.target.value })} required /><p className="text-xs text-muted-foreground">This records the amount receivable only. It does not change cash until a collection is recorded.</p></div><div className="space-y-2"><Label>Loan date</Label><Input type="date" value={form.startDate} onChange={(event) => setForm({ ...form, startDate: event.target.value })} required /></div><Button type="submit" className="w-full" disabled={saving}>{saving ? "Creating…" : "Create loan account"}</Button></form></DialogContent></Dialog></div></div><Card className="border-primary/20 bg-primary/5"><CardContent className="flex flex-col gap-1 p-5 sm:flex-row sm:items-center sm:justify-between"><div><p className="text-sm font-semibold text-primary">Total receivable</p><strong className="text-3xl tracking-tight">{formatCurrency(totalOutstanding)}</strong></div><p className="max-w-md text-sm text-muted-foreground">Create one card per person. When they pay, record Cash in as <strong>Loan collection</strong>, choose the person, and choose where the cash was deposited.</p></CardContent></Card>{loans.length ? <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">{loans.map((loan) => <Card key={loan.id} className="cursor-pointer transition-colors hover:bg-accent/40" role="button" tabIndex={0} onClick={() => void openLoan(loan)} onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void openLoan(loan); } }}><CardContent className="p-5"><div className="flex items-start justify-between"><div><h2 className="font-semibold">{loan.person_name}</h2><p className="mt-1 text-sm text-muted-foreground">Loan account</p></div><HandCoins className="h-5 w-5 text-primary" /></div><p className="mt-6 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Outstanding</p><strong className="mt-1 block text-3xl tracking-tight">{formatCurrency(Number(loan.remaining_balance))}</strong><p className="mt-3 text-xs text-muted-foreground">Original balance {formatCurrency(Number(loan.total_amount))}</p></CardContent></Card>)}</div> : <Card><CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center"><UserRound className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No loan accounts yet. Add one for each person who owes you money.</p></CardContent></Card>}<Dialog open={Boolean(detail) || loadingDetail} onOpenChange={(value) => { if (!value) setDetail(null); }}><DialogContent className="sm:max-w-2xl">{loadingDetail && !detail ? <p className="py-10 text-center text-sm text-muted-foreground">Loading loan activity…</p> : detail && <><DialogHeader><DialogTitle>{detail.loan.person_name}</DialogTitle></DialogHeader><div className="flex items-center justify-between rounded-xl border border-primary/20 bg-primary/5 p-4"><div><p className="text-sm text-muted-foreground">Outstanding receivable</p><strong className="mt-1 block text-2xl">{formatCurrency(Number(detail.loan.remaining_balance))}</strong></div><Button variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => void deleteLoan(detail.loan)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button></div><div><div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Loan account</h3><span className="text-xs text-muted-foreground">Debit increases what is owed; credit records collections.</span></div><TAccount debitLabel="Debit · loan issued" creditLabel="Credit · collections" debits={[{ id: `${detail.loan.id}-opening`, date: detail.loan.start_date, description: "Opening loan balance", amount: Number(detail.loan.total_amount) }]} credits={detail.collections.filter((collection) => collection.kind === "collection").map((collection) => ({ id: collection.id, date: collection.collection_date, description: collection.note?.replace(/^\[cash:[^\]]+\]\s*/, "") || "Collection received", amount: Number(collection.collected_amount) }))} emptyCreditText="No collections linked yet." /></div></>}</DialogContent></Dialog></div></AppShell>;
}
