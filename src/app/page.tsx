"use client";

import { useEffect, useState } from "react";

import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate  } from "@/lib/utils/finance";
import type { Transaction, ScheduledTransaction, Account } from "@/types/database";
import { AddSalaryDialog } from "@/components/add-salary-dialog";
import {
  Wallet, TrendingUp, TrendingDown, Calendar,
  Receipt, PieChart as PieChartIcon,
} from "lucide-react";
import {
  ResponsiveContainer, AreaChart, Area, BarChart, Bar, Cell, XAxis, YAxis,
  CartesianGrid, Tooltip, Legend,
} from "recharts";

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

const DEFAULT_ORDER = ["cash", "charts", "activity", "accounts"];

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

  useEffect(() => {
    loadDashboard();
    
    // Load drag-and-drop order
    const saved = localStorage.getItem("dashboard-order");
    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        // Reset if it's the old layout format
        if (!parsed.includes("cash")) {
          setSectionOrder(DEFAULT_ORDER);
          localStorage.removeItem("dashboard-order");
        } else {
          setSectionOrder(parsed);
        }
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

  const cashStats = [
    { label: "Cash on Hand", value: formatCurrency(data?.totalBalance || 0), icon: Wallet, color: "text-primary" },
    { label: "Cash In (Month)", value: formatCurrency(data?.monthlyIncome || 0), icon: TrendingUp, color: "text-green-600" },
    { label: "Cash Out (Month)", value: formatCurrency(data?.monthlyExpenses || 0), icon: TrendingDown, color: "text-red-600" },
  ];

  const categorySpending = data?.categorySpending || [];
  const monthlySeries = data?.monthlySeries || [];
  const hasCategoryData = categorySpending.length > 0;
  const hasSeriesData = monthlySeries.some((m) => m.income > 0 || m.expense > 0);

  const sectionsContent: Record<string, React.ReactNode> = {
    cash: (
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {cashStats.map((stat) => {
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
