"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils/finance";
import type { Transaction, ScheduledTransaction, Account } from "@/types/database";
import {
  Wallet, TrendingUp, TrendingDown, CreditCard, Calendar,
} from "lucide-react";

interface DashboardData {
  totalBalance: number;
  monthlyIncome: number;
  monthlyExpenses: number;
  totalDebt: number;
  recentTransactions: Transaction[];
  upcomingPayments: ScheduledTransaction[];
  accounts: Account[];
}

export default function DashboardPage() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/dashboard")
      .then((r) => r.json())
      .then(setData)
      .finally(() => setLoading(false));
  }, []);

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
    { label: "Total Balance", value: formatCurrency(data?.totalBalance || 0), icon: Wallet, color: "text-blue-600" },
    { label: "Monthly Income", value: formatCurrency(data?.monthlyIncome || 0), icon: TrendingUp, color: "text-green-600" },
    { label: "Monthly Expenses", value: formatCurrency(data?.monthlyExpenses || 0), icon: TrendingDown, color: "text-red-600" },
    { label: "Total Debt", value: formatCurrency(data?.totalDebt || 0), icon: CreditCard, color: "text-orange-600" },
  ];

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
          <p className="text-muted-foreground">Overview of your financial health</p>
        </div>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {stats.map((stat) => {
            const Icon = stat.icon;
            return (
              <Card key={stat.label}>
                <CardHeader className="flex flex-row items-center justify-between pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {stat.label}
                  </CardTitle>
                  <Icon className={`h-4 w-4 ${stat.color}`} />
                </CardHeader>
                <CardContent>
                  <div className="text-2xl font-bold">{stat.value}</div>
                </CardContent>
              </Card>
            );
          })}
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle>Recent Transactions</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.recentTransactions?.length ? (
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
              ) : (
                <p className="text-sm text-muted-foreground">No transactions yet</p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center gap-2">
              <Calendar className="h-5 w-5" />
              <CardTitle>Upcoming Payments</CardTitle>
            </CardHeader>
            <CardContent>
              {data?.upcomingPayments?.length ? (
                <div className="space-y-3">
                  {data.upcomingPayments.map((p) => (
                    <div key={p.id} className="flex items-center justify-between rounded-lg border p-3">
                      <div>
                        <p className="font-medium">{p.description}</p>
                        <p className="text-sm text-muted-foreground">
                          {formatDate(p.next_occurrence)} · {p.frequency}
                        </p>
                      </div>
                      <Badge variant={p.type === "income" ? "default" : "destructive"}>
                        {p.type === "income" ? "+" : "-"}
                        {formatCurrency(p.amount)}
                      </Badge>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-muted-foreground">No upcoming payments</p>
              )}
            </CardContent>
          </Card>
        </div>

        {data?.accounts?.length ? (
          <Card>
            <CardHeader>
              <CardTitle>Account Balances</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {data.accounts.map((a) => (
                  <div
                    key={a.id}
                    className="flex items-center justify-between rounded-lg border p-4"
                    style={{ borderLeftColor: a.color, borderLeftWidth: 4 }}
                  >
                    <div>
                      <p className="font-medium">{a.name}</p>
                      <p className="text-sm capitalize text-muted-foreground">{a.type}</p>
                    </div>
                    <p className="text-lg font-bold">{formatCurrency(a.balance)}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        ) : null}
      </div>
    </AppShell>
  );
}
