import { endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { getManilaToday } from "@/lib/utils/finance";

export async function GET(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);
  const now = parseISO(getManilaToday());
  const period = new URL(request.url).searchParams.get("period") === "week" ? "week" : "month";
  const rangeStart = period === "week" ? startOfWeek(now, { weekStartsOn: 1 }) : startOfMonth(now);
  const rangeEnd = period === "week" ? endOfWeek(now, { weekStartsOn: 1 }) : endOfMonth(now);
  const periodStart = format(rangeStart, "yyyy-MM-dd");
  const periodEnd = format(rangeEnd, "yyyy-MM-dd");
  const [accountsRes, activityRes, recentRes] = await Promise.all([
    auth.supabase.from("accounts").select("*").eq("is_active", true),
    auth.supabase.from("transactions").select("*, accounts(name), categories(name, color)").gte("date", periodStart).lte("date", periodEnd),
    auth.supabase.from("transactions").select("*, accounts(name), categories(name, color)").order("date", { ascending: false }).order("created_at", { ascending: false }).limit(12),
  ]);
  if (accountsRes.error || activityRes.error || recentRes.error) return jsonError("Unable to load cash activity", 500);
  const isTransfer = (transaction: { notes?: string | null }) => transaction.notes?.startsWith("Internal transfer:") || false;
  const transactions = (activityRes.data || []).filter((transaction) => !isTransfer(transaction));
  const cashIn = transactions.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const cashOut = transactions.filter((transaction) => transaction.type === "expense").reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const categories = new Map<string, { name: string; amount: number; color: string | null }>();
  for (const transaction of transactions.filter((entry) => entry.type === "expense")) {
    const category = transaction.categories as { name: string; color: string } | null;
    const name = category?.name || "Cash out";
    const item = categories.get(name) || { name, amount: 0, color: category?.color || null };
    item.amount += Number(transaction.amount);
    categories.set(name, item);
  }
  const buckets = period === "week"
    ? Array.from({ length: 7 }, (_, index) => {
      const date = new Date(rangeStart);
      date.setDate(date.getDate() + index);
      const key = format(date, "yyyy-MM-dd");
      return { label: format(date, "EEE"), entries: transactions.filter((transaction) => transaction.date === key) };
    })
    : Array.from({ length: Math.ceil(rangeEnd.getDate() / 7) }, (_, index) => {
      const startDay = index * 7 + 1;
      const endDay = Math.min(startDay + 6, rangeEnd.getDate());
      return {
        label: `Week ${index + 1}`,
        entries: transactions.filter((transaction) => {
          const day = Number(transaction.date.slice(-2));
          return day >= startDay && day <= endDay;
        }),
      };
    });
  const cashSeries = buckets.map(({ label, entries }) => {
    return {
      label,
      income: entries.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + Number(transaction.amount), 0),
      expense: entries.filter((transaction) => transaction.type === "expense").reduce((sum, transaction) => sum + Number(transaction.amount), 0),
    };
  });
  const accounts = accountsRes.data || [];
  const cashOnHand = accounts.filter((account) => account.type === "cash").reduce((sum, account) => sum + Number(account.balance), 0);
  return jsonOk({ totalBalance: accounts.reduce((sum, account) => sum + Number(account.balance), 0), cashOnHand, cashIn, cashOut, period, periodLabel: period === "week" ? "This week" : "This month", categorySpending: Array.from(categories.values()).sort((a, b) => b.amount - a.amount), cashSeries, recentTransactions: (recentRes.data || []).filter((transaction) => !isTransfer(transaction)) });
}
