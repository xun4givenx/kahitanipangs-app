"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils/finance";
import type { Transaction, ScheduledTransaction, Account } from "@/types/database";
import { AddSalaryDialog } from "@/components/add-salary-dialog";
import {
  Wallet, TrendingUp, TrendingDown, CreditCard, Calendar,
  HandCoins, Receipt, PieChart as PieChartIcon, ArrowRight,
  PiggyBank, CalendarCheck,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";
import { roundToTens } from "@/lib/utils/finance";

import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from '@dnd-kit/core';
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable';
import { SortableSection } from "@/components/dashboard/sortable-section";

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
  totalDebt: number;
  totalLoansOut: number;
  totalLoansFreshCapital: number;
  totalLoansReinvested: number;
  totalSavingsHeld: number;
  collectedToday: number;
  totalExpectedProfit: number;
  totalRealizedProfit: number;
  expectedDailyCollections: number;
  dailyCollectibles: { id: string; person_name: string; repayment_amount: number; isDelayed: boolean }[];
  delayedPayments: { id: string; person_name: string; daysDelayed: number; delayedAmount: number; repayment_amount: number }[];
  categorySpending: CategorySpending[];
  monthlySeries: MonthlyPoint[];
  recentTransactions: Transaction[];
  upcomingPayments: ScheduledTransaction[];
  accounts: Account[];
}

const CHART_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

const tooltipStyle = {
  background: "var(--popover)",
  border: "1px solid var(--border)",
  borderRadius: "var(--radius)",
  color: "var(--popover-foreground)",
  fontSize: 12,
};

const DEFAULT_ORDER = ["stats", "charts", "profits", "manage", "loans", "activity", "accounts"];

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [sectionOrder, setSectionOrder] = useState<string[]>([]);

  function loadDashboard() {
    return fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }

  async function handleQuickCollect(loanId: string, amount: number) {
    const roundedAmount = roundToTens(amount);
    if (!confirm(`Collect ${formatCurrency(roundedAmount)} today?`)) return;
    await fetch(`/api/loans/${loanId}/collections`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        kind: "collection",
        collected_amount: roundedAmount,
        collection_date: new Date().toISOString().split("T")[0],
      }),
    });
    loadDashboard();
  }

  useEffect(() => {
    loadDashboard();
    
    // Load drag-and-drop order
    const saved = localStorage.getItem("dashboard-order");
    if (saved) {
      try {
        setSectionOrder(JSON.parse(saved));
      } catch {
        setSectionOrder(DEFAULT_ORDER);
      }
    } else {
      setSectionOrder(DEFAULT_ORDER);
    }
  }, []);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      setSectionOrder((items) => {
        const oldIndex = items.indexOf(active.id as string);
        const newIndex = items.indexOf(over.id as string);
        
        const newOrder = arrayMove(items, oldIndex, newIndex);
        localStorage.setItem("dashboard-order", JSON.stringify(newOrder));
        return newOrder;
      });
    }
  }

  if (loading) {
    return (
      <AppShell>
        <div className="flex h-64 items-center justify-center text-muted-foreground">
          Loading dashboard...
        </div>
      </AppShell>
    );
  }

  const stats = [
    { label: "Total Balance", value: formatCurrency(data?.totalBalance || 0), icon: Wallet, color: "text-primary" },
    { label: "Monthly Income", value: formatCurrency(data?.monthlyIncome || 0), icon: TrendingUp, color: "text-green-600" },
    { label: "Monthly Expenses", value: formatCurrency(data?.monthlyExpenses || 0), icon: TrendingDown, color: "text-red-600" },
    { label: "Total Debt", value: formatCurrency(data?.totalDebt || 0), icon: CreditCard, color: "text-destructive" },
    { label: "Loans Out", value: formatCurrency(data?.totalLoansOut || 0), icon: HandCoins, color: "text-chart-3" },
  ];

  const categorySpending = data?.categorySpending || [];
  const monthlySeries = data?.monthlySeries || [];
  const hasCategoryData = categorySpending.length > 0;
  const hasSeriesData = monthlySeries.some((m) => m.income > 0 || m.expense > 0);

  const sectionsContent: Record<string, React.ReactNode> = {
    stats: (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.label} className="border-border/60 shadow-none hover:bg-secondary/20 transition-colors">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Icon className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{stat.label}</span>
                </div>
                <div className="text-3xl font-bold tracking-tight">{stat.value}</div>
                <div className={`text-xs mt-2 font-medium ${stat.color}`}>Updated just now</div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    ),
    charts: (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Income vs Expenses</CardTitle>
            <CardDescription>Last 6 months</CardDescription>
          </CardHeader>
          <CardContent>
            {hasSeriesData ? (
              <ResponsiveContainer width="100%" height={260}>
                <AreaChart data={monthlySeries} margin={{ left: 4, right: 12, top: 4 }}>
                  <defs>
                    <linearGradient id="incomeFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--chart-5)" stopOpacity={0.35} />
                      <stop offset="100%" stopColor="var(--chart-5)" stopOpacity={0.02} />
                    </linearGradient>
                    <linearGradient id="expenseFill" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="var(--destructive)" stopOpacity={0.3} />
                      <stop offset="100%" stopColor="var(--destructive)" stopOpacity={0.02} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
                  <XAxis
                    dataKey="month"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  />
                  <YAxis
                    tickLine={false}
                    axisLine={false}
                    width={56}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    tickFormatter={(v: number) => formatCurrency(v).replace(/\.00$/, "")}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Legend
                    formatter={(value) => (
                      <span className="text-xs text-muted-foreground">{value}</span>
                    )}
                  />
                  <Area
                    type="monotone"
                    dataKey="income"
                    name="Income"
                    stroke="var(--chart-5)"
                    fill="url(#incomeFill)"
                    strokeWidth={2}
                  />
                  <Area
                    type="monotone"
                    dataKey="expense"
                    name="Expenses"
                    stroke="var(--destructive)"
                    fill="url(#expenseFill)"
                    strokeWidth={2}
                  />
                </AreaChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <TrendingUp className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No income or expenses in the last 6 months yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Spending by Category</CardTitle>
            <CardDescription>This month&apos;s expenses</CardDescription>
          </CardHeader>
          <CardContent>
            {hasCategoryData ? (
              <ResponsiveContainer width="100%" height={260}>
                <BarChart
                  data={categorySpending}
                  layout="vertical"
                  margin={{ left: 4, right: 16, top: 4 }}
                >
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                  <XAxis
                    type="number"
                    tickLine={false}
                    axisLine={false}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 11 }}
                    tickFormatter={(v: number) => formatCurrency(v).replace(/\.00$/, "")}
                  />
                  <YAxis
                    type="category"
                    dataKey="name"
                    tickLine={false}
                    axisLine={false}
                    width={100}
                    tick={{ fill: "var(--muted-foreground)", fontSize: 12 }}
                  />
                  <Tooltip
                    contentStyle={tooltipStyle}
                    formatter={(value: number) => formatCurrency(value)}
                  />
                  <Bar dataKey="amount" radius={[0, 4, 4, 0]} maxBarSize={22}>
                    {categorySpending.map((entry, i) => (
                      <Cell
                        key={entry.name}
                        fill={entry.color || CHART_COLORS[i % CHART_COLORS.length]}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-16 text-center">
                <PieChartIcon className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No expenses logged this month yet.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    ),
    profits: (
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-card p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-chart-3/20">
            <TrendingUp className="h-6 w-6 text-chart-3" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Expected profit</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(data?.totalExpectedProfit || 0)}</p>
          </div>
        </div>
        <div className="flex items-center gap-4 rounded-xl border border-border/60 bg-card p-5">
          <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-chart-2/20">
            <PiggyBank className="h-6 w-6 text-chart-2" />
          </div>
          <div>
            <p className="text-xs uppercase tracking-wider font-semibold text-muted-foreground">Realized profit</p>
            <p className="text-2xl font-bold mt-1">{formatCurrency(data?.totalRealizedProfit || 0)}</p>
          </div>
        </div>
      </div>
    ),
    manage: (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-destructive/10">
                <CreditCard className="h-5 w-5 text-destructive" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Debt payoff</p>
                <p className="text-xl font-bold">{formatCurrency(data?.totalDebt || 0)}</p>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/debts">
                Manage <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center justify-between gap-4 p-6">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-chart-3/15">
                <HandCoins className="h-5 w-5 text-chart-3" />
              </div>
              <div className="flex-1">
                <p className="text-sm text-muted-foreground">Loans out</p>
                <p className="text-xl font-bold">{formatCurrency(data?.totalLoansOut || 0)}</p>
                <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                  <span className="flex justify-between"><span>Fresh Capital:</span> <span>{formatCurrency(data?.totalLoansFreshCapital || 0)}</span></span>
                  <span className="flex justify-between"><span>Reinvested:</span> <span>{formatCurrency(data?.totalLoansReinvested || 0)}</span></span>
                </div>
              </div>
            </div>
            <Button variant="ghost" size="sm" asChild>
              <Link href="/loans">
                Manage <ArrowRight className="ml-1 h-4 w-4" />
              </Link>
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-chart-2/15">
              <PiggyBank className="h-5 w-5 text-chart-2" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Savings held</p>
              <p className="text-xl font-bold">{formatCurrency(data?.totalSavingsHeld || 0)}</p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="flex items-center gap-3 p-6">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-chart-5/15">
              <CalendarCheck className="h-5 w-5 text-chart-5" />
            </div>
            <div className="flex-1">
              <p className="text-sm text-muted-foreground">Collected today</p>
              <p className="text-xl font-bold">{formatCurrency(data?.collectedToday || 0)}</p>
              <div className="mt-1 flex flex-col gap-0.5 text-xs text-muted-foreground">
                <span className="flex justify-between"><span>Expected Daily:</span> <span>{formatCurrency(data?.expectedDailyCollections || 0)}</span></span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    ),
    loans: (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            <CardTitle>Daily Collectibles</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.dailyCollectibles?.length ? (
              <div className="space-y-3">
                {data.dailyCollectibles.map((c) => (
                  <div key={c.id} className="flex items-center justify-between rounded-xl bg-muted/40 p-3">
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {c.person_name}
                        {c.isDelayed && <Badge variant="destructive" className="h-5 px-1.5 text-[10px]">Delayed</Badge>}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        Amount due: {formatCurrency(roundToTens(c.repayment_amount))}
                      </p>
                    </div>
                    <Button size="sm" onClick={() => handleQuickCollect(c.id, c.repayment_amount)}>
                      Collect
                    </Button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <HandCoins className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No expected collections for today!
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card className="border-destructive/20">
          <CardHeader className="flex flex-row items-center gap-2 pb-2">
            <TrendingDown className="h-5 w-5 text-destructive" />
            <CardTitle className="text-destructive">Delayed Payments</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.delayedPayments?.length ? (
              <div className="space-y-3">
                {data.delayedPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between rounded-xl bg-destructive/5 p-3 border border-destructive/10">
                    <div>
                      <p className="font-medium">{p.person_name}</p>
                      <p className="text-sm text-destructive font-medium">
                        Delayed: {p.daysDelayed} days
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-bold text-destructive">
                        {formatCurrency(p.delayedAmount)}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Installment: {formatCurrency(p.repayment_amount)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
                <TrendingUp className="h-10 w-10 text-green-500/40" />
                <p className="text-sm text-muted-foreground">
                  All borrowers are on schedule.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    ),
    activity: (
      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Recent Transactions</CardTitle>
          </CardHeader>
          <CardContent>
            {data?.recentTransactions?.length ? (
              <div className="w-full overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Date</TableHead>
                    <TableHead>Description</TableHead>
                    <TableHead className="text-right">Amount</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data.recentTransactions.map((t) => (
                    <TableRow key={t.id}>
                      <TableCell className="text-muted-foreground">
                        {formatDate(t.date)}
                      </TableCell>
                      <TableCell>{t.description}</TableCell>
                      <TableCell className={`text-right font-medium ${t.type === "income" ? "text-green-600" : "text-red-600"}`}>
                        {t.type === "income" ? "+" : "-"}
                        {formatCurrency(t.amount)}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Receipt className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  No transactions yet — add your first one to get started.
                </p>
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center gap-2">
            <Calendar className="h-5 w-5" />
            <CardTitle>Upcoming Payments</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            {data?.upcomingPayments?.length ? (
              <div className="divide-y divide-border/40">
                {data.upcomingPayments.map((p) => (
                  <div key={p.id} className="flex items-center justify-between p-4 hover:bg-muted/30 transition-colors">
                    <div>
                      <p className="font-medium text-[15px]">{p.description}</p>
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {formatDate(p.next_occurrence)} · {p.frequency}
                      </p>
                    </div>
                    <Badge variant={p.type === "income" ? "default" : "destructive"} className="rounded-md px-2 py-1">
                      {p.type === "income" ? "+" : "-"}
                      {formatCurrency(p.amount)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
                <Calendar className="h-10 w-10 text-muted-foreground/40" />
                <p className="text-sm text-muted-foreground">
                  Nothing scheduled — set up a recurring payment to plan ahead.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    ),
    accounts: (
      <Card>
        <CardHeader>
          <CardTitle>Account Balances</CardTitle>
        </CardHeader>
        <CardContent>
          {data?.accounts?.length ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {data.accounts.map((a) => (
                <div
                  key={a.id}
                  className="flex items-center justify-between rounded-xl border-l-4 bg-muted/40 p-4"
                  style={{ borderLeftColor: a.color }}
                >
                  <div>
                    <p className="font-medium">{a.name}</p>
                    <p className="text-sm capitalize text-muted-foreground">{a.type}</p>
                  </div>
                  <p className="text-lg font-bold">{formatCurrency(a.balance)}</p>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center gap-2 py-12 text-center">
              <Wallet className="h-10 w-10 text-muted-foreground/40" />
              <p className="text-sm text-muted-foreground">
                No accounts yet — add one to start tracking your balances.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    )
  };

  return (
    <AppShell>
      <div className="space-y-6 relative">
        <div className="flex justify-end relative z-50">
          <AddSalaryDialog onSuccess={loadDashboard} />
        </div>
        
        {sectionOrder.length > 0 ? (
          <DndContext 
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={handleDragEnd}
          >
            <SortableContext 
              items={sectionOrder}
              strategy={verticalListSortingStrategy}
            >
              {sectionOrder.map(id => (
                sectionsContent[id] ? (
                  <SortableSection key={id} id={id}>
                    {sectionsContent[id]}
                  </SortableSection>
                ) : null
              ))}
            </SortableContext>
          </DndContext>
        ) : (
          <div className="h-96 flex items-center justify-center text-muted-foreground animate-pulse">
            Loading layout...
          </div>
        )}
      </div>
    </AppShell>
  );
}
