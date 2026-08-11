"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
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

const CASH_WALLET = { name: "Cash wallet", type: "cash", balance: 0, currency: "PHP", color: "#6d5de2" };
const TRANSFER_PREFIX = "Internal transfer:";

export function CashWithdrawalDialog({ onSuccess }: { onSuccess?: () => void }) {
  const [open, setOpen] = useState(false);
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [sourceAccountId, setSourceAccountId] = useState("");
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(getManilaToday());
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    const supabase = createClient();
    void supabase.from("accounts").select("*").eq("is_active", true).order("name").then(({ data, error }) => {
      if (error) return toast.error(error.message);
      setAccounts(((data || []) as Account[]).filter((account) => account.type !== "cash"));
    });
  }, [open]);

  async function submit(event: React.FormEvent) {
    event.preventDefault();
    const numericAmount = Number(amount);
    if (!sourceAccountId || !Number.isFinite(numericAmount) || numericAmount <= 0) {
      return toast.error("Choose an account and enter a positive amount");
    }

    setSaving(true);
    try {
      const supabase = createClient();
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      if (authError || !user) throw new Error("Your session has expired. Please sign in again.");

      const sourceAccount = accounts.find((account) => account.id === sourceAccountId);
      if (!sourceAccount) throw new Error("Choose the account you withdrew cash from");

      const { data: existingWallet, error: walletError } = await supabase
        .from("accounts")
        .select("id")
        .eq("name", CASH_WALLET.name)
        .eq("type", "cash")
        .maybeSingle();
      if (walletError) throw walletError;

      let cashWalletId = existingWallet?.id;
      if (!cashWalletId) {
        const { data: wallet, error } = await supabase
          .from("accounts")
          .insert({ user_id: user.id, ...CASH_WALLET })
          .select("id")
          .single();
        if (error) throw error;
        cashWalletId = wallet.id;
      }

      const transferNote = `${TRANSFER_PREFIX}${crypto.randomUUID()}`;
      const { data: withdrawal, error: withdrawalError } = await supabase
        .from("transactions")
        .insert({ user_id: user.id, account_id: sourceAccountId, amount: numericAmount, type: "expense", description: "Cash withdrawal to Cash wallet", notes: transferNote, date })
        .select("id")
        .single();
      if (withdrawalError) throw withdrawalError;

      const { error: depositError } = await supabase
        .from("transactions")
        .insert({ user_id: user.id, account_id: cashWalletId, amount: numericAmount, type: "income", description: `Cash withdrawal from ${sourceAccount.name}`, notes: transferNote, date });
      if (depositError) {
        await supabase.from("transactions").delete().eq("id", withdrawal.id);
        throw depositError;
      }

      toast.success("Cash moved to your Cash wallet");
      setOpen(false);
      setSourceAccountId("");
      setAmount("");
      onSuccess?.();
    } catch (error) {
      const message = typeof error === "object" && error !== null && "message" in error && typeof error.message === "string" ? error.message : "Could not move cash";
      toast.error(message);
    } finally {
      setSaving(false);
    }
  }

  return <Dialog open={open} onOpenChange={setOpen}><DialogTrigger asChild><Button variant="outline" className="quick-expense"><ArrowRightLeft className="h-4 w-4" />Withdraw cash</Button></DialogTrigger><DialogContent><DialogHeader><DialogTitle>Withdraw cash</DialogTitle></DialogHeader><form className="space-y-4" onSubmit={submit}><p className="text-sm text-muted-foreground">Move money from an account into Cash wallet. This is not counted as spending.</p><div className="space-y-2"><Label>Withdraw from</Label><Select value={sourceAccountId} onValueChange={setSourceAccountId}><SelectTrigger><SelectValue placeholder="Choose an account" /></SelectTrigger><SelectContent>{accounts.map((account) => <SelectItem key={account.id} value={account.id}>{account.name}</SelectItem>)}</SelectContent></Select>{accounts.length === 0 && <p className="text-xs text-muted-foreground">Add your bank or e-wallet account first in <Link className="text-primary underline" href="/accounts">Accounts</Link>.</p>}</div><div className="space-y-2"><Label>Amount</Label><Input type="number" min="0.01" step="0.01" inputMode="decimal" value={amount} onChange={(event) => setAmount(event.target.value)} placeholder="₱0.00" required /></div><div className="space-y-2"><Label>Date</Label><Input type="date" value={date} onChange={(event) => setDate(event.target.value)} required /></div><Button type="submit" className="w-full" disabled={saving || accounts.length === 0}>{saving ? "Moving cash…" : "Move to Cash wallet"}</Button></form></DialogContent></Dialog>;
}
