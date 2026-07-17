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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { LedgerAccount, LedgerAccountType, Book } from "@/types/database";

const TYPES: LedgerAccountType[] = ["asset", "liability", "equity", "income", "expense"];
const BOOKS: Book[] = ["business", "personal"];

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    code: "",
    name: "",
    type: "asset" as LedgerAccountType,
    book: "business" as Book,
  });

  async function load() {
    setLoading(true);
    const res = await fetch("/api/gl/accounts");
    if (res.ok) setAccounts(await res.json());
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function seed() {
    const res = await fetch("/api/gl/seed", { method: "POST" });
    if (res.ok) {
      const data = await res.json();
      toast.success(data.inserted ? `Seeded ${data.inserted} accounts` : "Accounts already exist");
      load();
    } else {
      toast.error("Seed failed");
    }
  }

  async function create() {
    const res = await fetch("/api/gl/accounts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      toast.success("Account created");
      setOpen(false);
      setForm({ code: "", name: "", type: "asset", book: "business" });
      load();
    } else {
      const err = await res.json();
      toast.error(err.error ?? "Create failed");
    }
  }

  async function deactivate(id: string) {
    const res = await fetch(`/api/gl/accounts/${id}`, { method: "DELETE" });
    if (res.ok) {
      toast.success("Account deactivated");
      load();
    } else {
      toast.error("Failed");
    }
  }

  const grouped = TYPES.map((t) => ({
    type: t,
    items: accounts.filter((a) => a.type === t),
  }));

  return (
    <AppShell>
      <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Chart of Accounts</h1>
          <p className="text-sm text-muted-foreground">
            Double-entry ledger accounts, grouped by type and book.
          </p>
        </div>
        <div className="flex gap-2">
          {accounts.length === 0 && (
            <Button variant="outline" onClick={seed}>
              Seed default accounts
            </Button>
          )}
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>New account</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New ledger account</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Code</Label>
                  <Input
                    value={form.code}
                    onChange={(e) => setForm({ ...form, code: e.target.value })}
                    placeholder="1000"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="Cash on Hand"
                  />
                </div>
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm({ ...form, type: v as LedgerAccountType })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {TYPES.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Book</Label>
                  <Select
                    value={form.book}
                    onValueChange={(v) => setForm({ ...form, book: v as Book })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {BOOKS.map((b) => (
                        <SelectItem key={b} value={b}>
                          {b}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Button className="w-full" onClick={create} disabled={!form.code || !form.name}>
                  Create
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {loading ? (
        <p className="text-sm text-muted-foreground">Loading…</p>
      ) : accounts.length === 0 ? (
        <Card className="p-8 text-center text-sm text-muted-foreground">
          No ledger accounts yet. Click “Seed default accounts” to start.
        </Card>
      ) : (
        <div className="space-y-6">
          {grouped.map((g) =>
            g.items.length === 0 ? null : (
              <div key={g.type}>
                <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                  {g.type}
                </h2>
                <Card className="divide-y divide-border/60">
                  {g.items.map((a) => (
                    <div key={a.id} className="flex items-center justify-between px-4 py-3">
                      <Link href={`/ledger/accounts/${a.id}`} className="flex items-center gap-3 hover:underline">
                        <span className="w-14 font-mono text-xs text-muted-foreground">{a.code}</span>
                        <span className={a.is_active ? "" : "line-through opacity-50"}>{a.name}</span>
                        <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                          {a.book}
                        </span>
                      </Link>
                      {a.is_active && (
                        <Button variant="ghost" size="sm" onClick={() => deactivate(a.id)}>
                          Deactivate
                        </Button>
                      )}
                    </div>
                  ))}
                </Card>
              </div>
            )
          )}
        </div>
      )}
      </div>
    </AppShell>
  );
}
