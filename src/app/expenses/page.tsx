"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDownRight, ReceiptText, SlidersHorizontal } from "lucide-react";
import { AppShell } from "@/components/layout/app-shell";
import { CashRecordActions } from "@/components/cash-record-actions";
import { CategoryIconBadge } from "@/components/category-icon";
import { Card, CardContent } from "@/components/ui/card";
import { formatCurrency, formatDate } from "@/lib/utils/finance";

type Period = "week" | "month";
type Expense = { id: string; amount: number; date: string; category: string; color: string | null; subcategory: string; account: string };
type ExpenseData = { period: Period; expenses: Expense[] };

export default function ExpensesPage() {
  const [data, setData] = useState<ExpenseData | null>(null);
  const [period, setPeriod] = useState<Period>("month");
  const [category, setCategory] = useState("all");
  const [subcategory, setSubcategory] = useState("all");

  const load = useCallback(() => fetch(`/api/expenses?period=${period}`).then((response) => response.json()).then(setData), [period]);
  useEffect(() => { void load(); }, [load]);
  useEffect(() => { setCategory("all"); setSubcategory("all"); }, [period]);

  const expenses = useMemo(() => data?.expenses || [], [data]);
  const categories = useMemo(() => Array.from(new Set(expenses.map((expense) => expense.category))).sort(), [expenses]);
  const subcategories = useMemo(() => Array.from(new Set(expenses.filter((expense) => category === "all" || expense.category === category).map((expense) => expense.subcategory))).sort(), [category, expenses]);
  const filtered = useMemo(() => expenses.filter((expense) => (category === "all" || expense.category === category) && (subcategory === "all" || expense.subcategory === subcategory)), [category, expenses, subcategory]);
  const total = filtered.reduce((sum, expense) => sum + expense.amount, 0);

  return <AppShell><div className="space-y-6"><div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"><div><p className="section-kicker">SPENDING</p><h1 className="text-2xl font-bold tracking-tight sm:text-3xl">Expenses</h1><p className="mt-1 text-sm text-muted-foreground sm:text-base">Review every cash-out by category and subcategory.</p></div><div className="dashboard-actions"><div className="dashboard-period-filter" role="group" aria-label="Expense period"><button type="button" className={period === "week" ? "active" : ""} onClick={() => setPeriod("week")}>Week</button><button type="button" className={period === "month" ? "active" : ""} onClick={() => setPeriod("month")}>Month</button></div><CashRecordActions onSuccess={load} /></div></div><section className="grid gap-4 sm:grid-cols-3"><Card className="border-primary/20 bg-primary/5 sm:col-span-2"><CardContent className="p-5"><p className="text-sm font-semibold text-primary">Total expenses</p><strong className="mt-1 block text-3xl tracking-tight">{formatCurrency(total)}</strong><p className="mt-1 text-sm text-muted-foreground">{filtered.length} cash-out {filtered.length === 1 ? "record" : "records"} in this view</p></CardContent></Card><Card><CardContent className="flex h-full items-center gap-3 p-5"><span className="stat-icon peach"><ArrowDownRight className="h-5 w-5" /></span><div><p className="text-sm text-muted-foreground">Period</p><strong className="text-lg">{period === "week" ? "This week" : "This month"}</strong></div></CardContent></Card></section><Card><CardContent className="p-5"><div className="flex flex-col gap-4 border-b pb-5 sm:flex-row sm:items-end sm:justify-between"><div><div className="flex items-center gap-2"><SlidersHorizontal className="h-4 w-4 text-primary" /><h2 className="font-semibold">Filter expenses</h2></div><p className="mt-1 text-sm text-muted-foreground">Narrow the list to a category or a remembered subcategory.</p></div><div className="grid gap-3 sm:grid-cols-2"><label className="grid gap-1 text-sm font-medium">Category<select className="h-9 min-w-44 rounded-lg border border-input bg-background px-3 text-sm font-normal" value={category} onChange={(event) => { setCategory(event.target.value); setSubcategory("all"); }}><option value="all">All categories</option>{categories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label><label className="grid gap-1 text-sm font-medium">Subcategory<select className="h-9 min-w-44 rounded-lg border border-input bg-background px-3 text-sm font-normal" value={subcategory} onChange={(event) => setSubcategory(event.target.value)}><option value="all">All subcategories</option>{subcategories.map((item) => <option key={item} value={item}>{item}</option>)}</select></label></div></div>{filtered.length ? <div className="divide-y">{filtered.map((expense) => <div className="flex items-center gap-3 py-4" key={expense.id}><CategoryIconBadge category={expense.category} className="category-mark" /><div className="min-w-0 flex-1"><p className="truncate font-medium">{expense.subcategory}</p><p className="mt-1 text-xs text-muted-foreground">{expense.category} · {expense.account} · {formatDate(expense.date)}</p></div><strong className="shrink-0 text-sm text-rose-600">−{formatCurrency(expense.amount)}</strong></div>)}</div> : <div className="flex flex-col items-center justify-center gap-2 py-16 text-center"><ReceiptText className="h-10 w-10 text-muted-foreground/40" /><p className="text-sm text-muted-foreground">No expenses match these filters.</p></div>}</CardContent></Card></div></AppShell>;
}
