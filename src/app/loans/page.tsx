"use client";

import { useEffect, useMemo, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { formatCurrency, formatDate, loanProfit, getLoanStatus, roundToTens, getManilaToday, getManilaTomorrow } from "@/lib/utils/finance";
import type { Account, Loan, LoanCollection, LoanFrequency } from "@/types/database";
import {
  Plus, Pencil, Trash2, HandCoins, Coins, Undo2, History, Receipt,
  TrendingUp, Wallet, Search,
} from "lucide-react";

const frequencyOptions: { value: LoanFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
];

const initialForm = {
  person_name: "",
  total_amount: "",
  interest_rate: "",
  start_date: getManilaTomorrow(),
  frequency: "monthly" as LoanFrequency,
  funding_source: "reinvested" as "reinvested" | "fresh_capital",
  installments: "",
  advanced_interest: false,
  pocketed_interest: false,
};

export default function LoansPage() {
  const [loans, setLoans] = useState<Loan[]>([]);
  const [form, setForm] = useState(initialForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [collectingId, setCollectingId] = useState<string | null>(null);
  const [refundLoan, setRefundLoan] = useState<Loan | null>(null);
  const [refundAmount, setRefundAmount] = useState("");
  const [refunding, setRefunding] = useState(false);
  const [historyLoan, setHistoryLoan] = useState<Loan | null>(null);
  const [historyRows, setHistoryRows] = useState<LoanCollection[]>([]);
  const [historyLoading, setHistoryLoading] = useState(false);
  const [collectLoan, setCollectLoan] = useState<Loan | null>(null);
  const [collectForm, setCollectForm] = useState({ amount: "", date: getManilaToday(), applyExcess: false });
  const [collectingManual, setCollectingManual] = useState(false);
  const [cashAccount, setCashAccount] = useState<Account | null>(null);
  const [editCollection, setEditCollection] = useState<LoanCollection | null>(null);
  const [editCollectionForm, setEditCollectionForm] = useState({ amount: "", date: "", note: "", applyExcess: false });
  const [editingCollection, setEditingCollection] = useState(false);
  const [filter, setFilter] = useState<"all" | "active" | "delayed" | "completed">("active");
  const [searchQuery, setSearchQuery] = useState("");

  const [isFormOpen, setIsFormOpen] = useState(false);

  const filteredLoans = useMemo(() => {
    return loans.filter((l) => {
      const matchSearch = l.person_name.toLowerCase().includes(searchQuery.toLowerCase());
      if (!matchSearch) return false;

      if (filter === "all") return true;
      if (filter === "completed") return Number(l.remaining_balance) <= 0;
      if (filter === "active") return Number(l.remaining_balance) > 0;
      if (filter === "delayed") {
        return getLoanStatus(l).isDelayed;
      }
      return true;
    });
  }, [loans, filter, searchQuery]);

  async function load() {
    const res = await fetch("/api/loans");
    if (!res.ok) {
      toast.error("Failed to load loans");
      return;
    }
    const data = await res.json();
    setLoans(data);
  }

  async function loadCashAccount() {
    const res = await fetch("/api/gl/trial-balance");
    if (!res.ok) return;
    const data = await res.json();
    const rows: { name: string; balance: number }[] = data.rows || [];
    const cashRow = rows.find((a) => a.name.toLowerCase().includes("cash on collected"));
    setCashAccount(cashRow ? { name: cashRow.name, balance: cashRow.balance, id: "gl", type: "cash", user_id: "gl", currency: "PHP", is_active: true } as Account : null);
  }

  useEffect(() => { load(); loadCashAccount(); }, []);

  const profitTotals = useMemo(() => {
    return loans.reduce(
      (acc, loan) => {
        const { expected, realized } = loanProfit(loan);
        acc.expected += expected;
        acc.realized += realized;
        return acc;
      },
      { expected: 0, realized: 0 }
    );
  }, [loans]);

  function resetForm() {
    setForm(initialForm);
    setEditingId(null);
    setIsFormOpen(false);
  }

  function openNewLoan() {
    setForm(initialForm);
    setEditingId(null);
    setIsFormOpen(true);
  }

  const computedLoan = useMemo(() => {
    const principal = Number(form.total_amount) || 0;
    const rate = Number(form.interest_rate) || 0;
    const installments = Number(form.installments) || 0;
    const interest = principal * (rate / 100);
    const amountReleased = form.advanced_interest ? Math.max(0, principal - interest) : principal;
    const repaymentAmount = installments > 0
      ? form.advanced_interest
        ? principal / installments
        : (principal + interest) / installments
      : 0;
    const remainingBalance = form.advanced_interest ? principal : principal + interest;
    return { principal, interest, amountReleased, repaymentAmount, remainingBalance };
  }, [form.total_amount, form.interest_rate, form.installments, form.advanced_interest]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    
    let finalRemainingBalance = Number(computedLoan.remainingBalance.toFixed(2));
    
    if (editingId) {
      const oldLoan = loans.find(l => l.id === editingId);
      if (oldLoan) {
        const oldTotal = Number(oldLoan.total_amount);
        const oldInterest = (oldTotal * Number(oldLoan.interest_rate)) / 100;
        const oldOriginalDue = oldLoan.advanced_interest ? oldTotal : oldTotal + oldInterest;
        const newOriginalDue = computedLoan.remainingBalance;
        const delta = newOriginalDue - oldOriginalDue;
        
        finalRemainingBalance = Math.max(0, Number(oldLoan.remaining_balance) + delta);
      }
    }

    const payload = {
      person_name: form.person_name,
      total_amount: Number(form.total_amount),
      interest_rate: Number(form.interest_rate) || 0,
      start_date: form.start_date,
      frequency: form.frequency,
      funding_source: form.funding_source,
      installments: Number(form.installments) || 0,
      repayment_amount: Number(computedLoan.repaymentAmount.toFixed(2)),
      remaining_balance: Number(finalRemainingBalance.toFixed(2)),
      advanced_interest: form.advanced_interest,
      pocketed_interest: form.pocketed_interest,
      amount_released: Number(computedLoan.amountReleased.toFixed(2)),
    };

    const url = editingId ? `/api/loans/${editingId}` : "/api/loans";
    const method = editingId ? "PATCH" : "POST";

    setSaving(true);
    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
    setSaving(false);

    if (!res.ok) {
      toast.error("Failed to save loan");
      return;
    }
    toast.success(editingId ? "Loan updated" : "Loan created");
    resetForm();
    load();
  }

  function handleEdit(loan: Loan) {
    setForm({
      person_name: loan.person_name,
      total_amount: loan.total_amount?.toString() || "",
      interest_rate: loan.interest_rate?.toString() || "",
      start_date: loan.start_date || "",
      frequency: loan.frequency || "monthly",
      funding_source: loan.funding_source || "reinvested",
      installments: loan.installments?.toString() || "",
      advanced_interest: Boolean(loan.advanced_interest),
      pocketed_interest: false,
    });
    setEditingId(loan.id);
    setIsFormOpen(true);
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this loan?")) return;
    const res = await fetch(`/api/loans/${id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete loan");
      return;
    }
    toast.success("Loan deleted");
    if (editingId === id) resetForm();
    load();
  }

  function updateLoanRow(updated: Loan) {
    setLoans((prev) => prev.map((l) => (l.id === updated.id ? updated : l)));
  }

  async function handleCollect(loan: Loan) {
    const status = getLoanStatus(loan);
    const defaultDate = (status.isDelayed && status.nextExpectedPaymentDate) 
      ? status.nextExpectedPaymentDate 
      : getManilaToday();

    setCollectingId(loan.id);
    const res = await fetch(`/api/loans/${loan.id}/collections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        kind: "collection",
        collected_amount: roundToTens(loan.repayment_amount || 0),
        collection_date: defaultDate
      }),
    });
    setCollectingId(null);

    if (!res.ok) {
      toast.error("Failed to record collection");
      return;
    }
    const { collection, loan: updatedLoan } = await res.json();
    updateLoanRow(updatedLoan);
    loadCashAccount();
    toast.success(
      `Collected ${formatCurrency(collection.collected_amount)} · ${formatCurrency(collection.savings_delta)} to savings`
    );
  }

  function openManualCollect(loan: Loan) {
    const status = getLoanStatus(loan);
    const defaultDate = (status.isDelayed && status.nextExpectedPaymentDate) 
      ? status.nextExpectedPaymentDate 
      : getManilaToday();

    setCollectLoan(loan);
    setCollectForm({
      amount: String(roundToTens(loan.repayment_amount || 0)),
      date: defaultDate,
      applyExcess: false,
    });
  }

  async function handleManualCollect(e: React.FormEvent) {
    e.preventDefault();
    if (!collectLoan) return;
    const amount = Number(collectForm.amount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setCollectingManual(true);
    const res = await fetch(`/api/loans/${collectLoan.id}/collections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "collection",
        collected_amount: amount,
        collection_date: collectForm.date,
        apply_excess_to_principal: collectForm.applyExcess,
      }),
    });
    setCollectingManual(false);

    if (!res.ok) {
      toast.error("Failed to record collection");
      return;
    }
    const { collection, loan: updatedLoan } = await res.json();
    updateLoanRow(updatedLoan);
    loadCashAccount();
    toast.success(
      `Collected ${formatCurrency(collection.collected_amount)} · ${formatCurrency(collection.savings_delta)} to savings`
    );
    setCollectLoan(null);
  }

  function openRefund(loan: Loan) {
    setRefundLoan(loan);
    setRefundAmount(String(loan.savings_balance || 0));
  }

  async function handleRefund(e: React.FormEvent) {
    e.preventDefault();
    if (!refundLoan) return;
    const amount = Number(refundAmount);
    if (!amount || amount <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setRefunding(true);
    const res = await fetch(`/api/loans/${refundLoan.id}/collections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "withdrawal", amount }),
    });
    setRefunding(false);

    if (!res.ok) {
      toast.error("Failed to refund savings");
      return;
    }
    const { loan: updatedLoan } = await res.json();
    updateLoanRow(updatedLoan);
    loadCashAccount();
    toast.success(`Refunded ${formatCurrency(amount)} to ${refundLoan.person_name}`);
    setRefundLoan(null);
  }

  async function openHistory(loan: Loan) {
    setHistoryLoan(loan);
    setHistoryLoading(true);
    const res = await fetch(`/api/loans/${loan.id}/collections`);
    setHistoryLoading(false);
    if (!res.ok) {
      toast.error("Failed to load collection history");
      setHistoryRows([]);
      return;
    }
    setHistoryRows(await res.json());
  }

  async function refreshHistory(loanId: string) {
    const res = await fetch(`/api/loans/${loanId}/collections`);
    if (res.ok) setHistoryRows(await res.json());
  }

  function openEditCollection(row: LoanCollection) {
    setEditCollection(row);
    setEditCollectionForm({
      amount: row.kind === "collection" ? String(row.collected_amount) : String(-row.savings_delta),
      date: row.collection_date,
      note: row.note || "",
      applyExcess: row.kind === "collection" && Number(row.installment_amount) > Number(historyLoan?.repayment_amount || 0),
    });
  }

  async function saveEditCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!editCollection || !historyLoan) return;
    setEditingCollection(true);
    const body: Record<string, unknown> = {
      collected_amount: Number(editCollectionForm.amount),
      note: editCollectionForm.note,
      apply_excess_to_principal: editCollectionForm.applyExcess,
    };
    if (editCollection.kind === "collection") body.collection_date = editCollectionForm.date;
    const res = await fetch(`/api/loans/${historyLoan.id}/collections/${editCollection.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setEditingCollection(false);
    if (!res.ok) {
      toast.error("Failed to update collection");
      return;
    }
    toast.success("Collection updated");
    setEditCollection(null);
    await refreshHistory(historyLoan.id);
    load();
    loadCashAccount();
  }

  async function handleCollectionDelete(row: LoanCollection) {
    if (!historyLoan) return;
    if (!confirm(`Delete this ${row.kind}? This also removes its linked transaction and restores balances.`)) return;
    const res = await fetch(`/api/loans/${historyLoan.id}/collections/${row.id}`, { method: "DELETE" });
    if (!res.ok) {
      toast.error("Failed to delete collection");
      return;
    }
    toast.success("Collection deleted");
    await refreshHistory(historyLoan.id);
    load();
    loadCashAccount();
  }

  function loanActions(loan: (typeof loans)[number]) {
    return (
      <div className="flex items-center justify-end gap-1">
        <Button
          variant="outline"
          size="sm"
          disabled={collectingId === loan.id}
          onClick={() => handleCollect(loan)}
          title="Record today's collection"
        >
          <Coins className="mr-1 h-3.5 w-3.5" />
          Collect
        </Button>
        <Button variant="ghost" size="icon" onClick={() => openManualCollect(loan)} title="Record collection (custom amount/date)">
          <Receipt className="h-4 w-4" />
        </Button>
        {Number(loan.savings_balance || 0) > 0 && (
          <Button variant="ghost" size="icon" onClick={() => openRefund(loan)} title="Refund savings">
            <Undo2 className="h-4 w-4" />
          </Button>
        )}
        <Button variant="ghost" size="icon" onClick={() => openHistory(loan)} title="Collection history">
          <History className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => handleEdit(loan)} title="Edit loan">
          <Pencil className="h-4 w-4" />
        </Button>
        <Button variant="ghost" size="icon" onClick={() => handleDelete(loan.id)} title="Delete loan">
          <Trash2 className="h-4 w-4" />
        </Button>
      </div>
    );
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Loans Out</h1>
          <p className="text-muted-foreground">
            Track borrowers, automatically calculate payments, and monitor loan cash flow.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-4 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-chart-3/15">
              <TrendingUp className="h-5 w-5 text-chart-3" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total expected profit</p>
              <p className="text-xl font-bold">{formatCurrency(profitTotals.expected)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-4 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-chart-2/15">
              <Coins className="h-5 w-5 text-chart-2" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Total realized profit</p>
              <p className="text-xl font-bold">{formatCurrency(profitTotals.realized)}</p>
            </div>
          </div>
          <div className="flex items-center gap-3 rounded-xl bg-muted/40 p-4 shadow-sm">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15">
              <Wallet className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Cash on Collected Loans</p>
              <p className="text-xl font-bold">{formatCurrency(cashAccount?.balance || 0)}</p>
            </div>
          </div>
        </div>

        <div className="space-y-8">
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h2 className="text-2xl font-bold tracking-tight">Existing borrowers</h2>
                <p className="text-sm text-muted-foreground">{filteredLoans.length} loans shown</p>
              </div>
              <div className="flex flex-1 max-w-lg items-center gap-2">
                <div className="relative flex-1">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    placeholder="Search borrowers..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-9 w-full bg-muted/40"
                  />
                </div>
                <Button onClick={openNewLoan}>
                  <Plus className="mr-2 h-4 w-4" />
                  Add Loan
                </Button>
              </div>
            </div>
            
            <Tabs value={filter} onValueChange={(v) => setFilter(v as "all" | "active" | "delayed" | "completed")} className="w-full flex-col">
              <div className="flex items-center justify-between gap-4 mb-4">
                <TabsList>
                  <TabsTrigger value="all">All</TabsTrigger>
                  <TabsTrigger value="active">Active</TabsTrigger>
                  <TabsTrigger value="delayed">Delayed</TabsTrigger>
                  <TabsTrigger value="completed">Completed</TabsTrigger>
                </TabsList>
              </div>

              {filteredLoans.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 rounded-xl border border-dashed py-16 text-center">
                  <HandCoins className="h-10 w-10 text-muted-foreground/40" />
                  <p className="text-sm text-muted-foreground">No loans match this filter.</p>
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                  {filteredLoans.map((loan) => {
                    const { expected, realized } = loanProfit(loan);
                    const status = getLoanStatus(loan);
                    const isCompleted = Number(loan.remaining_balance) <= 0;

                    return (
                      <Card key={loan.id} className="flex flex-col border-border/60 shadow-none hover:bg-secondary/10 transition-colors">
                        <CardHeader className="pb-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0 flex-1">
                              <CardTitle className="text-base leading-tight">
                                <span className="break-words">{loan.person_name}</span>
                                {status.isDelayed && !isCompleted && (
                                  <Badge variant="destructive" className="ml-2 inline-flex h-5 px-1.5 text-[10px] align-middle">
                                    Delayed {status.daysDelayed > 0 && `(${status.daysDelayed}d)`}
                                  </Badge>
                                )}
                                {status.isAhead && !isCompleted && status.daysAhead > 0 && (
                                  <Badge variant="default" className="ml-2 inline-flex bg-emerald-500 hover:bg-emerald-600 h-5 px-1.5 text-[10px] align-middle">
                                    Ahead ({status.daysAhead}d)
                                  </Badge>
                                )}
                                {isCompleted && (
                                  <Badge variant="default" className="ml-2 inline-flex bg-green-600 h-5 px-1.5 text-[10px] align-middle">Paid</Badge>
                                )}
                              </CardTitle>
                              <CardDescription className="capitalize mt-1.5 truncate">
                                {loan.frequency} · {loan.funding_source === "fresh_capital" ? "Fresh Capital" : "Reinvested"}
                              </CardDescription>
                            </div>
                            <div className="text-right shrink-0">
                              <p className="text-lg font-bold text-primary leading-none">
                                {formatCurrency(loan.remaining_balance || 0)}
                              </p>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground mt-1">Outstanding</p>
                            </div>
                          </div>
                        </CardHeader>
                        <CardContent className="flex-1 pb-3 text-sm">
                          <div className="grid grid-cols-2 gap-y-4 gap-x-4">
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Start Date
                              </p>
                              <p className="font-medium mt-0.5">{loan.start_date ? formatDate(loan.start_date) : "N/A"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Expected End
                              </p>
                              <p className="font-medium mt-0.5">{status.expectedEndDate ? formatDate(status.expectedEndDate) : "N/A"}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Principal
                              </p>
                              <p className="font-medium mt-0.5">{formatCurrency(loan.total_amount)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Interest Rate
                              </p>
                              <p className="font-medium mt-0.5">{loan.interest_rate}%</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Total Payments
                              </p>
                              <p className="font-medium mt-0.5">{formatCurrency(status.actualTotal)}</p>
                            </div>
                            <div>
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Total Savings
                              </p>
                              <p className="font-medium mt-0.5 text-chart-2">{formatCurrency(loan.savings_balance || 0)}</p>
                            </div>
                            <div className="col-span-2 border-t border-border/40 pt-2 mt-1">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Total Cash Collected
                              </p>
                              <p className="font-medium mt-0.5 text-primary">{formatCurrency(status.actualTotal + Number(loan.savings_balance || 0))}</p>
                            </div>
                            <div className="col-span-2">
                              <p className="text-[10px] uppercase tracking-wider text-muted-foreground">
                                Profit
                              </p>
                              <p className="font-medium mt-0.5">
                                {formatCurrency(expected)} <span className="text-[10px] text-chart-2">({formatCurrency(realized)} realized)</span>
                              </p>
                            </div>
                          </div>
                        </CardContent>
                        <div className="border-t border-border/40 bg-muted/10 p-2 flex flex-wrap items-center justify-end gap-1">
                          {loanActions(loan)}
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
            </Tabs>
          </div>
        </div>
      </div>

      <Dialog open={isFormOpen} onOpenChange={(v) => { if (!v) resetForm(); }}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Edit borrower loan" : "New borrower loan"}</DialogTitle>
            <p className="text-sm text-muted-foreground">
              Interest and payment amounts are calculated automatically as you type.
            </p>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-6 mt-4">
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              <div className="space-y-2 md:col-span-2">
                <Label>Borrower name</Label>
                <Input
                  value={form.person_name}
                  onChange={(e) => setForm({ ...form, person_name: e.target.value })}
                  placeholder="Borrower name"
                  required
                />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label>Principal amount</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.total_amount}
                  onChange={(e) => setForm({ ...form, total_amount: e.target.value })}
                  placeholder="Principal amount"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Interest rate (%)</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={form.interest_rate}
                  onChange={(e) => setForm({ ...form, interest_rate: e.target.value })}
                  placeholder="Interest rate (%)"
                />
              </div>
              <div className="space-y-2">
                <Label>Start date</Label>
                <Input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Frequency</Label>
                <Select
                  value={form.frequency}
                  onValueChange={(v) => setForm({ ...form, frequency: v as LoanFrequency })}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {frequencyOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label>Number of installments</Label>
                <Input
                  type="number"
                  value={form.installments}
                  onChange={(e) => setForm({ ...form, installments: e.target.value })}
                  placeholder="Installments"
                  required
                />
              </div>
            </div>
            
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              <div className="space-y-2">
                <Label>Source of Funds</Label>
                <Select
                  value={form.funding_source}
                  onValueChange={(v) => setForm({ ...form, funding_source: v as "reinvested" | "fresh_capital" })}
                >
                  <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reinvested">Reinvested Proceeds</SelectItem>
                    <SelectItem value="fresh_capital">Fresh Capital</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              <div className="flex flex-col gap-3 md:col-span-1 lg:col-span-2">
                <label className="flex items-start gap-3 rounded-xl bg-muted/40 p-3 shadow-sm">
                  <input
                    type="checkbox"
                    checked={form.advanced_interest}
                    onChange={(e) => setForm({ ...form, advanced_interest: e.target.checked, pocketed_interest: e.target.checked ? form.pocketed_interest : false })}
                    className="mt-1 h-4 w-4 rounded border-input accent-primary"
                  />
                  <div>
                    <span className="text-sm font-medium text-foreground">Collect interest upfront</span>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {form.advanced_interest
                        ? "Borrower receives principal minus interest. Installments are based on principal."
                        : "Borrower receives full principal. Installments cover principal plus interest."}
                    </p>
                  </div>
                </label>

                {form.advanced_interest && !editingId && (
                  <label className="flex items-start gap-3 rounded-xl bg-primary/10 border border-primary/20 p-3 shadow-sm ml-6">
                    <input
                      type="checkbox"
                      checked={form.pocketed_interest}
                      onChange={(e) => setForm({ ...form, pocketed_interest: e.target.checked })}
                      className="mt-1 h-4 w-4 rounded border-input accent-primary"
                    />
                    <div>
                      <span className="text-sm font-medium text-primary">Log as Personal Payable</span>
                      <p className="text-xs text-primary/80 mt-0.5">
                        Automatically deducts the upfront interest from your Cash on Hand (since you pocketed it).
                      </p>
                    </div>
                  </label>
                )}
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-xl bg-muted/40 p-4 text-center shadow-sm">
                <p className="text-[0.625rem] uppercase tracking-[0.2em] text-muted-foreground">Installment</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{formatCurrency(computedLoan.repaymentAmount)}</p>
                <p className="mt-1 text-[0.7rem] text-muted-foreground">per payment</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-4 text-center shadow-sm">
                <p className="text-[0.625rem] uppercase tracking-[0.2em] text-muted-foreground">Released amount</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{formatCurrency(computedLoan.amountReleased)}</p>
                <p className="mt-1 text-[0.7rem] text-muted-foreground">cash to borrower</p>
              </div>
              <div className="rounded-xl bg-muted/40 p-4 text-center shadow-sm">
                <p className="text-[0.625rem] uppercase tracking-[0.2em] text-muted-foreground">Total due</p>
                <p className="mt-2 text-lg font-semibold text-foreground">{formatCurrency(computedLoan.remainingBalance)}</p>
                <p className="mt-1 text-[0.7rem] text-muted-foreground">principal + interest</p>
              </div>
            </div>

            <DialogFooter className="pt-2 border-t border-border/40">
              <Button type="button" variant="outline" onClick={resetForm}>
                Cancel
              </Button>
              <Button type="submit" disabled={saving}>
                <Plus className="mr-2 h-4 w-4" />
                {editingId ? "Update loan" : "Add loan"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={!!refundLoan} onOpenChange={(v) => { if (!v) setRefundLoan(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Refund savings{refundLoan ? ` · ${refundLoan.person_name}` : ""}</DialogTitle>
          </DialogHeader>
          {refundLoan && (
            <form onSubmit={handleRefund} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                {refundLoan.person_name} has {formatCurrency(refundLoan.savings_balance || 0)} in refundable savings.
              </p>
              <div className="space-y-2">
                <Label>Amount to refund</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  max={refundLoan.savings_balance || 0}
                  value={refundAmount}
                  onChange={(e) => setRefundAmount(e.target.value)}
                  required
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setRefundLoan(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={refunding}>
                  {refunding ? "Refunding..." : "Refund"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!collectLoan} onOpenChange={(v) => { if (!v) setCollectLoan(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record collection{collectLoan ? ` · ${collectLoan.person_name}` : ""}</DialogTitle>
          </DialogHeader>
          {collectLoan && (
            <form onSubmit={handleManualCollect} className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Log a custom collection amount and date for {collectLoan.person_name}.
              </p>
              <div className="space-y-2">
                <Label>Amount collected</Label>
                <Input
                  type="number"
                  step="0.01"
                  min="0"
                  value={collectForm.amount}
                  onChange={(e) => setCollectForm({ ...collectForm, amount: e.target.value })}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>Collection date</Label>
                <Input
                  type="date"
                  value={collectForm.date}
                  onChange={(e) => setCollectForm({ ...collectForm, date: e.target.value })}
                  required
                />
              </div>
              <label className="flex items-center gap-2 mt-2">
                <input
                  type="checkbox"
                  checked={collectForm.applyExcess}
                  onChange={(e) => setCollectForm({ ...collectForm, applyExcess: e.target.checked })}
                  className="rounded border-input accent-primary h-4 w-4"
                />
                <span className="text-sm font-medium">Apply excess entirely to loan (do not save)</span>
              </label>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setCollectLoan(null)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={collectingManual}>
                  {collectingManual ? "Recording..." : "Record collection"}
                </Button>
              </DialogFooter>
            </form>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!historyLoan} onOpenChange={(v) => { if (!v) { setHistoryLoan(null); setHistoryRows([]); } }}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Collection history{historyLoan ? ` · ${historyLoan.person_name}` : ""}</DialogTitle>
            {!historyLoading && historyRows.length > 0 && (
              <p className="text-sm text-muted-foreground mt-1">
                Total cash collected: {formatCurrency(
                  historyRows.reduce((acc, row) => row.kind === "collection" ? acc + Number(row.collected_amount) : acc, 0)
                )}
              </p>
            )}
          </DialogHeader>
          {historyLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading...</p>
          ) : historyRows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No collections recorded yet.</p>
          ) : (
            <div className="max-h-80 space-y-2 overflow-y-auto pr-1">
              {historyRows.map((row) => (
                <div
                  key={row.id}
                  className="flex items-center justify-between rounded-xl bg-muted/40 px-3 py-2 text-sm shadow-sm"
                >
                  <div>
                    <p className="font-medium capitalize">{row.kind}</p>
                    <p className="text-xs text-muted-foreground">{formatDate(row.collection_date)}</p>
                  </div>
                  <div className="flex items-center gap-1">
                    <div className="text-right">
                      <p className="font-medium">
                        {row.kind === "collection" ? formatCurrency(row.collected_amount) : `-${formatCurrency(-row.savings_delta)}`}
                      </p>
                      {row.kind === "collection" && (
                        <p className="text-xs text-chart-2">+{formatCurrency(row.savings_delta)} savings</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditCollection(row)}
                      title="Edit"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive"
                      onClick={() => handleCollectionDelete(row)}
                      title="Delete"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={!!editCollection} onOpenChange={(v) => { if (!v) setEditCollection(null); }}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="capitalize">
              Edit {editCollection?.kind}{historyLoan ? ` · ${historyLoan.person_name}` : ""}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={saveEditCollection} className="space-y-4">
            <div className="space-y-2">
              <Label>{editCollection?.kind === "collection" ? "Collected amount" : "Withdrawal amount"}</Label>
              <Input
                type="number"
                step="0.01"
                value={editCollectionForm.amount}
                onChange={(e) => setEditCollectionForm((f) => ({ ...f, amount: e.target.value }))}
                required
              />
            </div>
            {editCollection?.kind === "collection" && (
              <>
                <div className="space-y-2">
                  <Label>Collection date</Label>
                  <Input
                    type="date"
                    value={editCollectionForm.date}
                    onChange={(e) => setEditCollectionForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
                <label className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={editCollectionForm.applyExcess}
                    onChange={(e) => setEditCollectionForm((f) => ({ ...f, applyExcess: e.target.checked }))}
                    className="rounded border-input accent-primary h-4 w-4"
                  />
                  <span className="text-sm font-medium">Apply excess entirely to loan (do not save)</span>
                </label>
              </>
            )}
            <div className="space-y-2">
              <Label>Note</Label>
              <Input
                value={editCollectionForm.note}
                onChange={(e) => setEditCollectionForm((f) => ({ ...f, note: e.target.value }))}
                placeholder="Optional"
              />
            </div>
            <DialogFooter>
              <Button type="submit" disabled={editingCollection}>
                {editingCollection ? "Saving..." : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
