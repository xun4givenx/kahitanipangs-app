import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { format, startOfMonth, endOfMonth } from "date-fns";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const now = new Date();
  const monthStart = format(startOfMonth(now), "yyyy-MM-dd");
  const monthEnd = format(endOfMonth(now), "yyyy-MM-dd");

  const [accountsRes, transactionsRes, debtsRes, scheduledRes] = await Promise.all([
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
  ]);

  const accounts = accountsRes.data || [];
  const transactions = transactionsRes.data || [];
  const debts = debtsRes.data || [];
  const upcoming = scheduledRes.data || [];

  const totalBalance = accounts.reduce((s, a) => s + Number(a.balance), 0);
  const monthlyIncome = transactions
    .filter((t) => t.type === "income")
    .reduce((s, t) => s + Number(t.amount), 0);
  const monthlyExpenses = transactions
    .filter((t) => t.type === "expense")
    .reduce((s, t) => s + Number(t.amount), 0);
  const totalDebt = debts.reduce((s, d) => s + Number(d.balance), 0);

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
    recentTransactions: recent || [],
    upcomingPayments: upcoming,
    accounts,
  });
}
