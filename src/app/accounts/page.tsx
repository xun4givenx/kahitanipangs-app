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
import type { Account } from "@/types/database";
import { Plus, Trash2, Pencil, Wallet } from "lucide-react";

export default function AccountsPage() {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Account | null>(null);
  const [form, setForm] = useState({
    name: "", type: "checking", balance: "0", currency: "USD", color: "#3b82f6",
  });

  async function load() {
    const res = await fetch("/api/accounts");
    setAccounts(await res.json());
  }

  useEffect(() => { load(); }, []);

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
    toast.success(editing ? "Account updated" : "Account created");
    setOpen(false);
    setEditing(null);
    setForm({ name: "", type: "checking", balance: "0", currency: "USD", color: "#3b82f6" });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this account?")) return;
    await fetch(`/api/accounts/${id}`, { method: "DELETE" });
    toast.success("Account deleted");
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
                className="transition-colors hover:bg-accent/40"
                style={{ borderLeftColor: a.color, borderLeftWidth: 4 }}
              >
                <CardContent className="flex items-center justify-between p-6">
                  <div>
                    <h3 className="text-lg font-semibold">{a.name}</h3>
                    <p className="text-sm capitalize text-muted-foreground">{a.type}</p>
                    <p className="mt-2 text-2xl font-bold">{formatCurrency(a.balance)}</p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <Button variant="ghost" size="icon" onClick={() => {
                      setEditing(a);
                      setForm({ name: a.name, type: a.type, balance: String(a.balance), currency: a.currency, color: a.color });
                      setOpen(true);
                    }}><Pencil className="h-4 w-4" /></Button>
                    <Button variant="ghost" size="icon" onClick={() => handleDelete(a.id)}><Trash2 className="h-4 w-4" /></Button>
                  </div>
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
      </div>
    </AppShell>
  );
}
