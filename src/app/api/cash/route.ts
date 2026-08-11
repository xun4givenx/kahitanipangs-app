import { getManilaToday } from "@/lib/utils/finance";
import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

const CASH_ACCOUNT = { name: "Cash wallet", type: "cash", balance: 0, currency: "PHP", color: "#16845a" };

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);
  let body: Record<string, unknown>;
  try {
    const parsed = await request.json();
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
      return jsonError("The cash record could not be read");
    }
    body = parsed as Record<string, unknown>;
  } catch {
    return jsonError("The cash record could not be read");
  }

  const { amount, type, description, categoryName, subcategoryName, date } = body;
  const numericAmount = Number(amount);
  if (!Number.isFinite(numericAmount) || numericAmount <= 0 || !["income", "expense"].includes(String(type))) {
    return jsonError("Enter a positive amount and choose cash in or cash out");
  }

  const transactionType = type as "income" | "expense";
  const cleanCategory = typeof categoryName === "string" ? categoryName.trim() : "";
  if (!cleanCategory) return jsonError("Choose or type a category");

  const cleanSubcategory = typeof subcategoryName === "string" ? subcategoryName.trim() : "";
  const cleanDescription = typeof description === "string" ? description.trim() : "";
  const transactionDate = typeof date === "string" && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : getManilaToday();

  // `limit(1)` keeps existing wallets usable even if an older database contains
  // duplicate setup rows. A previous version used `maybeSingle`, which turns
  // duplicates into an error and blocks both cash-in and cash-out entries.
  const { data: existingAccount, error: accountError } = await auth.supabase
    .from("accounts")
    .select("id")
    .eq("name", CASH_ACCOUNT.name)
    .order("created_at", { ascending: true })
    .limit(1)
    .maybeSingle();
  let account = existingAccount;
  if (accountError) return jsonError(accountError.message, 500);
  if (!account) {
    const created = await auth.supabase.from("accounts").insert({ ...CASH_ACCOUNT, user_id: auth.user.id }).select("id").single();
    if (!created.error) {
      account = created.data;
    } else if (created.error.code === "23505") {
      // Another request created the wallet first. Read it and continue instead
      // of failing this cash record with a unique-constraint error.
      const retry = await auth.supabase
        .from("accounts")
        .select("id")
        .eq("name", CASH_ACCOUNT.name)
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();
      if (retry.error || !retry.data) return jsonError(retry.error?.message || created.error.message, 500);
      account = retry.data;
    } else {
      return jsonError(created.error.message, 500);
    }
  }

  let categoryId: string | null = null;
  {
    const { data: category, error: categoryError } = await auth.supabase
      .from("categories")
      .select("id")
      .eq("name", cleanCategory)
      .eq("type", transactionType)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
    if (categoryError) return jsonError(categoryError.message, 500);
    if (category) {
      categoryId = category.id;
    } else {
      const created = await auth.supabase.from("categories").insert({
        user_id: auth.user.id,
        name: cleanCategory,
        type: transactionType,
        color: transactionType === "income" ? "#16845a" : "#d17a5e",
      }).select("id").single();
      if (!created.error) {
        categoryId = created.data.id;
      } else if (created.error.code === "23505") {
        const retry = await auth.supabase
          .from("categories")
          .select("id")
          .eq("name", cleanCategory)
          .eq("type", transactionType)
          .order("created_at", { ascending: true })
          .limit(1)
          .maybeSingle();
        if (retry.error || !retry.data) return jsonError(retry.error?.message || created.error.message, 500);
        categoryId = retry.data.id;
      } else {
        return jsonError(created.error.message, 500);
      }
    }
  }

  const { data, error } = await auth.supabase.from("transactions").insert({
    user_id: auth.user.id,
    account_id: account.id,
    category_id: categoryId,
    amount: numericAmount,
    type: transactionType,
    description: cleanSubcategory || cleanDescription || cleanCategory || (transactionType === "income" ? "Cash in" : "Cash out"),
    notes: cleanDescription || null,
    date: transactionDate,
  }).select("*, accounts(name), categories(name)").single();
  if (error) return jsonError(error.message, 500);
  return jsonOk(data, 201);
}
