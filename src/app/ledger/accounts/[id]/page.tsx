"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
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
import { formatCurrency, formatDate } from "@/lib/utils/finance";
import type { LedgerAccount } from "@/types/database";

interface RegisterRow {
  line_id: string;
  entry_id: string;
  entry_date: string;
  memo: string | null;
  debit: number;
  credit: number;
  running_balance: number;
}

export default function AccountRegisterPage() {
  const { id } = useParams<{ id: string }>();
  const [account, setAccount] = useState<LedgerAccount | null>(null);
  const [rows, setRows] = useState<RegisterRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/gl/accounts/${id}/register`);
      if (res.ok) {
        const data = await res.json();
        setAccount(data.account);
        setRows(data.rows);
      }
      setLoading(false);
    })();
  }, [id]);

  if (loading) return <AppShell><p className="text-sm text-muted-foreground">Loading…</p></AppShell>;
  if (!account) return <AppShell><p className="text-sm text-muted-foreground">Account not found.</p></AppShell>;

  return (
    <AppShell>
      <div className="space-y-6">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            <span className="font-mono text-base text-muted-foreground">{account.code}</span> {account.name}
          </h1>
          <p className="text-sm text-muted-foreground capitalize">
            {account.type} · {account.book} · {account.normal_balance}-normal
          </p>
        </div>

        <Card>
          <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Memo</TableHead>
                <TableHead className="text-right">Debit</TableHead>
                <TableHead className="text-right">Credit</TableHead>
                <TableHead className="text-right">Balance</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No posted lines yet.
                  </TableCell>
                </TableRow>
              ) : (
                rows.map((r) => (
                  <TableRow key={r.line_id}>
                    <TableCell>{formatDate(r.entry_date)}</TableCell>
                    <TableCell>{r.memo ?? "—"}</TableCell>
                    <TableCell className="text-right">{r.debit ? formatCurrency(r.debit) : "—"}</TableCell>
                    <TableCell className="text-right">{r.credit ? formatCurrency(r.credit) : "—"}</TableCell>
                    <TableCell className="text-right font-medium">{formatCurrency(r.running_balance)}</TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
          </div>
        </Card>
      </div>
    </AppShell>
  );
}
