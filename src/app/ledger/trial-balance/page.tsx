"use client";

import { useEffect, useState } from "react";
import { AppShell } from "@/components/layout/app-shell";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils/finance";

interface TrialBalanceRow {
  account_id: string;
  code: string;
  name: string;
  type: string;
  book: string;
  debit_total: number;
  credit_total: number;
  balance: number;
}
interface TrialBalance {
  rows: TrialBalanceRow[];
  total_debits: number;
  total_credits: number;
  balanced: boolean;
}

export default function TrialBalancePage() {
  const [book, setBook] = useState<"all" | "business" | "personal">("all");
  const [tb, setTb] = useState<TrialBalance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      const params = new URLSearchParams();
      if (book !== "all") params.set("book", book);
      const res = await fetch(`/api/gl/trial-balance?${params.toString()}`);
      if (res.ok) setTb(await res.json());
      setLoading(false);
    })();
  }, [book]);

  const rows = (tb?.rows ?? []).filter((r) => r.debit_total > 0 || r.credit_total > 0);

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Trial Balance</h1>
            <p className="text-sm text-muted-foreground">
              Every account’s debit and credit totals. The columns must be equal.
            </p>
          </div>
          <Select value={book} onValueChange={(v) => setBook(v as typeof book)}>
            <SelectTrigger className="w-40">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All books</SelectItem>
              <SelectItem value="business">Business</SelectItem>
              <SelectItem value="personal">Personal</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {tb && (
          <Card
            className={`p-4 text-sm font-medium ${
              tb.balanced
                ? "text-emerald-600 dark:text-emerald-400"
                : "text-amber-600 dark:text-amber-400"
            }`}
          >
            {tb.balanced
              ? "Balanced ✓ — debits equal credits."
              : `Out of balance by ${formatCurrency(Math.abs(tb.total_debits - tb.total_credits))}`}
          </Card>
        )}

        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Code</TableHead>
                <TableHead>Account</TableHead>
                <TableHead>Book</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No posted activity yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.account_id}>
                    <TableCell className="font-mono text-xs text-muted-foreground">{r.code}</TableCell>
                    <TableCell>{r.name}</TableCell>
                    <TableCell className="capitalize">{r.book}</TableCell>
                    <TableCell className="text-right">
                      {r.debit_total ? formatCurrency(r.debit_total) : "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      {r.credit_total ? formatCurrency(r.credit_total) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              )}
              {tb && rows.length > 0 && (
                <TableRow className="border-t-2 font-semibold">
                  <TableCell colSpan={3}>Total</TableCell>
                  <TableCell className="text-right">{formatCurrency(tb.total_debits)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(tb.total_credits)}</TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </Card>
      </div>
    </AppShell>
  );
}
