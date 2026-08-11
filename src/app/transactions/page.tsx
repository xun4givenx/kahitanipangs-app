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
import { getManilaToday,  formatCurrency, formatDate, FREQUENCIES  } from "@/lib/utils/finance";
import type { Transaction, Account, Category, ScheduledTransaction, Loan, Debt } from "@/types/database";
import { Plus, Copy, Trash2, Pencil, Repeat, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

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
    description: "", notes: "", date: getManilaToday(),
    loan_id: "", debt_id: "",
  });
  const [recurringForm, setRecurringForm] = useState({
    account_id: "", category_id: "", amount: "", type: "expense",
    description: "", frequency: "monthly",
    start_date: getManilaToday(), end_date: "",
  });

  async function load() {
    const supabase = createClient();
    const [txResult, accountResult, categoryResult, scheduledResult, loanResult, debtResult] = await Promise.all([
      supabase.from("transactions").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }).limit(50),
      supabase.from("accounts").select("*").order("name"),
      supabase.from("categories").select("*").order("name"),
      supabase.from("scheduled_transactions").select("*").order("next_occurrence"),
      supabase.from("loans").select("*").order("created_at", { ascending: false }),
      supabase.from("debts").select("*").order("created_at", { ascending: false }),
    ]);

    if (txResult.error) {
      toast.error(txResult.error.message);
      setTransactions([]);
      return;
    }

    const accountRows = (accountResult.data || []) as Account[];
    const categoryRows = (categoryResult.data || []) as Category[];
    const accountsById = new Map(accountRows.map((account) => [account.id, account]));
    const categoriesById = new Map(categoryRows.map((category) => [category.id, category]));
    const transactionRows = (txResult.data || []).map((transaction) => ({
      ...transaction,
      accounts: accountsById.get(transaction.account_id),
      categories: transaction.category_id ? categoriesById.get(transaction.category_id) : undefined,
    })) as Transaction[];

    setTransactions(transactionRows);
    setAccounts(accountRows);
    setCategories(categoryRows);
    setScheduled((scheduledResult.data || []) as ScheduledTransaction[]);
    setLoans((loanResult.data || []) as Loan[]);
    setDebts((debtResult.data || []) as Debt[]);
  }

  useEffect(() => { load(); }, []);

  useEffect(() => {
    const recordType = new URLSearchParams(window.location.search).get("record");
    if (recordType !== "income" && recordType !== "expense") return;
    setForm((current) => ({ ...current, type: recordType, category_id: "" }));
    setOpen(true);
  }, []);

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
      description: "", notes: "", date: getManilaToday(),
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
      <div className="transactions-page space-y-6">
        <div className="transaction-page-header flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Transactions</h1>
            <p className="text-sm text-muted-foreground sm:text-base">Your complete cash-in and cash-out record</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto">
            <Dialog open={recurringOpen} onOpenChange={setRecurringOpen}>
              <DialogTrigger asChild>
                <Button variant="outline" className="w-full sm:w-auto"><Repeat className="mr-1.5 h-4 w-4 sm:mr-2" />Recurring</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>New Recurring Transaction</DialogTitle></DialogHeader>
                <form onSubmit={handleRecurringSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select value={recurringForm.type} onValueChange={(v) => setRecurringForm({ ...recurringForm, type: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="income">Cash in</SelectItem>
                          <SelectItem value="expense">Cash out</SelectItem>
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
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                <Button className="w-full sm:w-auto"><Plus className="mr-1.5 h-4 w-4 sm:mr-2" />Add Transaction</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Transaction</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
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
                          <SelectItem value="income">Cash in</SelectItem>
                          <SelectItem value="expense">Cash out</SelectItem>
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

        <Tabs defaultValue="all" className="min-w-0">
          <TabsList className="grid h-auto w-full grid-cols-2 sm:inline-flex sm:w-auto">
            <TabsTrigger className="min-w-0 px-2 text-xs sm:px-3 sm:text-sm" value="all">All Transactions</TabsTrigger>
            <TabsTrigger className="min-w-0 px-2 text-xs sm:px-3 sm:text-sm" value="recurring">Recurring ({scheduled.length})</TabsTrigger>
          </TabsList>
          <TabsContent value="all" className="min-w-0">
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
                      No cash records yet — add your first cash-in or cash-out entry.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
          <TabsContent value="recurring" className="min-w-0">
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
