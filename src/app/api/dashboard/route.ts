import { format, startOfMonth, endOfMonth, subMonths, parseISO } from "date-fns";
import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { getHouseholdMember } from "@/lib/household";
import { getManilaToday } from "@/lib/utils/finance";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);
  const member = await getHouseholdMember(auth.supabase, auth.user.id);
  if (!member) return jsonOk({ needsHousehold: true });

  const now = parseISO(getManilaToday());
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const seriesStart = format(startOfMonth(subMonths(now, 5)), "yyyy-MM-dd");
  const [accountsRes, transactionsRes, scheduledRes, seriesRes, recentRes] = await Promise.all([
    auth.supabase.from("accounts").select("*").eq("is_active", true),
    auth.supabase.from("transactions").select("*, accounts(name, color), categories(name, color)").gte("date", monthStart).lte("date", monthEnd),
    auth.supabase.from("scheduled_transactions").select("*, accounts(name), categories(name)").eq("is_active", true).gte("next_occurrence", format(now, "yyyy-MM-dd")).order("next_occurrence").limit(5),
    auth.supabase.from("transactions").select("amount, type, date").gte("date", seriesStart).lte("date", monthEnd),
    auth.supabase.from("transactions").select("*, accounts(name, color), categories(name, color)").order("date", { ascending: false }).order("created_at", { ascending: false }).limit(10),
  ]);

  const accounts = accountsRes.data || [];
  const transactions = transactionsRes.data || [];
  const monthlyIncome = transactions.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const monthlyExpenses = transactions.filter((transaction) => transaction.type === "expense").reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const categoryMap = new Map<string, { name: string; amount: number; color: string | null }>();
  const contributionMap = new Map<string, { name: string; income: number; expense: number }>();

  for (const transaction of transactions) {
    const contributor = transaction.contributor_name || "Household";
    const contribution = contributionMap.get(contributor) || { name: contributor, income: 0, expense: 0 };
    if (transaction.type === "income") contribution.income += Number(transaction.amount);
    if (transaction.type === "expense") contribution.expense += Number(transaction.amount);
    contributionMap.set(contributor, contribution);
    if (transaction.type !== "expense") continue;
    const category = transaction.categories as { name: string; color: string } | null;
    const key = category?.name || "Uncategorised";
    const existing = categoryMap.get(key);
    if (existing) existing.amount += Number(transaction.amount);
    else categoryMap.set(key, { name: key, amount: Number(transaction.amount), color: category?.color || null });
  }

  const monthlySeries = Array.from({ length: 6 }, (_, index) => {
    const monthDate = subMonths(now, 5 - index);
    const start = format(startOfMonth(monthDate), "yyyy-MM-dd");
    const end = format(endOfMonth(monthDate), "yyyy-MM-dd");
    const monthTransactions = (seriesRes.data || []).filter((transaction) => transaction.date >= start && transaction.date <= end);
    return {
      month: format(monthDate, "MMM"),
      income: monthTransactions.filter((transaction) => transaction.type === "income").reduce((sum, transaction) => sum + Number(transaction.amount), 0),
      expense: monthTransactions.filter((transaction) => transaction.type === "expense").reduce((sum, transaction) => sum + Number(transaction.amount), 0),
    };
  });

  return jsonOk({
    needsHousehold: false,
    totalBalance: accounts.reduce((sum, account) => sum + Number(account.balance), 0),
    monthlyIncome,
    monthlyExpenses,
    categorySpending: Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount),
    contributionBreakdown: Array.from(contributionMap.values()).sort((a, b) => b.income - a.income),
    monthlySeries,
    recentTransactions: recentRes.data || [],
    upcomingPayments: scheduledRes.data || [],
    accounts,
  });
}
