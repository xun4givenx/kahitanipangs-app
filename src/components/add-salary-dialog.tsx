"use client";

import { useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { Account } from "@/types/database";
import { Banknote } from "lucide-react";

interface AddSalaryDialogProps {
  onSuccess?: () => void;
}

const initialForm = {
  account_id: "",
  amount: "",
  date: new Date().toISOString().split("T")[0],
  note: "",
};

export function AddSalaryDialog({ onSuccess }: AddSalaryDialogProps) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [form, setForm] = useState(initialForm);
  const [saving, setSaving] = useState(false);

  function resetForm() {
    setForm(initialForm);
  }

  function handleOpenChange(next: boolean) {
    setOpen(next);
    if (next) {
      fetch("/api/accounts")
        .then((r) => r.json())
        .then((data) => setAccounts(Array.isArray(data) ? data : []))
        .catch(() => toast.error("Failed to load accounts"));
    } else {
      resetForm();
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.account_id) {
      toast.error("Select an account");
      return;
    }
    if (!form.amount || Number(form.amount) <= 0) {
      toast.error("Enter a valid amount");
      return;
    }

    setSaving(true);
    const res = await fetch("/api/transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        account_id: form.account_id,
        category_id: null,
        amount: parseFloat(form.amount),
        type: "income",
        description: form.note || "Salary",
        notes: "",
        date: form.date,
      }),
    });
    setSaving(false);

    if (!res.ok) {
      toast.error("Failed to add salary");
      return;
    }
    toast.success("Salary added");
    setOpen(false);
    resetForm();
    onSuccess?.();
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button>
          <Banknote className="mr-2 h-4 w-4" />
          Add Salary
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Add Salary</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>Amount</Label>
            <Input
              type="number"
              step="0.01"
              value={form.amount}
              onChange={(e) => setForm({ ...form, amount: e.target.value })}
              placeholder="0.00"
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Account</Label>
            <Select value={form.account_id} onValueChange={(v) => setForm({ ...form, account_id: v })}>
              <SelectTrigger className="w-full"><SelectValue placeholder="Select account" /></SelectTrigger>
              <SelectContent>
                {accounts.map((a) => (
                  <SelectItem key={a.id} value={a.id}>{a.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Date</Label>
            <Input
              type="date"
              value={form.date}
              onChange={(e) => setForm({ ...form, date: e.target.value })}
              required
            />
          </div>
          <div className="space-y-2">
            <Label>Note (optional)</Label>
            <Input
              value={form.note}
              onChange={(e) => setForm({ ...form, note: e.target.value })}
              placeholder="Salary"
            />
          </div>
          <Button type="submit" className="w-full" disabled={saving}>
            {saving ? "Saving..." : "Add Salary"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}
