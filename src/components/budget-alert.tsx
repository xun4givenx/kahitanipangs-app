"use client";

import { useEffect, useState } from "react";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatCurrency } from "@/lib/utils/finance";

type BudgetItem = { category: string; subcategory: string; limit: number; spent: number };
type BudgetData = { totalBudgeted: number; spent: number; categoryBudgets: BudgetItem[] };

export function BudgetAlert() {
  const [message, setMessage] = useState("");
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const checkBudget = () => {
      fetch("/api/budget")
        .then((response) => response.ok ? response.json() : null)
        .then((data: BudgetData | null) => {
          if (!data) return;
          const over = data.categoryBudgets.find((item) => item.limit > 0 && item.spent > item.limit);
          const totalOver = data.totalBudgeted > 0 && data.spent > data.totalBudgeted;
          if (!over && !totalOver) return setVisible(false);
          const nextMessage = over
            ? `${over.category}${over.subcategory ? ` · ${over.subcategory}` : ""} is ${formatCurrency(over.spent - over.limit)} over its budget.`
            : `Your planned budget is ${formatCurrency(data.spent - data.totalBudgeted)} over.`;
          setMessage(nextMessage);
          setVisible(true);
        })
        .catch(() => undefined);
    };
    checkBudget();
    window.addEventListener("cash-recorded", checkBudget);
    window.addEventListener("budget-updated", checkBudget);
    return () => {
      window.removeEventListener("cash-recorded", checkBudget);
      window.removeEventListener("budget-updated", checkBudget);
    };
  }, []);

  async function enablePhoneAlerts() {
    if (!("Notification" in window)) return;
    const permission = await Notification.requestPermission();
    if (permission === "granted") new Notification("KahitaNiPangs budget alert", { body: message, icon: "/icons/kp-wallet-192.png" });
  }

  if (!visible) return null;
  return <aside className="budget-alert" role="alert"><BellRing className="h-4 w-4" /><p><strong>Over budget.</strong> {message}</p>{"Notification" in window && Notification.permission === "default" && <Button variant="ghost" size="sm" onClick={enablePhoneAlerts}>Enable alerts</Button>}<button type="button" aria-label="Dismiss budget alert" onClick={() => setVisible(false)}><X className="h-4 w-4" /></button></aside>;
}
