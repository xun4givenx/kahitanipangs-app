import { endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { getManilaToday } from "@/lib/utils/finance";

type BudgetPeriod = "weekly" | "monthly";
type BudgetSettings = { monthlyLimit: number; categoryLimits: Record<string, number>; period: BudgetPeriod };

function readBudget(metadata: unknown): BudgetSettings {
  const source = (metadata as { cash_budget?: Partial<BudgetSettings> } | undefined)?.cash_budget;
  return { monthlyLimit: Number(source?.monthlyLimit) || 0, categoryLimits: source?.categoryLimits || {}, period: source?.period === "monthly" ? "monthly" : "weekly" };
}

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);
  const now = parseISO(getManilaToday());
  const budget = readBudget(auth.user.user_metadata);
  const periodStart = budget.period === "weekly" ? startOfWeek(now, { weekStartsOn: 1 }) : startOfMonth(now);
  const periodEnd = budget.period === "weekly" ? endOfWeek(now, { weekStartsOn: 1 }) : endOfMonth(now);
  const [{ data: transactions, error }, { data: savedCategories, error: savedCategoriesError }] = await Promise.all([
    auth.supabase.from("transactions").select("amount, type, categories(name, color)").eq("type", "expense").gte("date", format(periodStart, "yyyy-MM-dd")).lte("date", format(periodEnd, "yyyy-MM-dd")),
    auth.supabase.from("categories").select("name, color").eq("type", "expense").order("name"),
  ]);
  if (error || savedCategoriesError) return jsonError(error?.message || savedCategoriesError?.message || "Unable to load budget categories", 500);
  const categoryMap = new Map<string, { name: string; spent: number; color: string | null }>();
  for (const [name] of Object.entries(budget.categoryLimits)) categoryMap.set(name, { name, spent: 0, color: null });
  for (const category of savedCategories || []) categoryMap.set(category.name, { name: category.name, spent: categoryMap.get(category.name)?.spent || 0, color: category.color });
  for (const transaction of transactions || []) {
    const rawCategory = transaction.categories as { name: string; color: string } | { name: string; color: string }[] | null;
    const category = Array.isArray(rawCategory) ? rawCategory[0] : rawCategory;
    const name = category?.name || "Cash out";
    const current = categoryMap.get(name) || { name, spent: 0, color: category?.color || null };
    current.spent += Number(transaction.amount);
    categoryMap.set(name, current);
  }
  const spent = Array.from(categoryMap.values()).reduce((sum, category) => sum + category.spent, 0);
  return jsonOk({
    monthlyLimit: budget.monthlyLimit,
    period: budget.period,
    spent,
    remaining: budget.monthlyLimit - spent,
    categoryLimits: budget.categoryLimits,
    categories: Array.from(categoryMap.values()).sort((a, b) => b.spent - a.spent),
  });
}

export async function PUT(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);
  const { monthlyLimit, categoryLimits, period } = await request.json();
  const budget: BudgetSettings = { monthlyLimit: Math.max(0, Number(monthlyLimit) || 0), categoryLimits: Object.fromEntries(Object.entries(categoryLimits || {}).map(([name, limit]) => [name, Math.max(0, Number(limit) || 0)])), period: period === "monthly" ? "monthly" : "weekly" };
  const { error } = await auth.supabase.auth.updateUser({ data: { ...auth.user.user_metadata, cash_budget: budget } });
  if (error) return jsonError(error.message, 500);
  return jsonOk(budget);
}
