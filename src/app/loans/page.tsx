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
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/finance";
import type { Loan, LoanFrequency } from "@/types/database";
import { Plus, Pencil, Trash2, HandCoins } from "lucide-react";

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

  async function load() {
    const res = await fetch("/api/loans");
    if (!res.ok) {
      toast.error("Failed to load loans");
      return;
    }
    const data = await res.json();
    setLoans(data);
  }

  useEffect(() => { load(); }, []);

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

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold">Loans Out</h1>
          <p className="text-muted-foreground">
            Track borrowers, automatically calculate payments, and monitor loan cash flow.
          </p>
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
                <label className="flex items-start gap-3 rounded-lg border border-border bg-muted/30 p-3">
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
                  <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
                    <p className="text-[0.625rem] uppercase tracking-[0.2em] text-muted-foreground">Installment</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{formatCurrency(computedLoan.repaymentAmount)}</p>
                    <p className="mt-1 text-[0.7rem] text-muted-foreground">per payment</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
                    <p className="text-[0.625rem] uppercase tracking-[0.2em] text-muted-foreground">Released amount</p>
                    <p className="mt-2 text-lg font-semibold text-foreground">{formatCurrency(computedLoan.amountReleased)}</p>
                    <p className="mt-1 text-[0.7rem] text-muted-foreground">cash to borrower</p>
                  </div>
                  <div className="rounded-xl border border-border bg-muted/30 p-4 text-center">
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
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Borrower</TableHead>
                    <TableHead className="text-right">Principal</TableHead>
                    <TableHead className="text-right">Outstanding</TableHead>
                    <TableHead className="text-right">Payment</TableHead>
                    <TableHead>Frequency</TableHead>
                    <TableHead>Next due</TableHead>
                    <TableHead className="w-20" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {loans.length === 0 ? (
                    <TableRow>
                      <TableCell colSpan={7} className="py-10 text-center text-muted-foreground">
                        <HandCoins className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                        No loans yet. Add your first borrower to get started.
                      </TableCell>
                    </TableRow>
                  ) : (
                    loans.map((loan) => (
                      <TableRow key={loan.id}>
                        <TableCell className="font-medium">{loan.person_name}</TableCell>
                        <TableCell className="text-right">{formatCurrency(loan.total_amount || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(loan.remaining_balance || 0)}</TableCell>
                        <TableCell className="text-right">{formatCurrency(getMonthlyFlow(loan))}</TableCell>
                        <TableCell className="capitalize">{loan.frequency}</TableCell>
                        <TableCell>{getNextPaymentDate(loan)}</TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button variant="ghost" size="icon" onClick={() => handleEdit(loan)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon" onClick={() => handleDelete(loan.id)}>
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </div>
      </div>
    </AppShell>
  );
}
