import { endOfMonth, endOfWeek, format, parseISO, startOfMonth, startOfWeek } from "date-fns";
import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { getManilaToday } from "@/lib/utils/finance";

type BudgetPeriod = "weekly" | "monthly";
type BudgetCategory = { category: string; subcategory: string; limit: number };
type BudgetSettings = { categoryBudgets: BudgetCategory[]; period: BudgetPeriod };

function readBudget(metadata: unknown): BudgetSettings {
  const source = (metadata as { cash_budget?: { categoryBudgets?: BudgetCategory[]; categoryLimits?: Record<string, number>; period?: BudgetPeriod } } | undefined)?.cash_budget;
  const saved = Array.isArray(source?.categoryBudgets) ? source.categoryBudgets : [];
  const legacy = Object.entries(source?.categoryLimits || {}).map(([category, limit]) => ({ category, subcategory: "", limit: Number(limit) || 0 }));
  const categoryBudgets = (saved.length ? saved : legacy)
    .filter((item) => item && typeof item.category === "string" && item.category.trim())
    .map((item) => ({ category: item.category.trim(), subcategory: typeof item.subcategory === "string" ? item.subcategory.trim() : "", limit: Math.max(0, Number(item.limit) || 0) }));
  return { categoryBudgets, period: source?.period === "monthly" ? "monthly" : "weekly" };
}

export async function GET(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);
  const now = parseISO(getManilaToday());
  const budget = readBudget(auth.user.user_metadata);
  const requestedPeriod = new URL(request.url).searchParams.get("period");
  const period: BudgetPeriod = requestedPeriod === "monthly" || requestedPeriod === "weekly" ? requestedPeriod : budget.period;
  const periodStart = period === "weekly" ? startOfWeek(now, { weekStartsOn: 1 }) : startOfMonth(now);
  const periodEnd = period === "weekly" ? endOfWeek(now, { weekStartsOn: 1 }) : endOfMonth(now);
  const [{ data: transactions, error }, { data: savedCategories, error: savedCategoriesError }] = await Promise.all([
    auth.supabase.from("transactions").select("amount, description, notes, categories(name, color)").eq("type", "expense").gte("date", format(periodStart, "yyyy-MM-dd")).lte("date", format(periodEnd, "yyyy-MM-dd")),
    auth.supabase.from("categories").select("name, color").eq("type", "expense").order("name"),
  ]);
  if (error || savedCategoriesError) return jsonError(error?.message || savedCategoriesError?.message || "Unable to load budget categories", 500);
  const spendTransactions = (transactions || []).filter((transaction) => !transaction.notes?.startsWith("Internal transfer:"));
  const colors = new Map((savedCategories || []).map((category) => [category.name.toLowerCase(), category.color]));
  const categoryBudgets = budget.categoryBudgets.map((budgetItem, index) => {
    const spent = spendTransactions.reduce((sum, transaction) => {
      const rawCategory = transaction.categories as { name: string; color: string } | { name: string; color: string }[] | null;
      const category = Array.isArray(rawCategory) ? rawCategory[0] : rawCategory;
      const matchesCategory = category?.name?.toLowerCase() === budgetItem.category.toLowerCase();
      const matchesSubcategory = !budgetItem.subcategory || transaction.description?.trim().toLowerCase() === budgetItem.subcategory.toLowerCase();
      return matchesCategory && matchesSubcategory ? sum + Number(transaction.amount) : sum;
    }, 0);
    return { key: `${budgetItem.category.toLowerCase()}::${budgetItem.subcategory.toLowerCase()}::${index}`, ...budgetItem, spent, color: colors.get(budgetItem.category.toLowerCase()) || null };
  });
  const spent = spendTransactions.reduce((sum, transaction) => sum + Number(transaction.amount), 0);
  const totalBudgeted = categoryBudgets.reduce((sum, item) => sum + item.limit, 0);
  return jsonOk({
    period,
    spent,
    totalBudgeted,
    remaining: totalBudgeted - spent,
    categoryBudgets,
  });
}

export async function PUT(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);
  const { categoryBudgets, period } = await request.json();
  const budget: BudgetSettings = {
    categoryBudgets: (Array.isArray(categoryBudgets) ? categoryBudgets : [])
      .filter((item) => item && typeof item.category === "string" && item.category.trim())
      .map((item) => ({ category: item.category.trim(), subcategory: typeof item.subcategory === "string" ? item.subcategory.trim() : "", limit: Math.max(0, Number(item.limit) || 0) })),
    period: period === "monthly" ? "monthly" : "weekly",
  };
  const { error } = await auth.supabase.auth.updateUser({ data: { ...auth.user.user_metadata, cash_budget: budget } });
  if (error) return jsonError(error.message, 500);
  return jsonOk(budget);
}
