import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { format, startOfMonth, endOfMonth, subMonths } from "date-fns";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const now = new Date();
  const today = format(now, "yyyy-MM-dd");
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");
  const seriesStart = format(startOfMonth(subMonths(now, 5)), "yyyy-MM-dd");

  const [accountsRes, transactionsRes, debtsRes, scheduledRes, seriesRes, loansRes, collectionsTodayRes] =
    await Promise.all([
      auth.supabase.from("accounts").select("*").eq("is_active", true),
      auth.supabase
        .from("transactions")
        .select("*, accounts(name, color), categories(name, color)")
        .gte("date", monthStart)
        .lte("date", monthEnd),
      auth.supabase.from("debts").select("*").eq("is_active", true),
      auth.supabase
        .from("scheduled_transactions")
        .select("*, accounts(name), categories(name)")
        .eq("is_active", true)
        .gte("next_occurrence", format(now, "yyyy-MM-dd"))
        .order("next_occurrence")
        .limit(5),
      auth.supabase
        .from("transactions")
        .select("amount, type, date")
        .gte("date", seriesStart)
        .lte("date", monthEnd),
      auth.supabase.from("loans").select("remaining_balance, savings_balance"),
      auth.supabase
        .from("loan_collections")
        .select("collected_amount")
        .eq("kind", "collection")
        .eq("collection_date", today),
    ]);

  const accounts = accountsRes.data || [];
  const transactions = transactionsRes.data || [];
  const debts = debtsRes.data || [];
  const upcoming = scheduledRes.data || [];
  const seriesTransactions = seriesRes.data || [];
  const loans = loansRes.data || [];
  const collectionsToday = collectionsTodayRes.data || [];

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const monthlyIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const monthlyExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalDebt = debts.reduce((s, d) => s + Number(d.balance), 0);
  const totalLoansOut = loans.reduce((s, l) => s + Number(l.remaining_balance), 0);
  const totalSavingsHeld = loans.reduce((s, l) => s + Number(l.savings_balance ?? 0), 0);
  const collectedToday = collectionsToday.reduce((s, c) => s + Number(c.collected_amount), 0);

  // Category spending: current month's expenses grouped by category.
  const categoryMap = new Map<string, { name: string; amount: number; color: string | null }>();
  for (const t of transactions) {
    if (t.type !== "expense") continue;
    const cat = t.categories as { name: string; color: string } | null;
    const key = cat?.name || "Uncategorized";
    const existing = categoryMap.get(key);
    if (existing) {
      existing.amount += Number(t.amount);
    } else {
      categoryMap.set(key, { name: key, amount: Number(t.amount), color: cat?.color || null });
    }
  }
  const categorySpending = Array.from(categoryMap.values()).sort((a, b) => b.amount - a.amount);

  // 6-month income vs expense series.
  const monthlySeries = Array.from({ length: 6 }, (_, idx) => {
    const monthDate = subMonths(now, 5 - idx);
    const mStart = format(startOfMonth(monthDate), "yyyy-MM-dd");
    const mEnd = format(endOfMonth(monthDate), "yyyy-MM-dd");
    let income = 0;
    let expense = 0;
    for (const t of seriesTransactions) {
      if (t.date < mStart || t.date > mEnd) continue;
      if (t.type === "income") income += Number(t.amount);
      else if (t.type === "expense") expense += Number(t.amount);
    }
    return { month: format(monthDate, "MMM"), income, expense };
  });

  const { data: recent } = await auth.supabase
    .from("transactions")
    .select("*, accounts(name, color), categories(name, color)")
    .order("date", { ascending: false })
    .limit(10);

  return jsonOk({
    totalBalance,
    monthlyIncome,
    monthlyExpenses,
    totalDebt,
    totalLoansOut,
    totalSavingsHeld,
    collectedToday,
    categorySpending,
    monthlySeries,
    recentTransactions: recent || [],
    upcomingPayments: upcoming,
    accounts,
  });
}
