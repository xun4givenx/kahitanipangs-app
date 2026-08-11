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
  const { data, error } = await auth.supabase
    .from("transactions")
    .select("id, amount, description, notes, date, accounts(name), categories(name, color)")
    .eq("type", "expense")
    .gte("date", format(rangeStart, "yyyy-MM-dd"))
    .lte("date", format(rangeEnd, "yyyy-MM-dd"))
    .order("date", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return jsonError(error.message, 500);

  const expenses = (data || [])
    .filter((entry) => !entry.notes?.startsWith("Internal transfer:"))
    .map((entry) => {
      const category = Array.isArray(entry.categories) ? entry.categories[0] : entry.categories;
      const account = Array.isArray(entry.accounts) ? entry.accounts[0] : entry.accounts;
      const categoryName = category?.name || "Uncategorized";
      const rawSubcategory = entry.description?.trim() || "";
      return {
        id: entry.id,
        amount: Number(entry.amount),
        date: entry.date,
        category: categoryName,
        color: category?.color || null,
        subcategory: !rawSubcategory || rawSubcategory.toLowerCase() === categoryName.toLowerCase() ? "Unspecified" : rawSubcategory,
        account: account?.name || "Cash wallet",
      };
    });
  return jsonOk({ period, expenses });
}
