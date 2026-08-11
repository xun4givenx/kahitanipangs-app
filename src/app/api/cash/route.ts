import { getManilaToday } from "@/lib/utils/finance";
import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

const CASH_ACCOUNT = { name: "Cash wallet", type: "cash", balance: 0, currency: "PHP", color: "#16845a" };

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);
  const { amount, type, description, categoryName, subcategoryName, date } = await request.json();
  if (!amount || Number(amount) <= 0 || !["income", "expense"].includes(type)) return jsonError("A positive cash amount and entry type are required");

  const { data: existingAccount, error: accountError } = await auth.supabase.from("accounts").select("id").eq("name", CASH_ACCOUNT.name).maybeSingle();
  let account = existingAccount;
  if (accountError) return jsonError(accountError.message, 500);
  if (!account) {
    const created = await auth.supabase.from("accounts").insert({ ...CASH_ACCOUNT, user_id: auth.user.id }).select("id").single();
    if (created.error) return jsonError(created.error.message, 500);
    account = created.data;
  }

  let categoryId: string | null = null;
  const cleanCategory = typeof categoryName === "string" ? categoryName.trim() : "";
  if (cleanCategory) {
    const { data: category, error: categoryError } = await auth.supabase
      .from("categories")
      .select("id")
      .eq("name", cleanCategory)
      .eq("type", type)
      .maybeSingle();
    if (categoryError) return jsonError(categoryError.message, 500);
    if (category) {
      categoryId = category.id;
    } else {
      const created = await auth.supabase.from("categories").insert({
        user_id: auth.user.id,
        name: cleanCategory,
        type,
        color: type === "income" ? "#16845a" : "#d17a5e",
      }).select("id").single();
      if (created.error) return jsonError(created.error.message, 500);
      categoryId = created.data.id;
    }
  }

  const { data, error } = await auth.supabase.from("transactions").insert({
    user_id: auth.user.id,
    account_id: account.id,
    category_id: categoryId,
    amount: Number(amount),
    type,
    description: subcategoryName?.trim() || description?.trim() || cleanCategory || (type === "income" ? "Cash in" : "Cash out"),
    notes: description?.trim() || null,
    date: date || getManilaToday(),
  }).select("*, accounts(name), categories(name)").single();
  if (error) return jsonError(error.message, 500);
  return jsonOk(data, 201);
}
