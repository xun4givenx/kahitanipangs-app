"use client";

import { useEffect, useMemo, useState } from "react";
import { format } from "date-fns";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { formatCurrency, formatDate, loanProfit } from "@/lib/utils/finance";
import type { Account, Loan, LoanCollection, LoanFrequency } from "@/types/database";
import {
  Plus, Pencil, Trash2, HandCoins, Coins, Undo2, History, PiggyBank, Receipt,
  TrendingUp, Wallet,
} from "lucide-react";

const frequencyOptions: { value: LoanFrequency; label: string }[] = [
  { value: "daily", label: "Daily" },
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Biweekly" },
  { value: "monthly", label: "Monthly" },
];

const monthlyMultiplier: Record<LoanFrequency, number> = {
  daily: 30.4,
  weekly: 4.33,
  biweekly: 2.17,
  monthly: 1,
};

function getMonthlyFlow(loan: Loan): number {
  return Number(loan.repayment_amount || 0) * (monthlyMultiplier[loan.frequency] || 1);
}

function getNextPaymentDate(loan: Loan): string {
  if (!loan.start_date) return "—";
  const today = new Date();
  const nextDate = new Date(loan.start_date);
  for (let i = 0; i < 120 && nextDate < today; i += 1) {
    if (loan.frequency === "daily") nextDate.setDate(nextDate.getDate() + 1);
    else if (loan.frequency === "weekly") nextDate.setDate(nextDate.getDate() + 7);
    else if (loan.frequency === "biweekly") nextDate.setDate(nextDate.getDate() + 14);
    else nextDate.setMonth(nextDate.getMonth() + 1);
  }
  return format(nextDate, "MMM d, yyyy");
}

const initialForm = {
  person_name: "",
  total_amount: "",
  interest_rate: "",
  start_date: new Date().toISOString().split("T")[0],
  frequency: "monthly" as LoanFrequency,
  installments: "",
  advanced_interest: false,
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
  const [collectForm, setCollectForm] = useState({ amount: "", date: new Date().toISOString().split("T")[0] });
  const [collectingManual, setCollectingManual] = useState(false);
  const [cashAccount, setCashAccount] = useState<Account | null>(null);
  const [editCollection, setEditCollection] = useState<LoanCollection | null>(null);
  const [editCollectionForm, setEditCollectionForm] = useState({ amount: "", date: "", note: "" });
  const [editingCollection, setEditingCollection] = useState(false);

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
    const res = await fetch("/api/accounts");
    if (!res.ok) return;
    const data: Account[] = await res.json();
    setCashAccount(data.find((a) => a.name === "Cash on Collected Loans") || null);
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
    const payload = {
      person_name: form.person_name,
      total_amount: Number(form.total_amount),
      interest_rate: Number(form.interest_rate) || 0,
      start_date: form.start_date,
      frequency: form.frequency,
      installments: Number(form.installments) || 0,
      repayment_amount: Number(computedLoan.repaymentAmount.toFixed(2)),
      remaining_balance: Number(computedLoan.remainingBalance.toFixed(2)),
      advanced_interest: form.advanced_interest,
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
      installments: loan.installments?.toString() || "",
      advanced_interest: Boolean(loan.advanced_interest),
    });
    setEditingId(loan.id);
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
    setCollectingId(loan.id);
    const res = await fetch(`/api/loans/${loan.id}/collections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "collection" }),
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
    setCollectLoan(loan);
    setCollectForm({
      amount: String(loan.repayment_amount || 0),
      date: new Date().toISOString().split("T")[0],
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
    });
  }

  async function saveEditCollection(e: React.FormEvent) {
    e.preventDefault();
    if (!editCollection || !historyLoan) return;
    setEditingCollection(true);
    const body: Record<string, unknown> = {
      collected_amount: Number(editCollectionForm.amount),
      note: editCollectionForm.note,
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

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>{editingId ? "Edit borrower loan" : "New borrower loan"}</CardTitle>
              <CardDescription>
                Interest and payment amounts are calculated automatically as you type.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-4">
                <div className="space-y-2">
                  <Label>Borrower name</Label>
                  <Input
                    value={form.person_name}
                    onChange={(e) => setForm({ ...form, person_name: e.target.value })}
                    placeholder="Borrower name"
                    required
                  />
                </div>
                <div className="space-y-2">
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
                <div className="grid gap-4 md:grid-cols-2">
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
                </div>
                <div className="grid gap-4 md:grid-cols-2">
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
                      placeholder="Number of installments"
                      required
                    />
                  </div>
                </div>
                <label className="flex items-start gap-3 rounded-xl bg-muted/40 p-3 shadow-sm">
                  <input
                    type="checkbox"
                    checked={form.advanced_interest}
                    onChange={(e) => setForm({ ...form, advanced_interest: e.target.checked })}
                    className="mt-1 h-4 w-4 rounded border-input accent-primary"
                  />
                  <div>
                    <span className="text-sm font-medium text-foreground">Collect interest upfront</span>
                    <p className="text-xs text-muted-foreground">
                      {form.advanced_interest
                        ? "Borrower receives principal minus interest. Installments are based on principal."
                        : "Borrower receives full principal. Installments cover principal plus interest."}
                    </p>
                  </div>
                </label>

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

                <div className="flex flex-wrap gap-2">
                  <Button type="submit" disabled={saving}>
                    <Plus className="mr-2 h-4 w-4" />
                    {editingId ? "Update loan" : "Add loan"}
                  </Button>
                  {editingId && (
                    <Button type="button" variant="outline" onClick={resetForm}>
                      Cancel
                    </Button>
                  )}
                </div>
              </form>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Existing borrowers</CardTitle>
              <CardDescription>{loans.length} loan{loans.length === 1 ? "" : "s"} outstanding</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="hidden w-full overflow-x-auto md:block">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Borrower</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Payment</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Next due</TableHead>
                    <TableHead className="text-right">Savings held</TableHead>
                    <TableHead className="text-right">Profit</TableHead>
                    <TableHead className="w-44" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={9} className="py-10 text-center text-muted-foreground">
                        <HandCoins className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                        No loans yet. Add your first borrower to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    loans.map((loan) => {
                      const { expected, realized } = loanProfit(loan);
                      const progress = expected > 0 ? Math.min(100, (realized / expected) * 100) : 0;
                      return (
                      <TableRow key={loan.id} className="hover:bg-muted/40">
                        <TableCell className="font-medium">{loan.person_name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(loan.total_amount || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(loan.remaining_balance || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(getMonthlyFlow(loan))}</TableCell>
                        <TableCell className="capitalize">{loan.frequency}</TableCell>
                        <TableCell>{getNextPaymentDate(loan)}</TableCell>
                        <TableCell className="text-right">
                          <span className="inline-flex items-center gap-1 font-medium text-chart-2">
                            <PiggyBank className="h-3.5 w-3.5" />
                            {formatCurrency(loan.savings_balance || 0)}
                          </span>
                        </TableCell>
                        <TableCell className="text-right">
                          <div className="ml-auto w-32">
                            <p className="font-semibold text-foreground">{formatCurrency(expected)}</p>
                            <p className="text-xs text-chart-2">{formatCurrency(realized)} earned</p>
                            <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full rounded-full bg-chart-2"
                                style={{ width: `${progress}%` }}
                              />
                            </div>
                          </div>
                        </TableCell>
                        <TableCell>
                          {loanActions(loan)}
                        </TableCell>
                      </TableRow>
                      );
                    })
                  )}
                </TableBody>
              </Table>
              </div>
              <div className="space-y-3 md:hidden">
                {loans.length === 0 ? (
                  <div className="py-10 text-center text-muted-foreground">
                    <HandCoins className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                    No loans yet. Add your first borrower to get started.
                  </div>
                ) : (
                  loans.map((loan) => {
                    const { expected, realized } = loanProfit(loan);
                    const progress = expected > 0 ? Math.min(100, (realized / expected) * 100) : 0;
                    return (
                      <div key={loan.id} className="rounded-lg border border-border/60 p-3">
                        <div className="flex items-start justify-between gap-2">
                          <p className="font-medium">{loan.person_name}</p>
                          <span className="text-sm capitalize text-muted-foreground">{loan.frequency}</span>
                        </div>
                        <dl className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                          <dt className="text-muted-foreground">Outstanding</dt>
                          <dd className="text-right font-medium">{formatCurrency(loan.remaining_balance || 0)}</dd>
                          <dt className="text-muted-foreground">Payment</dt>
                          <dd className="text-right">{formatCurrency(getMonthlyFlow(loan))}</dd>
                          <dt className="text-muted-foreground">Next due</dt>
                          <dd className="text-right">{getNextPaymentDate(loan)}</dd>
                          <dt className="text-muted-foreground">Savings held</dt>
                          <dd className="text-right">{formatCurrency(loan.savings_balance || 0)}</dd>
                          <dt className="text-muted-foreground">Profit</dt>
                          <dd className="text-right">
                            {formatCurrency(expected)}{" "}
                            <span className="text-xs text-chart-2">({formatCurrency(realized)} earned)</span>
                          </dd>
                        </dl>
                        <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
                          <div className="h-full rounded-full bg-chart-2" style={{ width: `${progress}%` }} />
                        </div>
                        <div className="mt-3 flex flex-wrap justify-end gap-1">{loanActions(loan)}</div>
                      </div>
                    );
                  })
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

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
              <div className="space-y-2">
                <Label>Collection date</Label>
                <Input
                  type="date"
                  value={editCollectionForm.date}
                  onChange={(e) => setEditCollectionForm((f) => ({ ...f, date: e.target.value }))}
                />
              </div>
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
