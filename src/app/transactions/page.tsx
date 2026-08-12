"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { CashRecordActions } from "@/components/cash-record-actions";
import { CategoryIconBadge, getExpenseCategoryOptions } from "@/components/category-icon";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
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
import { getManilaToday, formatCurrency, formatDate } from "@/lib/utils/finance";
import type { Transaction, Account, Category, Loan, ScheduledTransaction } from "@/types/database";
import { Copy, Trash2, Pencil, Repeat, Receipt } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

export default function TransactionsPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [scheduled, setScheduled] = useState<ScheduledTransaction[]>([]);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loans, setLoans] = useState<Loan[]>([]);
  const [typeFilter, setTypeFilter] = useState("all");
  const [accountFilter, setAccountFilter] = useState("all");
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Transaction | null>(null);
  const [form, setForm] = useState({
    account_id: "", category_id: "", loan_id: "", amount: "", type: "expense",
    description: "", notes: "", date: getManilaToday(),
  });

  async function load() {
    const supabase = createClient();
    const [txResult, accountResult, categoryResult, loanResult, scheduledResult] = await Promise.all([
      supabase.from("transactions").select("*").order("date", { ascending: false }).order("created_at", { ascending: false }),
      supabase.from("accounts").select("*").order("name"),
      supabase.from("categories").select("*").order("name"),
      supabase.from("loans").select("*").order("person_name"),
      supabase.from("scheduled_transactions").select("*").order("next_occurrence"),
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
    const transactionRows = (txResult.data || [])
      .filter((transaction) => !(transaction.notes?.startsWith("Internal transfer:") && (transaction.description.startsWith("Cash withdrawal from") || transaction.description.startsWith("Transfer from"))))
      .map((transaction) => ({
      ...transaction,
      accounts: accountsById.get(transaction.account_id),
      categories: transaction.category_id ? categoriesById.get(transaction.category_id) : undefined,
      })) as Transaction[];

    setTransactions(transactionRows);
    setAccounts(accountRows);
    setCategories(categoryRows);
    setLoans((loanResult.data || []) as Loan[]);
    setScheduled((scheduledResult.data || []) as ScheduledTransaction[]);
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
      }),
    });

    if (!res.ok) { toast.error("Failed to save transaction"); return; }
    toast.success(editing ? "Transaction updated" : "Transaction created");
    setOpen(false);
    setEditing(null);
    resetForm();
    load();
  }

  function resetForm() {
    setForm({
      account_id: "", category_id: "", loan_id: "", amount: "", type: "expense",
      description: "", notes: "", date: getManilaToday(),
    });
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

  async function selectCategory(value: string) {
    if (!value.startsWith("new:")) {
      setForm({ ...form, category_id: value });
      return;
    }

    const name = value.slice(4);
    const response = await fetch("/api/categories", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, type: "expense", color: "#d17a5e" }),
    });
    if (!response.ok) return toast.error("Could not prepare this category");
    const created = await response.json() as Category;
    setCategories((current) => [...current, created]);
    setForm({ ...form, category_id: created.id });
  }

  function openEdit(tx: Transaction) {
    setEditing(tx);
    setForm({
      account_id: tx.account_id,
      category_id: tx.category_id || "",
      loan_id: tx.loan_id || "",
      amount: String(tx.amount),
      type: tx.type,
      description: tx.description,
      notes: tx.notes || "",
      date: tx.date,
    });
    setOpen(true);
  }

  const filteredCategories = categories.filter((c) => c.type === form.type);
  const expenseCategoryOptions = useMemo(() => getExpenseCategoryOptions(categories), [categories]);
  const visibleTransactions = useMemo(() => transactions.filter((transaction) => {
    const matchesType = typeFilter === "all" || transaction.type === typeFilter;
    const matchesAccount = accountFilter === "all" || transaction.account_id === accountFilter;
    const matchesCategory = categoryFilter === "all" || transaction.category_id === categoryFilter;
    const term = search.trim().toLowerCase();
    const matchesSearch = !term || [transaction.description, transaction.notes, (transaction.accounts as { name?: string } | undefined)?.name, (transaction.categories as { name?: string } | undefined)?.name].some((value) => value?.toLowerCase().includes(term));
    return matchesType && matchesAccount && matchesCategory && matchesSearch;
  }), [transactions, typeFilter, accountFilter, categoryFilter, search]);

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
          <div className="dashboard-actions">
            <CashRecordActions onSuccess={load} />
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) { setEditing(null); resetForm(); } }}>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Transaction</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Type</Label>
                      <Select
                        value={form.type}
                        onValueChange={(v) => {
                          setForm({ ...form, type: v, category_id: "", loan_id: v === "income" ? form.loan_id : "" });
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
                  {editing && form.type === "income" && <div className="space-y-2"><Label>Link to loan account <span className="text-muted-foreground">(optional)</span></Label><Select value={form.loan_id || "none"} onValueChange={(value) => setForm({ ...form, loan_id: value === "none" ? "" : value })}><SelectTrigger><SelectValue placeholder="Not a loan collection" /></SelectTrigger><SelectContent><SelectItem value="none">Not a loan collection</SelectItem>{loans.map((loan) => <SelectItem key={loan.id} value={loan.id}>{loan.person_name} · {formatCurrency(Number(loan.remaining_balance))} outstanding</SelectItem>)}</SelectContent></Select><p className="text-xs text-muted-foreground">Use this to attach a previous cash-in to the person&apos;s loan card.</p></div>}
                  <div className="space-y-2">
                    <Label>Category</Label>
                    <Select value={form.category_id} onValueChange={selectCategory}>
                      <SelectTrigger><SelectValue placeholder="Select category" /></SelectTrigger>
                      <SelectContent>
                        {form.type === "expense"
                          ? expenseCategoryOptions.map((name) => {
                            const category = filteredCategories.find((item) => item.name === name);
                            return <SelectItem key={name} value={category?.id || `new:${name}`}><span className="category-select-option"><CategoryIconBadge compact category={name} icon={category?.icon} />{name}</span></SelectItem>;
                          })
                          : filteredCategories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>{form.type === "expense" ? "Subcategory" : "Description"} <span className="text-muted-foreground">(optional)</span></Label>
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
                <div className="mb-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <Input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search description or note" />
                  <Select value={typeFilter} onValueChange={setTypeFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All cash flow</SelectItem><SelectItem value="income">Cash in</SelectItem><SelectItem value="expense">Cash out</SelectItem></SelectContent></Select>
                  <Select value={accountFilter} onValueChange={setAccountFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All accounts</SelectItem>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select>
                  <Select value={categoryFilter} onValueChange={setCategoryFilter}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">All categories</SelectItem>{categories.map((category) => <SelectItem key={category.id} value={category.id}>{category.name}</SelectItem>)}</SelectContent></Select>
                </div>
                <p className="mb-4 text-xs text-muted-foreground">Showing {visibleTransactions.length} of {transactions.length} cash records</p>
                {visibleTransactions.length ? (
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
                      {visibleTransactions.map((t) => (
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
                    {visibleTransactions.map((t) => (
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
                    <p className="text-sm text-muted-foreground">{transactions.length ? "No records match these filters." : "No cash records yet — add your first cash-in or cash-out entry."}</p>
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
