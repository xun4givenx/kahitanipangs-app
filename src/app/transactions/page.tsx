"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { formatCurrency, formatDate, FREQUENCIES } from "@/lib/utils/finance";
import type { Transaction, Account, Category, ScheduledTransaction, Loan, Debt } from "@/types/database";
import { Plus, Copy, Trash2, Pencil, Repeat, Receipt } from "lucide-react";

type LinkType = "none" | "loan" | "debt";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [open, setOpen] = useState(false);
  const [recurringOpen, setRecurringOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [linkType, setLinkType] = useState<LinkType>("none");
  const [form, setForm] = useState({
    account_id: "", category_id: "", amount: "", type: "expense",
    description: "", notes: "", date: new Date().toISOString().split("T")[0],
    loan_id: "", debt_id: "",
  });
  const [recurringForm, setRecurringForm] = useState({
    account_id: "", category_id: "", amount: "", type: "expense",
    description: "", frequency: "monthly",
    start_date: new Date().toISOString().split("T")[0], end_date: "",
  });

  async function load() {
    const [txRes, accRes, catRes, schRes, loanRes, debtRes] = await Promise.all([
      fetch("/api/transactions").then((r) => r.json()),
      fetch("/api/accounts").then((r) => r.json()),
      fetch("/api/categories").then((r) => r.json()),
      fetch("/api/scheduled-transactions").then((r) => r.json()),
      fetch("/api/loans").then((r) => r.json()),
      fetch("/api/debts").then((r) => r.json()),
    ]);
    setTransactions(txRes);
    setAccounts(accRes);
    setCategories(catRes);
    setScheduled(schRes);
    setLoans(Array.isArray(loanRes) ? loanRes : []);
    setDebts(Array.isArray(debtRes) ? debtRes : []);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editing ? `/api/transactions/${editing.id}` : "/api/transactions";
    const method = editing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        amount: parseFloat(form.amount),
        category_id: form.category_id || null,
        loan_id: linkType === "loan" && form.loan_id ? form.loan_id : null,
        debt_id: linkType === "debt" && form.debt_id ? form.debt_id : null,
      }),
    });

    if (!res.ok) { toast.error("Failed to save transaction"); return; }
    toast.success(editing ? "Transaction updated" : "Transaction created");
    setOpen(false);
    setEditing(null);
    resetForm();
    load();
  }

  async function handleRecurringSubmit(e: React.FormEvent) {
    e.preventDefault();
    const res = await fetch("/api/scheduled-transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...recurringForm,
        amount: parseFloat(recurringForm.amount),
        category_id: recurringForm.category_id || null,
        end_date: recurringForm.end_date || null,
      }),
    });
    if (!res.ok) { toast.error("Failed to create recurring transaction"); return; }
    toast.success("Recurring transaction created");
    setRecurringOpen(false);
    load();
  }

  function resetForm() {
    setForm({
      account_id: "", category_id: "", amount: "", type: "expense",
      description: "", notes: "", date: new Date().toISOString().split("T")[0],
      loan_id: "", debt_id: "",
    });
    setLinkType("none");
  }

  async function handleDuplicate(id: string) {
    const res = await fetch(`/api/transactions/${id}/duplicate`, { method: "POST" });
    if (!res.ok) { toast.error("Failed to duplicate"); return; }
    toast.success("Transaction duplicated");
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this transaction?")) return;
    await fetch(`/api/transactions/${id}`, { method: "DELETE" });
    toast.success("Transaction deleted");
    load();
  }

  function openEdit(tx: Transaction) {
    setEditing(tx);
    setForm({
      account_id: tx.account_id,
      category_id: tx.category_id || "",
      amount: String(tx.amount),
      type: tx.type,
      description: tx.description,
      notes: tx.notes || "",
      date: tx.date,
      loan_id: tx.loan_id || "",
      debt_id: tx.debt_id || "",
    });
    setLinkType(tx.loan_id ? "loan" : tx.debt_id ? "debt" : "none");
    setOpen(true);
  }

  const filteredCategories = categories.filter((c) => c.type === form.type);

  function txActions(t: (typeof transactions)[number]) {
    return (
      <div className="flex gap-1">
        <Button variant="ghost" size="icon" onClick={() => openEdit(t)}>
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => handleDuplicate(t.id)}>
          <Copy className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => handleDelete(t.id)}>
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Transactions</h1>
            <p className="text-muted-foreground">Manage income, expenses, and recurring payments</p>
          </div>
          <div className="flex gap-2">
            <Dialog open={recurringOpen} onOpenChange={setRecurringOpen}>
              <DialogTrigger asChild>
                <Button variant="outline"><Repeat className="mr-2 h-4 w-4" />Recurring</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Recurring Transaction</DialogTitle></DialogHeader>
                <form onSubmit={handleRecurringSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={recurringForm.type} onValueChange={(v) => setRecurringForm({ ...recurringForm, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">Income</SelectItem>
                          <SelectItem value="expense">Expense</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Frequency</Label>
                      <Select value={recurringForm.frequency} onValueChange={(v) => setRecurringForm({ ...recurringForm, frequency: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {FREQUENCIES.map((f) => (
                            <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Account</Label>
                    <Select value={recurringForm.account_id} onValueChange={(v) => setRecurringForm({ ...recurringForm, account_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input type="number" step="0.01" value={recurringForm.amount} onChange={(e) => setRecurringForm({ ...recurringForm, amount: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Start Date</Label>
                      <Input type="date" value={recurringForm.start_date} onChange={(e) => setRecurringForm({ ...recurringForm, start_date: e.target.value })} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input value={recurringForm.description} onChange={(e) => setRecurringForm({ ...recurringForm, description: e.target.value })} />
                  </div>
                  <Button type="submit" className="w-full">Create Recurring</Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); resetForm(); } }}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Add Transaction</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Transaction</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={form.type}
                        onValueChange={(v) => {
                          setForm({ ...form, type: v, category_id: "", loan_id: "", debt_id: "" });
                          setLinkType("none");
                        }}
                      >
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">Income</SelectItem>
                          <SelectItem value="expense">Expense</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>Amount</Label>
                      <Input type="number" step="0.01" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Account</Label>
                    <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select account" /></SelectTrigger>
                      <SelectContent>
                        {accounts.map((a) => <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={form.category_id} onValueChange={(v) => setForm({ ...form, category_id: v })}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {filteredCategories.map((c) => <SelectItem key={c.id} value={c.id}>{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Apply to</Label>
                    <Select
                      value={linkType}
                      onValueChange={(v) => {
                        const val = v as LinkType;
                        setLinkType(val);
                        setForm({
                          ...form,
                          loan_id: val === "loan" ? form.loan_id : "",
                          debt_id: val === "debt" ? form.debt_id : "",
                        });
                      }}
                    >
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        {form.type === "income" && <SelectItem value="loan">Loan (borrower)</SelectItem>}
                        {form.type === "expense" && <SelectItem value="debt">Debt</SelectItem>}
                      </SelectContent>
                    </Select>
                  </div>
                  {linkType === "loan" && (
                    <div className="space-y-2">
                      <Label>Borrower</Label>
                      <Select value={form.loan_id} onValueChange={(v) => setForm({ ...form, loan_id: v })}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Select borrower" /></SelectTrigger>
                        <SelectContent>
                          {loans.map((l) => <SelectItem key={l.id} value={l.id}>{l.person_name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  {linkType === "debt" && (
                    <div className="space-y-2">
                      <Label>Debt</Label>
                      <Select value={form.debt_id} onValueChange={(v) => setForm({ ...form, debt_id: v })}>
                        <SelectTrigger className="w-full"><SelectValue placeholder="Select debt" /></SelectTrigger>
                        <SelectContent>
                          {debts.map((d) => <SelectItem key={d.id} value={d.id}>{d.name}</SelectItem>)}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Description</Label>
                    <Input value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} />
                  </div>
                  <div className="space-y-2">
                    <Label>Notes</Label>
                    <Textarea value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} />
                  </div>
                  <Button type="submit" className="w-full">{editing ? "Update" : "Create"}</Button>
                </form>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Tabs defaultValue="all">
          <TabsList>
            <TabsTrigger value="all">All Transactions</TabsTrigger>
            <TabsTrigger value="recurring">Recurring ({scheduled.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="all">
            <Card>
              <CardContent className="pt-6">
                {transactions.length ? (
                  <>
                  <div className="hidden w-full overflow-x-auto md:block">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Account</TableHead>
                        <TableHead>Category</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {transactions.map((t) => (
                        <TableRow key={t.id}>
                          <TableCell>{formatDate(t.date)}</TableCell>
                          <TableCell>{t.description}</TableCell>
                          <TableCell>{(t.accounts as { name: string })?.name}</TableCell>
                          <TableCell>{(t.categories as { name: string })?.name || "—"}</TableCell>
                          <TableCell className={`text-right font-medium ${t.type === "income" ? "text-green-600" : "text-red-600"}`}>
                            {t.type === "income" ? "+" : "-"}{formatCurrency(t.amount)}
                          </TableCell>
                          <TableCell>
                            {txActions(t)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                  <div className="space-y-3 md:hidden">
                    {transactions.map((t) => (
                      <div key={t.id} className="rounded-lg border border-border/60 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0">
                            <p className="truncate font-medium">{t.description}</p>
                            <p className="text-xs text-muted-foreground">
                              {formatDate(t.date)} · {(t.accounts as { name: string })?.name}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {(t.categories as { name: string })?.name || "—"}
                            </p>
                          </div>
                          <span
                            className={`shrink-0 font-medium ${
                              t.type === "income" ? "text-green-600" : "text-red-600"
                            }`}
                          >
                            {t.type === "income" ? "+" : "-"}
                            {formatCurrency(t.amount)}
                          </span>
                        </div>
                        <div className="mt-2 flex justify-end">{txActions(t)}</div>
                      </div>
                    ))}
                  </div>
                  </>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                    <Receipt className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      No transactions yet — add your first income or expense.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="recurring">
            <Card>
              <CardHeader><CardTitle>Recurring Transactions</CardTitle></CardHeader>
              <CardContent>
                {scheduled.length ? (
                  <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Description</TableHead>
                        <TableHead>Frequency</TableHead>
                        <TableHead>Next</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Status</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {scheduled.map((s) => (
                        <TableRow key={s.id}>
                          <TableCell>{s.description}</TableCell>
                          <TableCell className="capitalize">{s.frequency}</TableCell>
                          <TableCell>{formatDate(s.next_occurrence)}</TableCell>
                          <TableCell className="text-right">{formatCurrency(s.amount)}</TableCell>
                          <TableCell>
                            <Badge variant={s.is_active ? "default" : "secondary"}>
                              {s.is_active ? "Active" : "Inactive"}
                            </Badge>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                    <Repeat className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      No recurring transactions set up yet.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </div>
    </AppShell>
  );
}
