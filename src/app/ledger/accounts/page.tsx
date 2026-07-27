"use client";

import { useEffect, useState } from "react";
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
} from "@/components/ui/dialog";
import type { LedgerAccount, LedgerAccountType, Book } from "@/types/database";

const TYPES: LedgerAccountType[] = ["asset", "liability", "equity", "income", "expense"];
const BOOKS: Book[] = ["business", "personal"];

export default function ChartOfAccountsPage() {
  const [accounts, setAccounts] = useState<LedgerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [open, setOpen] = useState(false);
  const [isEdit, setIsEdit] = useState(false);
  const [editId, setEditId] = useState<string | null>(null);

  const defaultForm = {
    code: "",
    name: "",
    type: "asset" as LedgerAccountType,
    book: "business" as Book,
    parent_id: "none",
    description: "",
  };
  const [form, setForm] = useState(defaultForm);

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

  function openNew() {
    setIsEdit(false);
    setEditId(null);
    setForm(defaultForm);
    setOpen(true);
  }

  function openEdit(account: LedgerAccount) {
    setIsEdit(true);
    setEditId(account.id);
    setForm({
      code: account.code,
      name: account.name,
      type: account.type,
      book: account.book,
      parent_id: account.parent_id ?? "none",
      description: account.description ?? "",
    });
    setOpen(true);
  }

  async function save() {
    const body = {
      ...form,
      parent_id: form.parent_id === "none" ? null : form.parent_id,
    };

    const res = await fetch(isEdit ? `/api/gl/accounts/${editId}` : "/api/gl/accounts", {
      method: isEdit ? "PATCH" : "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (res.ok) {
      toast.success(isEdit ? "Account updated" : "Account created");
      setOpen(false);
      load();
    } else {
      const err = await res.json();
      toast.error(err.error ?? "Save failed");
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

  // Filter possible parents (must be same book, same type, and not itself if editing)
  const possibleParents = accounts.filter(
    (a) => a.book === form.book && a.type === form.type && a.id !== editId
  );

  // Helper to render a tree of accounts
  function AccountTree({ parentId, level = 0, typeGroup }: { parentId: string | null; level?: number; typeGroup: LedgerAccount[] }) {
    const children = typeGroup.filter(a => a.parent_id === parentId);
    if (children.length === 0) return null;

    return (
      <div className="w-full flex flex-col">
        {children.map((a) => (
          <div key={a.id} className="flex flex-col">
            <div className="flex items-center justify-between px-4 py-2 border-b border-border/40 hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-3" style={{ paddingLeft: `${level * 1.5}rem` }}>
                <span className="w-12 font-mono text-xs text-muted-foreground">{a.code}</span>
                <button
                  onClick={() => openEdit(a)}
                  className={`text-sm text-left hover:underline ${a.is_active ? "" : "line-through opacity-50"}`}
                >
                  {a.name}
                </button>
                <span className="rounded bg-muted px-1.5 py-0.5 text-[10px] uppercase text-muted-foreground">
                  {a.book}
                </span>
              </div>
              {a.is_active && (
                <Button variant="ghost" size="sm" onClick={() => deactivate(a.id)}>
                  Deactivate
                </Button>
              )}
            </div>
            {/* Render children recursively */}
            <AccountTree parentId={a.id} level={level + 1} typeGroup={typeGroup} />
          </div>
        ))}
      </div>
    );
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
              Hierarchical ledger accounts, grouped by type and book.
            </p>
          </div>
          <div className="flex gap-2">
            {accounts.length === 0 && (
              <Button variant="outline" onClick={seed}>
                Seed default accounts
              </Button>
            )}
            <Button onClick={openNew}>New account</Button>
          </div>
        </div>

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogContent className="max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{isEdit ? "Edit ledger account" : "New ledger account"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
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
              </div>
              <div className="space-y-2">
                <Label>Description</Label>
                <Input
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Optional description"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Type</Label>
                  <Select
                    value={form.type}
                    onValueChange={(v) => setForm({ ...form, type: v as LedgerAccountType, parent_id: "none" })}
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
                    onValueChange={(v) => setForm({ ...form, book: v as Book, parent_id: "none" })}
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
              </div>
              <div className="space-y-2">
                <Label>Parent Account (Optional)</Label>
                <Select
                  value={form.parent_id}
                  onValueChange={(v) => setForm({ ...form, parent_id: v })}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="No parent (Root Level)" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">-- No Parent (Root Level) --</SelectItem>
                    {possibleParents.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.code} - {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <Button className="w-full" onClick={save} disabled={!form.code || !form.name}>
                {isEdit ? "Update" : "Create"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

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
                  <Card className="flex flex-col">
                    <AccountTree parentId={null} typeGroup={g.items} />
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
