"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import {
  ArrowDownRight,
  ArrowUpRight,
  ChevronRight,
  CircleDollarSign,
  Heart,
  LayoutList,
  Plus,
  ReceiptText,
  Sparkles,
  TrendingUp,
  UsersRound,
  WalletCards,
} from "lucide-react";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { AddSalaryDialog } from "@/components/add-salary-dialog";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { formatCurrency, formatDate } from "@/lib/utils/finance";
import type { Account, ScheduledTransaction, Transaction } from "@/types/database";

interface CategorySpending {
  name: string;
  amount: number;
  color: string | null;
}

interface MonthlyPoint {
  month: string;
  income: number;
  expense: number;
}

interface DashboardData {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  categorySpending: CategorySpending[];
  monthlySeries: MonthlyPoint[];
  recentTransactions: Transaction[];
  upcomingPayments: ScheduledTransaction[];
  accounts: Account[];
}

const expenseColors = ["#156f4a", "#2da66a", "#77c896", "#b8e1c5"];

const chartTooltip = {
  background: "#ffffff",
  border: "1px solid #dceee3",
  borderRadius: "14px",
  color: "#173d2c",
  boxShadow: "0 14px 40px rgba(21, 111, 74, 0.12)",
  fontSize: 12,
};

function getInitials(label: string) {
  return label
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0])
    .join("")
    .toUpperCase();
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  function loadDashboard() {
    setLoading(true);
    return fetch("/api/dashboard")
      .then((response) => response.json())
      .then(setData)
      .finally(() => setLoading(false));
  }

  useEffect(() => {
    loadDashboard();
  }, []);

  const topSpending = useMemo(
    () => (data?.categorySpending || []).slice(0, 4),
    [data?.categorySpending]
  );
  const monthExpenses = data?.monthlyExpenses || 0;
  const equalShare = monthExpenses / 2;
  const topCategory = topSpending[0];
  const hasChartData = (data?.monthlySeries || []).some(
    (month) => month.income > 0 || month.expense > 0
  );

  if (loading) {
    return (
      <AppShell>
        <div className="dashboard-loading" aria-label="Loading dashboard">
          <div className="loading-orbit" />
          <p>Preparing your shared money view…</p>
        </div>
      </AppShell>
    );
  }

  return (
    <AppShell>
      <div className="couples-dashboard">
        <section className="dashboard-welcome">
          <div>
            <div className="eyebrow"><Heart className="h-3.5 w-3.5 fill-current" /> Shared money, made simple</div>
            <h2>Good morning, <span>team.</span></h2>
            <p>See what&apos;s coming in, going out, and how to share it with ease.</p>
          </div>
          <div className="dashboard-actions">
            <Button asChild variant="outline" className="soft-button">
              <Link href="/transactions"><Plus className="h-4 w-4" /> Add expense</Link>
            </Button>
            <AddSalaryDialog onSuccess={loadDashboard} />
          </div>
        </section>

        <section className="balance-hero">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-orbit orbit-three" />
          <div className="hero-main">
            <div className="hero-label"><WalletCards className="h-4 w-4" /> Your shared balance</div>
            <p className="balance-value">{formatCurrency(data?.totalBalance || 0)}</p>
            <div className="income-pill"><ArrowUpRight className="h-4 w-4" /> {formatCurrency(data?.monthlyIncome || 0)} in this month</div>
          </div>
          <div className="hero-aside">
            <div className="couple-avatars" aria-label="Your shared wallet">
              <span className="avatar-person avatar-one">Y</span>
              <span className="avatar-person avatar-two">P</span>
              <span className="avatar-plus">+</span>
            </div>
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.14em] text-white/60">Couple&apos;s wallet</p>
              <p className="mt-1 text-sm font-medium text-white">Together in the green</p>
            </div>
          </div>
        </section>

        <section className="quick-stats">
          <div className="stat-card">
            <span className="stat-icon green"><ArrowUpRight className="h-5 w-5" /></span>
            <div><p>Money in</p><strong>{formatCurrency(data?.monthlyIncome || 0)}</strong><small>This month</small></div>
          </div>
          <div className="stat-card">
            <span className="stat-icon peach"><ArrowDownRight className="h-5 w-5" /></span>
            <div><p>Money out</p><strong>{formatCurrency(monthExpenses)}</strong><small>This month</small></div>
          </div>
          <div className="stat-card">
            <span className="stat-icon mint"><CircleDollarSign className="h-5 w-5" /></span>
            <div><p>Left to enjoy</p><strong>{formatCurrency(Math.max((data?.monthlyIncome || 0) - monthExpenses, 0))}</strong><small>After spending</small></div>
          </div>
        </section>

        <section className="dashboard-grid">
          <article className="panel shared-panel">
            <div className="panel-heading">
              <div><p className="section-kicker">COUPLE&apos;S PLAN</p><h3>Split it fairly</h3></div>
              <span className="equal-split"><UsersRound className="h-4 w-4" /> Equal split</span>
            </div>
            <p className="panel-subtitle">Based on this month&apos;s expenses, here&apos;s a simple 50/50 view for the two of you.</p>
            <div className="split-content">
              <div className="split-ring" style={{ background: "conic-gradient(#156f4a 0deg 180deg, #a9dcc0 180deg 360deg)" }}>
                <div className="split-ring-inner"><strong>50 / 50</strong><span>shared split</span></div>
              </div>
              <div className="split-details">
                <div><span><i className="dot dot-you" />Your share</span><strong>{formatCurrency(equalShare)}</strong></div>
                <div><span><i className="dot dot-partner" />Partner&apos;s share</span><strong>{formatCurrency(equalShare)}</strong></div>
                <Link href="/transactions" className="text-link">Review shared expenses <ChevronRight className="h-4 w-4" /></Link>
              </div>
            </div>
          </article>

          <article className="panel spending-panel">
            <div className="panel-heading">
              <div><p className="section-kicker">THIS MONTH</p><h3>Top spending</h3></div>
              <Link href="/categories" className="text-link">See all <ChevronRight className="h-4 w-4" /></Link>
            </div>
            {topSpending.length ? (
              <div className="spending-list">
                {topSpending.map((category, index) => {
                  const percentage = monthExpenses ? Math.round((category.amount / monthExpenses) * 100) : 0;
                  return (
                    <div className="spending-item" key={category.name}>
                      <span className="category-mark" style={{ backgroundColor: category.color || expenseColors[index] }}>{getInitials(category.name)}</span>
                      <div className="spending-copy"><div><strong>{category.name}</strong><span>{percentage}% of expenses</span></div><div className="spending-track"><i style={{ width: `${Math.max(percentage, 5)}%`, backgroundColor: category.color || expenseColors[index] }} /></div></div>
                      <strong className="spending-value">{formatCurrency(category.amount)}</strong>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="empty-panel"><ReceiptText className="h-8 w-8" /><p>Your category breakdown will appear as expenses are added.</p><Link href="/transactions">Add an expense</Link></div>
            )}
          </article>

          <article className="panel flow-panel">
            <div className="panel-heading"><div><p className="section-kicker">CASH FLOW</p><h3>Money in &amp; out</h3></div><span className="chart-note"><TrendingUp className="h-4 w-4" /> 6 months</span></div>
            {hasChartData ? (
              <div className="chart-wrap"><ResponsiveContainer width="100%" height={230}><AreaChart data={data?.monthlySeries} margin={{ left: -20, right: 8, top: 8 }}><defs><linearGradient id="incomeGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#2da66a" stopOpacity={0.3} /><stop offset="100%" stopColor="#2da66a" stopOpacity={0} /></linearGradient><linearGradient id="expenseGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#ef9d80" stopOpacity={0.2} /><stop offset="100%" stopColor="#ef9d80" stopOpacity={0} /></linearGradient></defs><CartesianGrid vertical={false} stroke="#eef5f0" strokeDasharray="3 3" /><XAxis dataKey="month" axisLine={false} tickLine={false} tick={{ fill: "#7a9687", fontSize: 11 }} /><YAxis axisLine={false} tickLine={false} tick={{ fill: "#7a9687", fontSize: 10 }} tickFormatter={(value: number) => `₱${Math.round(value / 1000)}k`} /><Tooltip contentStyle={chartTooltip} formatter={(value: number) => formatCurrency(value)} /><Area type="monotone" dataKey="income" name="Money in" stroke="#178b58" strokeWidth={2.5} fill="url(#incomeGradient)" /><Area type="monotone" dataKey="expense" name="Money out" stroke="#e59075" strokeWidth={2.5} fill="url(#expenseGradient)" /></AreaChart></ResponsiveContainer></div>
            ) : <div className="empty-chart"><Sparkles className="h-7 w-7" />Add a little activity to see your money rhythm.</div>}
          </article>

          <article className="panel activity-panel">
            <div className="panel-heading"><div><p className="section-kicker">KEEPING UP</p><h3>Recent activity</h3></div><Link href="/transactions" className="text-link">View all <ChevronRight className="h-4 w-4" /></Link></div>
            {data?.recentTransactions.length ? <div className="activity-list">{data.recentTransactions.slice(0, 4).map((transaction) => {
              const expense = transaction.type === "expense";
              const category = transaction.categories?.name || (expense ? "Expense" : "Income");
              return <div className="activity-item" key={transaction.id}><span className={`transaction-icon ${expense ? "expense" : "income"}`}>{expense ? <ArrowDownRight className="h-4 w-4" /> : <ArrowUpRight className="h-4 w-4" />}</span><div><strong>{transaction.description}</strong><p>{category} · {formatDate(transaction.date)}</p></div><strong className={expense ? "amount-expense" : "amount-income"}>{expense ? "−" : "+"}{formatCurrency(transaction.amount)}</strong></div>;
            })}</div> : <div className="empty-panel compact"><LayoutList className="h-7 w-7" /><p>Your latest shared money moments will live here.</p></div>}
          </article>
        </section>

        {topCategory && <div className="insight-strip"><span className="insight-icon"><Sparkles className="h-4 w-4" /></span><p><strong>Small insight:</strong> {topCategory.name} is your biggest expense so far at {formatCurrency(topCategory.amount)}. A quick check-in together can keep the month on track.</p></div>}
      </div>
    </AppShell>
  );
}
