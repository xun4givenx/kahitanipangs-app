import { format, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { getManilaToday } from "@/lib/utils/finance";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);
  const now = parseISO(getManilaToday());
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const seriesStart = format(startOfMonth(subMonths(now, 5)), "yyyy-MM-dd");
  const [accountsRes, monthRes, seriesRes, recentRes] = await Promise.all([
    auth.supabase.from("accounts").select("*").eq("is_active", true),
    auth.supabase.from("transactions").select("*, accounts(name), categories(name, color)").gte("date", monthStart).lte("date", monthEnd),
    auth.supabase.from("transactions").select("amount, type, date, notes").gte("date", seriesStart).lte("date", monthEnd),
    auth.supabase.from("transactions").select("*, accounts(name), categories(name, color)").order("date", { ascending: false }).order("created_at", { ascending: false }).limit(12),
  ]);
  if (accountsRes.error || monthRes.error || seriesRes.error || recentRes.error) return jsonError("Unable to load cash activity", 500);
  const isTransfer = (transaction: { notes?: string | null }) => transaction.notes?.startsWith("Internal transfer:") || false;
  const transactions = (monthRes.data || []).filter((transaction) => !isTransfer(transaction));
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
  const monthlySeries = Array.from({ length: 6 }, (_, index) => {
    const date = subMonths(now, 5 - index);
    const start = format(startOfMonth(date), "yyyy-MM-dd");
    const end = format(endOfMonth(date), "yyyy-MM-dd");
    const month = (seriesRes.data || []).filter((transaction) => transaction.date >= start && transaction.date <= end && !isTransfer(transaction));
    return { month: format(date, "MMM"), income: month.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + Number(transaction.amount), 0), expense: month.filter((transaction) => transaction.type === "expense").reduce((sum, transaction) => sum + Number(transaction.amount), 0) };
  });
  return jsonOk({ totalBalance: (accountsRes.data || []).reduce((sum, account) => sum + Number(account.balance), 0), cashIn, cashOut, categorySpending: Array.from(categories.values()).sort((a, b) => b.amount - a.amount), monthlySeries, recentTransactions: (recentRes.data || []).filter((transaction) => !isTransfer(transaction)) });
}
