"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, PiggyBank } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { CashRecordActions } from "@/components/cash-record-actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils/finance";
import { CategoryIconBadge, EXPENSE_CATEGORIES } from "@/components/category-icon";

type Period = "weekly" | "monthly";
type CategoryBudget = { key?: string; category: string; subcategory: string; limit: number; spent?: number; color?: string | null };
type BudgetData = { period: Period; spent: number; totalBudgeted: number; remaining: number; categoryBudgets: CategoryBudget[] };

export default function BudgetPage() {
  const [data, setData] = useState<BudgetData | null>(null);
  const [period, setPeriod] = useState<Period>("weekly");
  const [amount, setAmount] = useState("");
  const [category, setCategory] = useState("");
  const [subcategory, setSubcategory] = useState("");
  const [budgets, setBudgets] = useState<CategoryBudget[]>([]);
  const [saving, setSaving] = useState(false);

  function load(nextPeriod?: Period) {
    const periodQuery = nextPeriod ? `?period=${nextPeriod}` : "";
    return fetch(`/api/budget${periodQuery}`)
      .then((response) => response.json())
      .then((next: BudgetData) => {
        setData(next);
        setPeriod(next.period || "weekly");
        setBudgets(next.categoryBudgets || []);
      });
  }

  useEffect(() => { load(); }, []);

  async function persist(nextBudgets: CategoryBudget[], successMessage: string) {
    setSaving(true);
    const response = await fetch("/api/budget", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ period, categoryBudgets: nextBudgets }),
    });
    setSaving(false);
    if (!response.ok) return toast.error("Could not save your budget");
    toast.success(successMessage);
    window.dispatchEvent(new Event("budget-updated"));
    await load();
  }

  async function saveBudget() {
    if (!amount || Number(amount) <= 0) return toast.error("Enter the amount you want to budget");
    if (!category) return toast.error("Choose a spending category");
    const match = (item: CategoryBudget) => item.category.toLowerCase() === category.toLowerCase() && item.subcategory.toLowerCase() === subcategory.trim().toLowerCase();
    const nextBudget = { category, subcategory: subcategory.trim(), limit: Number(amount) };
    const nextBudgets = budgets.some(match) ? budgets.map((item) => match(item) ? { ...item, limit: nextBudget.limit } : item) : [...budgets, nextBudget];
    await persist(nextBudgets, "Budget saved");
    setAmount("");
    setSubcategory("");
  }

  const totalBudgeted = data?.totalBudgeted || 0;
  const spent = data?.spent || 0;
  const percentage = totalBudgeted ? Math.round((spent / totalBudgeted) * 100) : 0;
  const overspending = totalBudgeted > 0 && spent > totalBudgeted;
  const periodTitle = period === "weekly" ? "week" : "month";

  return (
    <AppShell>
      <div className="budget-page">
        <section className="budget-heading budget-heading-actions">
          <div><p className="eyebrow"><PiggyBank className="h-3.5 w-3.5" /> {period === "weekly" ? "Weekly plan" : "Monthly plan"}</p>
          <h2>Stay ahead of overspending.</h2>
          <p>Give each spending plan a clear amount, then see how close you are to it.</p></div>
          <div className="dashboard-actions"><CashRecordActions onSuccess={() => void load()} /></div>
        </section>

        <section className={`budget-hero ${overspending ? "over" : ""}`}>
          <div>
            <p className="budget-label">{totalBudgeted ? (overspending ? "Over planned budget" : `Left to spend this ${periodTitle}`) : `No ${period} budget yet`}</p>
            <strong>{totalBudgeted ? formatCurrency(Math.abs(totalBudgeted - spent)) : "₱0.00"}</strong>
            <p>{totalBudgeted ? `${formatCurrency(spent)} cash out of ${formatCurrency(totalBudgeted)} planned` : "Add your first category budget below."}</p>
          </div>
          <div className="budget-status">{overspending ? <AlertTriangle className="h-6 w-6" /> : <CheckCircle2 className="h-6 w-6" />}<span>{totalBudgeted ? (overspending ? "Time to slow down" : percentage >= 80 ? "Getting close" : "On track") : "No budget set"}</span></div>
          <div className="budget-progress"><i style={{ width: `${Math.min(percentage, 100)}%` }} /></div>
        </section>

        <section className="budget-grid">
          <article className="panel budget-settings">
            <div className="panel-heading"><div><p className="section-kicker">NEW BUDGET</p><h3>Plan a spending category</h3></div></div>
            <p>For example: set a weekly ₱10,000 plan for Food & groceries, then name it Grocery.</p>
            <div className="budget-form-grid">
              <div className="budget-field period-field">
                <Label htmlFor="budget-period">Budget period</Label>
                <Select value={period} onValueChange={(value) => void load(value as Period)}>
                  <SelectTrigger id="budget-period"><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="weekly">Weekly</SelectItem><SelectItem value="monthly">Monthly</SelectItem></SelectContent>
                </Select>
              </div>
              <div className="budget-field amount-field">
                <Label htmlFor="budget-amount">Budget amount</Label>
                <div className="budget-input"><span>₱</span><Input id="budget-amount" type="number" min="0" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="10,000" /></div>
              </div>
              <div className="budget-field">
                <Label htmlFor="budget-category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="budget-category"><SelectValue placeholder="Choose a category" /></SelectTrigger>
                  <SelectContent>{EXPENSE_CATEGORIES.map((item) => <SelectItem key={item} value={item}><span className="category-select-option"><CategoryIconBadge compact category={item} />{item}</span></SelectItem>)}</SelectContent>
                </Select>
              </div>
              <div className="budget-field">
                <Label htmlFor="budget-subcategory">Subcategory <span>(optional)</span></Label>
                <Input id="budget-subcategory" value={subcategory} onChange={(event) => setSubcategory(event.target.value)} placeholder="e.g. Grocery" />
              </div>
            </div>
            <Button onClick={saveBudget} disabled={saving}>{saving ? "Saving…" : "Save budget"}</Button>
          </article>

          <article className="panel category-budgets">
            <div className="panel-heading"><div><p className="section-kicker">SPENDING PROGRESS</p><h3>Category limits</h3></div></div>
            <p className="panel-subtitle">Each plan stays here so you can see exactly how far over—or under—you are.</p>
            {budgets.length ? (
              <div className="budget-category-list">
                {budgets.map((item, index) => {
                  const limit = Number(item.limit) || 0;
                  const itemSpent = Number(item.spent) || 0;
                  const over = limit > 0 && itemSpent > limit;
                  return <div className="budget-category" key={item.key || `${item.category}-${item.subcategory}-${index}`}>
                    <CategoryIconBadge category={item.category} className="budget-category-icon" />
                    <div><strong>{item.category}</strong>{item.subcategory && <small>{item.subcategory}</small>}<p className={over ? "over-text" : ""}>{formatCurrency(itemSpent)} spent of {formatCurrency(limit)}{over ? ` · ${formatCurrency(itemSpent - limit)} over` : ""}</p></div>
                    <Input type="number" min="0" inputMode="decimal" aria-label={`${item.category} budget limit`} value={String(item.limit || "")} onChange={(event) => setBudgets(budgets.map((budget, budgetIndex) => budgetIndex === index ? { ...budget, limit: Number(event.target.value) || 0 } : budget))} />
                  </div>;
                })}
                <Button className="save-categories" onClick={() => persist(budgets, "Category limits updated")} disabled={saving}>{saving ? "Saving…" : "Save changes"}</Button>
              </div>
            ) : <div className="empty-panel"><PiggyBank className="h-8 w-8" /><p>Save a category budget to see its spending progress here.</p></div>}
          </article>
        </section>
      </div>
    </AppShell>
  );
}
