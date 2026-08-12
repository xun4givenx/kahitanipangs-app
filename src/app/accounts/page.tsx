"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import { formatCurrency, ACCOUNT_TYPES } from "@/lib/utils/finance";
import type { Account, Transaction } from "@/types/database";
import { ArrowRightLeft, Plus, Trash2, Pencil, Wallet } from "lucide-react";
import { TAccount } from "@/components/t-account";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [detailAccount, setDetailAccount] = useState<Account | null>(null);
  const [movements, setMovements] = useState<Transaction[]>([]);
  const [loadingMovements, setLoadingMovements] = useState(false);
  const [form, setForm] = useState({
    name: "", type: "checking", balance: "0", currency: "USD", color: "#3b82f6",
  });

  async function load() {
    const res = await fetch("/api/accounts");
    setAccounts(await res.json());
  }

  useEffect(() => { load(); }, []);

  async function openAccount(account: Account) {
    setDetailAccount(account);
    setLoadingMovements(true);
    try {
      const response = await fetch(`/api/transactions?account_id=${account.id}&limit=100`);
      if (!response.ok) throw new Error();
      setMovements(await response.json());
    } catch {
      toast.error("Could not load account movements");
      setMovements([]);
    } finally {
      setLoadingMovements(false);
    }
  }

  function openEdit(account: Account) {
    setEditing(account);
    setForm({ name: account.name, type: account.type, balance: String(account.balance), currency: account.currency, color: account.color });
    setOpen(true);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editing ? `/api/accounts/${editing.id}` : "/api/accounts";
    const method = editing ? "PUT" : "POST";
    const body = editing
      ? { name: form.name, type: form.type, currency: form.currency, color: form.color }
      : { ...form, balance: parseFloat(form.balance) };

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!res.ok) { toast.error("Failed to save account"); return; }
    const saved = await res.json() as Account;
    toast.success(editing ? "Account updated" : "Account created");
    setOpen(false);
    setEditing(null);
    setForm({ name: "", type: "checking", balance: "0", currency: "USD", color: "#3b82f6" });
    if (detailAccount?.id === saved.id) setDetailAccount(saved);
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this account and all cash records tied to it? This cannot be undone.")) return;
    const response = await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    if (!response.ok) return toast.error("Could not delete account");
    toast.success("Account deleted");
    if (detailAccount?.id === id) setDetailAccount(null);
    load();
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Accounts</h1>
            <p className="text-muted-foreground">Manage your bank accounts and wallets</p>
          </div>
          <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
            <DialogTrigger asChild>
              <Button><Plus className="mr-2 h-4 w-4" />Add Account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Account</DialogTitle></DialogHeader>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {ACCOUNT_TYPES.map((t) => (
                        <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                {!editing && (
                  <div className="space-y-2">
                    <Label>Initial Balance</Label>
                    <Input type="number" step="0.01" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} />
                  </div>
                )}
                <div className="space-y-2">
                  <Label>Color</Label>
                  <Input type="color" value={form.color} onChange={(e) => setForm({ ...form, color: e.target.value })} />
                </div>
                <Button type="submit" className="w-full">{editing ? "Update" : "Create"}</Button>
              </form>
            </DialogContent>
          </Dialog>
        </div>

        {accounts.length ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {accounts.map((a) => (
              <Card
                key={a.id}
                className="cursor-pointer transition-colors hover:bg-accent/40"
                style={{ borderLeftColor: a.color, borderLeftWidth: 4 }}
                role="button"
                tabIndex={0}
                onClick={() => void openAccount(a)}
                onKeyDown={(event) => { if (event.key === "Enter" || event.key === " ") { event.preventDefault(); void openAccount(a); } }}
              >
                <CardContent className="flex items-center justify-between p-6">
                  <div>
                    <h3 className="text-lg font-semibold">{a.name}</h3>
                    <p className="text-sm capitalize text-muted-foreground">{a.type}</p>
                    <p className="mt-2 text-2xl font-bold">{formatCurrency(a.balance)}</p>
                  </div>
                  <ArrowRightLeft className="h-5 w-5 text-muted-foreground" />
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="flex flex-col items-center justify-center gap-2 py-16 text-center">
              <Wallet className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No accounts yet — add your first account to start tracking balances.
              </p>
            </CardContent>
          </Card>
        )}
        <Dialog open={Boolean(detailAccount)} onOpenChange={(value) => { if (!value) setDetailAccount(null); }}>
          <DialogContent className="max-h-[85vh] overflow-y-auto sm:max-w-xl">
            {detailAccount && <><DialogHeader><DialogTitle>{detailAccount.name}</DialogTitle></DialogHeader><div className="flex items-center justify-between rounded-xl border p-4" style={{ borderLeftColor: detailAccount.color, borderLeftWidth: 4 }}><div><p className="text-sm capitalize text-muted-foreground">{detailAccount.type}</p><strong className="mt-1 block text-2xl">{formatCurrency(detailAccount.balance)}</strong></div><div className="flex gap-2"><Button type="button" variant="outline" size="sm" onClick={() => openEdit(detailAccount)}><Pencil className="mr-1.5 h-3.5 w-3.5" />Edit</Button><Button type="button" variant="outline" size="sm" className="text-destructive hover:text-destructive" onClick={() => void handleDelete(detailAccount.id)}><Trash2 className="mr-1.5 h-3.5 w-3.5" />Delete</Button></div></div><div><div className="mb-2 flex items-center justify-between"><h3 className="font-semibold">Cash account</h3><span className="text-xs text-muted-foreground">Debit increases cash; credit decreases cash.</span></div>{loadingMovements ? <p className="py-10 text-center text-sm text-muted-foreground">Loading movements…</p> : <TAccount debitLabel="Debit · money in" creditLabel="Credit · money out" debits={movements.filter((movement) => movement.type === "income").map((movement) => ({ id: movement.id, date: movement.date, description: movement.description || "Cash in", amount: Number(movement.amount) }))} credits={movements.filter((movement) => movement.type === "expense").map((movement) => ({ id: movement.id, date: movement.date, description: movement.description || "Cash out", amount: Number(movement.amount) }))} emptyDebitText="No deposits or transfers in yet." emptyCreditText="No payments or transfers out yet." />}</div></>}
          </DialogContent>
        </Dialog>
      </div>
    </AppShell>
  );
}
