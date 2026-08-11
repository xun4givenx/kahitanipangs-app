"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { createClient } from "@/lib/supabase/client";
import { getManilaToday } from "@/lib/utils/finance";
import type { Account } from "@/types/database";

const TRANSFER_PREFIX = "Internal transfer:";

export function CashWithdrawalDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [destinationAccountId, setDestinationAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(getManilaToday());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    void supabase.from("accounts").select("*").eq("is_active", true).order("name").then(({ data, error }) => {
      if (error) return toast.error(error.message);
      setAccounts(((data || []) as Account[]).filter((account) => account.type !== "credit"));
    });
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!sourceAccountId || !destinationAccountId || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return toast.error("Choose both accounts and enter a positive amount");
    }
    if (sourceAccountId === destinationAccountId) return toast.error("Choose two different accounts");

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Your session has expired. Please sign in again.");

      const sourceAccount = accounts.find((account) => account.id === sourceAccountId);
      const destinationAccount = accounts.find((account) => account.id === destinationAccountId);
      if (!sourceAccount || !destinationAccount) throw new Error("Choose the accounts for this transfer");

      const transferNote = `${TRANSFER_PREFIX}${crypto.randomUUID()}`;
      const { data: withdrawal, error: withdrawalError } = await supabase
        .from("transactions")
        .insert({ user_id: user.id, account_id: sourceAccountId, amount: numericAmount, type: "expense", description: `Transfer to ${destinationAccount.name}`, notes: transferNote, date })
        .select("id")
        .single();
      if (withdrawalError) throw withdrawalError;

      const { error: depositError } = await supabase
        .from("transactions")
        .insert({ user_id: user.id, account_id: destinationAccountId, amount: numericAmount, type: "income", description: `Transfer from ${sourceAccount.name}`, notes: transferNote, date });
      if (depositError) {
        await supabase.from("transactions").delete().eq("id", withdrawal.id);
        throw depositError;
      }

      toast.success("Funds transferred");
      setOpen(false);
      setSourceAccountId("");
      setDestinationAccountId("");
      setAmount("");
      onSuccess?.();
    } catch (error) {
      const message = typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" ? error.message : "Could not move cash";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" className="quick-expense"><ArrowRightLeft className="h-4 w-4" />Transfer funds</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Transfer funds</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={submit}><p className="text-sm text-muted-foreground">Move money between your cash accounts. Transfers do not affect income, expenses, or net cash flow.</p><div className="space-y-2"><Label>Transfer from</Label><Select value={sourceAccountId} onValueChange={setSourceAccountId}><SelectTrigger><SelectValue placeholder="Choose a source account" /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select></div><div className="space-y-2"><Label>Transfer to</Label><Select value={destinationAccountId} onValueChange={setDestinationAccountId}><SelectTrigger><SelectValue placeholder="Choose a destination account" /></SelectTrigger><SelectContent>{accounts.filter((account) => account.id !== sourceAccountId).map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select></div>{accounts.length < 2 && <p className="text-xs text-muted-foreground">Add at least two cash accounts before transferring funds.</p>}<div className="space-y-2"><Label>Amount</Label><Input type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="₱0.00" required /></div><div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></div><Button type="submit" className="w-full" disabled={saving || accounts.length < 2}>{saving ? "Transferring…" : "Transfer funds"}</Button></form></DialogContent></Dialog>;
}
