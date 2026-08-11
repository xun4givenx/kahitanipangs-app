import { endOfMonth, format, parseISO, startOfMonth } from "date-fns";
import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { getManilaToday } from "@/lib/utils/finance";

type BudgetSettings = { monthlyLimit: number; categoryLimits: Record<string, number> };

function readBudget(metadata: unknown): BudgetSettings {
  const source = (metadata as { cash_budget?: Partial<BudgetSettings> } | undefined)?.cash_budget;
  return { monthlyLimit: Number(source?.monthlyLimit) || 0, categoryLimits: source?.categoryLimits || {} };
}

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);
  const now = parseISO(getManilaToday());
  const { data: transactions, error } = await auth.supabase.from("transactions").select("amount, type, categories(name, color)").eq("type", "expense").gte("date", format(startOfMonth(now), "yyyy-MM-dd")).lte("date", format(endOfMonth(now), "yyyy-MM-dd"));
  if (error) return jsonError(error.message, 500);
  const budget = readBudget(auth.user.user_metadata);
  const categoryMap = new Map<string, { name: string; spent: number; color: string | null }>();
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
    spent,
    remaining: budget.monthlyLimit - spent,
    categoryLimits: budget.categoryLimits,
    categories: Array.from(categoryMap.values()).sort((a, b) => b.spent - a.spent),
  });
}

export async function PUT(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);
  const { monthlyLimit, categoryLimits } = await request.json();
  const budget: BudgetSettings = { monthlyLimit: Math.max(0, Number(monthlyLimit) || 0), categoryLimits: Object.fromEntries(Object.entries(categoryLimits || {}).map(([name, limit]) => [name, Math.max(0, Number(limit) || 0)])) };
  const { error } = await auth.supabase.auth.updateUser({ data: { ...auth.user.user_metadata, cash_budget: budget } });
  if (error) return jsonError(error.message, 500);
  return jsonOk(budget);
}
