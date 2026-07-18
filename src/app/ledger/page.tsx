"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/app-shell";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatCurrency, formatDate } from "@/lib/utils/finance";
import type { JournalEntryWithLines, Book } from "@/types/database";

function entryTotal(e: JournalEntryWithLines): number {
  return e.journal_lines.reduce((s, l) => s + Number(l.debit || 0), 0);
}

function entryBook(e: JournalEntryWithLines): Book | "mixed" | "—" {
  const books = new Set(
    e.journal_lines.map((l) => l.ledger_accounts?.book).filter(Boolean) as Book[]
  );
  if (books.size === 0) return "—";
  if (books.size > 1) return "mixed";
  return Array.from(books)[0];
}

export default function JournalListPage() {
  const [entries, setEntries] = useState<JournalEntryWithLines[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");

  async function load() {
    setLoading(true);
    const params = new URLSearchParams();
    if (from) params.set("from", from);
    if (to) params.set("to", to);
    const res = await fetch(`/api/gl/journal-entries?${params.toString()}`);
    if (res.ok) setEntries(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [from, to]);

  async function remove(id: string) {
    const res = await fetch(`/api/gl/journal-entries/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Entry deleted");
      load();
    } else {
      toast.error("Delete failed");
    }
  }

  return (
    <AppShell>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">Journal</h1>
            <p className="text-sm text-muted-foreground">All posted double-entry journal entries.</p>
          </div>
          <Link href="/ledger/entries/new">
            <Button>New entry</Button>
          </Link>
        </div>

        <Card className="flex flex-wrap items-end gap-4 p-4">
          <div className="space-y-2">
            <Label>From</Label>
            <Input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>To</Label>
            <Input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
          </div>
          {(from || to) && (
            <Button
              variant="ghost"
              onClick={() => {
                setFrom("");
                setTo("");
              }}
            >
              Clear
            </Button>
          )}
        </Card>

        <Card>
          <div className="w-full overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Date</TableHead>
                <TableHead>Memo</TableHead>
                <TableHead>Book</TableHead>
                <TableHead className="text-right">Total</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {loading ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    Loading…
                  </TableCell>
                </TableRow>
              ) : entries.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-sm text-muted-foreground">
                    No entries yet.
                  </TableCell>
                </TableRow>
              ) : (
                entries.map((e) => (
                  <TableRow key={e.id}>
                    <TableCell>{formatDate(e.entry_date)}</TableCell>
                    <TableCell>
                      <Link href={`/ledger/entries/${e.id}`} className="hover:underline">
                        {e.memo || "—"}
                      </Link>
                    </TableCell>
                    <TableCell className="capitalize">{entryBook(e)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(entryTotal(e))}</TableCell>
                    <TableCell className="text-right">
                      <Button variant="ghost" size="sm" onClick={() => remove(e.id)}>
                        Delete
                      </Button>
                    </TableCell>
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
