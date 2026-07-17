"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatCurrency } from "@/lib/utils/finance";
import { sumDebits, sumCredits, isBalanced, type JournalLineInput } from "@/lib/ledger-math";
import type { LedgerAccount, JournalEntryWithLines } from "@/types/database";

interface EditorLine {
  ledger_account_id: string;
  debit: string;
  credit: string;
  line_memo: string;
}

const emptyLine = (): EditorLine => ({ ledger_account_id: "", debit: "", credit: "", line_memo: "" });

function toInputLines(lines: EditorLine[]): JournalLineInput[] {
  return lines
    .filter((l) => l.ledger_account_id)
    .map((l) => ({
      ledger_account_id: l.ledger_account_id,
      debit: Number(l.debit || 0),
      credit: Number(l.credit || 0),
      line_memo: l.line_memo || null,
    }));
}

export function JournalEntryEditor({ entry }: { entry?: JournalEntryWithLines }) {
  const router = useRouter();
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [entryDate, setEntryDate] = useState(
    entry?.entry_date ?? new Date().toISOString().split("T")[0]
  );
  const [memo, setMemo] = useState(entry?.memo ?? "");
  const [reference, setReference] = useState(entry?.reference ?? "");
  const [lines, setLines] = useState<EditorLine[]>(
    entry
      ? entry.journal_lines.map((l) => ({
          ledger_account_id: l.ledger_account_id,
          debit: l.debit ? String(l.debit) : "",
          credit: l.credit ? String(l.credit) : "",
          line_memo: l.line_memo ?? "",
        }))
      : [emptyLine(), emptyLine()]
  );
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch("/api/gl/accounts");
      if (res.ok) setAccounts((await res.json()).filter((a: LedgerAccount) => a.is_active));
    })();
  }, []);

  const inputLines = useMemo(() => toInputLines(lines), [lines]);
  const totalDebit = sumDebits(inputLines);
  const totalCredit = sumCredits(inputLines);
  const balanced = inputLines.length >= 2 && isBalanced(inputLines);
  const diff = Math.round((totalDebit - totalCredit) * 100) / 100;

  function updateLine(i: number, patch: Partial<EditorLine>) {
    setLines((prev) => prev.map((l, idx) => (idx === i ? { ...l, ...patch } : l)));
  }
  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }
  function removeLine(i: number) {
    setLines((prev) => (prev.length <= 2 ? prev : prev.filter((_, idx) => idx !== i)));
  }

  async function save() {
    setSaving(true);
    const payload = {
      entry_date: entryDate,
      memo: memo || null,
      reference: reference || null,
      status: "posted",
      lines: inputLines,
    };
    const res = await fetch(
      entry ? `/api/gl/journal-entries/${entry.id}` : "/api/gl/journal-entries",
      {
        method: entry ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      }
    );
    setSaving(false);
    if (res.ok) {
      toast.success(entry ? "Entry updated" : "Entry posted");
      router.push("/ledger");
      router.refresh();
    } else {
      const err = await res.json();
      toast.error(err.error ?? "Save failed");
    }
  }

  return (
    <div className="space-y-6">
      <Card className="space-y-4 p-4">
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Date</Label>
            <Input type="date" value={entryDate} onChange={(e) => setEntryDate(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label>Memo</Label>
            <Input value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="What is this entry for?" />
          </div>
        </div>
        <div className="space-y-2">
          <Label>Reference (optional)</Label>
          <Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="Invoice #, receipt #…" />
        </div>
      </Card>

      <Card className="p-4">
        <div className="space-y-2">
          {lines.map((line, i) => (
            <div key={i} className="grid grid-cols-12 items-center gap-2">
              <div className="col-span-4">
                <Select
                  value={line.ledger_account_id}
                  onValueChange={(v) => updateLine(i, { ledger_account_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Account" />
                  </SelectTrigger>
                  <SelectContent>
                    {accounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.code} · {a.name} ({a.book})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Input
                className="col-span-2 text-right"
                type="number"
                placeholder="Debit"
                value={line.debit}
                onChange={(e) => updateLine(i, { debit: e.target.value, credit: "" })}
              />
              <Input
                className="col-span-2 text-right"
                type="number"
                placeholder="Credit"
                value={line.credit}
                onChange={(e) => updateLine(i, { credit: e.target.value, debit: "" })}
              />
              <Input
                className="col-span-3"
                placeholder="Line memo"
                value={line.line_memo}
                onChange={(e) => updateLine(i, { line_memo: e.target.value })}
              />
              <Button
                variant="ghost"
                size="icon"
                className="col-span-1"
                onClick={() => removeLine(i)}
                disabled={lines.length <= 2}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          ))}
        </div>

        <Button variant="outline" size="sm" className="mt-3 gap-2" onClick={addLine}>
          <Plus className="h-4 w-4" /> Add line
        </Button>

        <div className="mt-4 flex items-center justify-between border-t border-border/60 pt-4 text-sm">
          <div className="flex gap-6">
            <span>Debits: <strong>{formatCurrency(totalDebit)}</strong></span>
            <span>Credits: <strong>{formatCurrency(totalCredit)}</strong></span>
          </div>
          {balanced ? (
            <span className="font-medium text-emerald-600 dark:text-emerald-400">Balanced ✓</span>
          ) : (
            <span className="font-medium text-amber-600 dark:text-amber-400">
              Out by {formatCurrency(Math.abs(diff))}
            </span>
          )}
        </div>
      </Card>

      <div className="flex justify-end gap-2">
        <Button variant="ghost" onClick={() => router.push("/ledger")}>
          Cancel
        </Button>
        <Button onClick={save} disabled={!balanced || saving}>
          {saving ? "Saving…" : entry ? "Update entry" : "Post entry"}
        </Button>
      </div>
    </div>
  );
}
