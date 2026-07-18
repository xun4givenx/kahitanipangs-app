"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
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
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/utils/finance";
import type { Debt, DebtPlan, DebtPayment } from "@/types/database";
import { Plus, Trash2, Pencil, Sparkles, DollarSign, CreditCard as CreditCardIcon, Receipt } from "lucide-react";

export default function DebtsPage() {
  const [debts, setDebts] = useState<Debt[]>([]);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [open, setOpen] = useState(false);
  const [paymentOpen, setPaymentOpen] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [editing, setEditing] = useState<Debt | null>(null);
  const [activePlan, setActivePlan] = useState<DebtPlan | null>(null);
  const [form, setForm] = useState({
    name: "", creditor: "", balance: "", interest_rate: "0",
    minimum_payment: "0", due_day: "", notes: "",
  });
  const [paymentForm, setPaymentForm] = useState({
    debt_id: "", amount: "", payment_date: new Date().toISOString().split("T")[0], notes: "",
  });
  const [planForm, setPlanForm] = useState({ strategy: "avalanche", monthly_budget: "" });

  async function load() {
    const [debtsRes, plansRes, paymentsRes] = await Promise.all([
      fetch("/api/debts").then((r) => r.json()),
      fetch("/api/debt-plans").then((r) => r.json()),
      fetch("/api/debt-payments").then((r) => r.json()),
    ]);
    setDebts(debtsRes);
    setPayments(paymentsRes);
    if (plansRes.length) setActivePlan(plansRes[0]);
  }

  useEffect(() => { load(); }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const url = editing ? `/api/debts/${editing.id}` : "/api/debts";
    const method = editing ? "PUT" : "POST";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...form,
        balance: parseFloat(form.balance),
        interest_rate: parseFloat(form.interest_rate),
        minimum_payment: parseFloat(form.minimum_payment),
        due_day: form.due_day ? parseInt(form.due_day) : null,
      }),
    });

    if (!res.ok) { toast.error("Failed to save debt"); return; }
    toast.success(editing ? "Debt updated" : "Debt created");
    setOpen(false);
    setEditing(null);
    setForm({ name: "", creditor: "", balance: "", interest_rate: "0", minimum_payment: "0", due_day: "", notes: "" });
    load();
  }

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!paymentForm.debt_id) {
      toast.error("Select a debt");
      return;
    }
    const res = await fetch("/api/debt-payments", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        ...paymentForm,
        amount: parseFloat(paymentForm.amount),
      }),
    });
    if (!res.ok) { toast.error("Failed to record payment"); return; }
    toast.success("Payment recorded");
    setPaymentOpen(false);
    load();
  }

  async function handleGeneratePlan(e: React.FormEvent) {
    e.preventDefault();
    setPlanOpen(false);
    toast.info("Generating payoff plan...");
    const res = await fetch("/api/debt-plans", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        strategy: planForm.strategy,
        monthly_budget: parseFloat(planForm.monthly_budget),
      }),
    });
    if (!res.ok) {
      const err = await res.json();
      toast.error(err.error || "Failed to generate plan");
      return;
    }
    const plan = await res.json();
    setActivePlan(plan);
    toast.success("Payoff plan generated!");
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm("Delete this debt?")) return;
    await fetch(`/api/debts/${id}`, { method: "DELETE" });
    toast.success("Debt deleted");
    load();
  }

  const totalDebt = debts.reduce((s, d) => s + Number(d.balance), 0);
  const totalMinPayments = debts.reduce((s, d) => s + Number(d.minimum_payment), 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Debt Tracker</h1>
            <p className="text-muted-foreground">
              Total debt: {formatCurrency(totalDebt)} · Min payments: {formatCurrency(totalMinPayments)}/mo
            </p>
          </div>
          <div className="flex gap-2">
            <Dialog open={paymentOpen} onOpenChange={setPaymentOpen}>
              <DialogTrigger asChild>
                <Button variant="outline"><DollarSign className="mr-2 h-4 w-4" />Record Payment</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Record Debt Payment</DialogTitle></DialogHeader>
                <form onSubmit={handlePayment} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Debt</Label>
                    <Select
                      value={paymentForm.debt_id}
                      onValueChange={(v) => setPaymentForm({ ...paymentForm, debt_id: v })}
                    >
                      <SelectTrigger className="w-full"><SelectValue placeholder="Select debt" /></SelectTrigger>
                      <SelectContent>
                        {debts.map((d) => (
                          <SelectItem key={d.id} value={d.id}>{d.name} ({formatCurrency(d.balance)})</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Amount</Label>
                    <Input type="number" step="0.01" value={paymentForm.amount} onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Date</Label>
                    <Input type="date" value={paymentForm.payment_date} onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })} />
                  </div>
                  <Button type="submit" className="w-full">Record Payment</Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={planOpen} onOpenChange={setPlanOpen}>
              <DialogTrigger asChild>
                <Button variant="outline"><Sparkles className="mr-2 h-4 w-4" />AI Payoff Planner</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>Generate Debt Payoff Plan</DialogTitle></DialogHeader>
                <form onSubmit={handleGeneratePlan} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Strategy</Label>
                    <Select
                      value={planForm.strategy}
                      onValueChange={(v) => setPlanForm({ ...planForm, strategy: v })}
                    >
                      <SelectTrigger className="w-full"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="avalanche">Avalanche (highest interest first)</SelectItem>
                        <SelectItem value="snowball">Snowball (smallest balance first)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label>Monthly Budget</Label>
                    <Input
                      type="number"
                      step="0.01"
                      value={planForm.monthly_budget}
                      onChange={(e) => setPlanForm({ ...planForm, monthly_budget: e.target.value })}
                      placeholder={`Min: ${formatCurrency(totalMinPayments)}`}
                      required
                    />
                  </div>
                  <Button type="submit" className="w-full">Generate Plan</Button>
                </form>
              </DialogContent>
            </Dialog>
            <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setEditing(null); }}>
              <DialogTrigger asChild>
                <Button><Plus className="mr-2 h-4 w-4" />Add Debt</Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader><DialogTitle>{editing ? "Edit" : "New"} Debt</DialogTitle></DialogHeader>
                <form onSubmit={handleSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label>Name</Label>
                    <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} required />
                  </div>
                  <div className="space-y-2">
                    <Label>Creditor</Label>
                    <Input value={form.creditor} onChange={(e) => setForm({ ...form, creditor: e.target.value })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Balance</Label>
                      <Input type="number" step="0.01" value={form.balance} onChange={(e) => setForm({ ...form, balance: e.target.value })} required />
                    </div>
                    <div className="space-y-2">
                      <Label>Interest Rate (%)</Label>
                      <Input type="number" step="0.01" value={form.interest_rate} onChange={(e) => setForm({ ...form, interest_rate: e.target.value })} />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Min Payment</Label>
                      <Input type="number" step="0.01" value={form.minimum_payment} onChange={(e) => setForm({ ...form, minimum_payment: e.target.value })} />
                    </div>
                    <div className="space-y-2">
                      <Label>Due Day</Label>
                      <Input type="number" min="1" max="31" value={form.due_day} onChange={(e) => setForm({ ...form, due_day: e.target.value })} />
                    </div>
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

        <Tabs defaultValue="debts">
          <TabsList>
            <TabsTrigger value="debts">Debts ({debts.length})</TabsTrigger>
            <TabsTrigger value="plan">Payoff Plan</TabsTrigger>
            <TabsTrigger value="payments">Payments</TabsTrigger>
          </TabsList>

          <TabsContent value="debts">
            <Card>
              <CardContent className="pt-6">
                {debts.length ? (
                  <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Creditor</TableHead>
                        <TableHead className="text-right">Balance</TableHead>
                        <TableHead className="text-right">APR</TableHead>
                        <TableHead className="text-right">Min Payment</TableHead>
                        <TableHead className="w-24" />
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {debts.map((d) => (
                        <TableRow key={d.id}>
                          <TableCell className="font-medium">{d.name}</TableCell>
                          <TableCell>{d.creditor || "—"}</TableCell>
                          <TableCell className="text-right">{formatCurrency(d.balance)}</TableCell>
                          <TableCell className="text-right">{d.interest_rate}%</TableCell>
                          <TableCell className="text-right">{formatCurrency(d.minimum_payment)}</TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button variant="ghost" size="icon" onClick={() => {
                                setEditing(d);
                                setForm({
                                  name: d.name, creditor: d.creditor || "", balance: String(d.balance),
                                  interest_rate: String(d.interest_rate), minimum_payment: String(d.minimum_payment),
                                  due_day: d.due_day ? String(d.due_day) : "", notes: d.notes || "",
                                });
                                setOpen(true);
                              }}><Pencil className="h-4 w-4" /></Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(d.id)}><Trash2 className="h-4 w-4" /></Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                    <CreditCardIcon className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      No debts tracked yet — add one to start planning your payoff.
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="plan">
            {activePlan ? (
              <div className="space-y-4">
                <div className="grid gap-4 md:grid-cols-3">
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Strategy</CardDescription>
                      <CardTitle className="capitalize">{activePlan.strategy}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Months to Payoff</CardDescription>
                      <CardTitle>{activePlan.months_to_payoff}</CardTitle>
                    </CardHeader>
                  </Card>
                  <Card>
                    <CardHeader className="pb-2">
                      <CardDescription>Total Interest</CardDescription>
                      <CardTitle>{formatCurrency(activePlan.total_interest || 0)}</CardTitle>
                    </CardHeader>
                  </Card>
                </div>

                <Card>
                  <CardHeader><CardTitle>Month-by-Month Schedule</CardTitle></CardHeader>
                  <CardContent className="max-h-96 overflow-auto">
                    <div className="w-full overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>Month</TableHead>
                          <TableHead>Payments</TableHead>
                          <TableHead className="text-right">Total Paid</TableHead>
                          <TableHead className="text-right">Interest</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {(activePlan.schedule || []).slice(0, 24).map((m) => (
                          <TableRow key={m.month}>
                            <TableCell>Month {m.month}</TableCell>
                            <TableCell>
                              <div className="space-y-1">
                                {m.payments.map((p, i) => (
                                  <div key={i} className="text-sm">
                                    {p.debt_name}: {formatCurrency(p.payment)}
                                    <span className="text-muted-foreground"> → {formatCurrency(p.remaining)}</span>
                                  </div>
                                ))}
                              </div>
                            </TableCell>
                            <TableCell className="text-right">{formatCurrency(m.total_paid)}</TableCell>
                            <TableCell className="text-right">{formatCurrency(m.total_interest)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                    </div>
                    {(activePlan.schedule || []).length > 24 && (
                      <p className="mt-2 text-sm text-muted-foreground">
                        Showing first 24 of {activePlan.schedule.length} months
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            ) : (
              <Card>
                <CardContent className="flex flex-col items-center justify-center py-12">
                  <Sparkles className="mb-4 h-12 w-12 text-muted-foreground" />
                  <p className="text-muted-foreground">Generate a payoff plan to see your schedule</p>
                  <Button className="mt-4" onClick={() => setPlanOpen(true)}>Generate Plan</Button>
                </CardContent>
              </Card>
            )}
          </TabsContent>

          <TabsContent value="payments">
            <Card>
              <CardContent className="pt-6">
                {payments.length ? (
                  <div className="w-full overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Date</TableHead>
                        <TableHead>Debt</TableHead>
                        <TableHead className="text-right">Amount</TableHead>
                        <TableHead>Notes</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payments.map((p) => (
                        <TableRow key={p.id}>
                          <TableCell>{p.payment_date}</TableCell>
                          <TableCell>{(p.debts as { name: string })?.name}</TableCell>
                          <TableCell className="text-right font-medium text-green-600">
                            {formatCurrency(p.amount)}
                          </TableCell>
                          <TableCell>{p.notes || "—"}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                    <Receipt className="h-10 w-10 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      No payments recorded yet.
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
