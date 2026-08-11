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

  const { amount, type, description, categoryName, subcategoryName, date, accountId, debtId } = body;
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
  const selectedAccountId = typeof accountId === "string" && accountId.trim() && accountId !== "cash-wallet" ? accountId : null;
  const selectedDebtId = typeof debtId === "string" && debtId.trim() ? debtId : null;
  const isDebtPayment = transactionType === "expense" && cleanCategory.toLowerCase() === "debt payment";

  if (isDebtPayment && !selectedDebtId) return jsonError("Choose the debt you are paying");
  if (!isDebtPayment && selectedDebtId) return jsonError("A debt can only be linked to a Debt payment cash-out");

  // `limit(1)` keeps existing wallets usable even if an older database contains
  // duplicate setup rows. A previous version used `maybeSingle`, which turns
  // duplicates into an error and blocks both cash-in and cash-out entries.
  const { data: existingAccount, error: accountError } = selectedAccountId
    ? await auth.supabase.from("accounts").select("id").eq("id", selectedAccountId).maybeSingle()
    : await auth.supabase
      .from("accounts")
      .select("id")
      .eq("name", CASH_ACCOUNT.name)
      .order("created_at", { ascending: true })
      .limit(1)
      .maybeSingle();
  let account = existingAccount;
  if (accountError) return jsonError(accountError.message, 500);
  if (selectedAccountId && !account) return jsonError("The selected account is unavailable", 404);
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

  let debtName = "";
  if (isDebtPayment && selectedDebtId) {
    const { data: debt, error: debtError } = await auth.supabase
      .from("debts")
      .select("name, balance")
      .eq("id", selectedDebtId)
      .eq("is_active", true)
      .maybeSingle();
    if (debtError) return jsonError(debtError.message, 500);
    if (!debt) return jsonError("The selected debt is unavailable", 404);
    if (numericAmount > Number(debt.balance)) return jsonError("Payment cannot be greater than the remaining debt balance");
    debtName = debt.name;
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
    description: isDebtPayment ? debtName : cleanSubcategory || cleanDescription || cleanCategory || (transactionType === "income" ? "Cash in" : "Cash out"),
    notes: cleanDescription || null,
    date: transactionDate,
    debt_id: selectedDebtId,
  }).select("*, accounts(name), categories(name)").single();
  if (error) return jsonError(error.message, 500);

  if (isDebtPayment && selectedDebtId) {
    const { error: paymentError } = await auth.supabase.from("debt_payments").insert({
      user_id: auth.user.id,
      debt_id: selectedDebtId,
      amount: numericAmount,
      payment_date: transactionDate,
      notes: `[cash:${data.id}]${cleanDescription ? ` ${cleanDescription}` : ""}`,
    });
    if (paymentError) {
      await auth.supabase.from("transactions").delete().eq("id", data.id);
      return jsonError(paymentError.message, 500);
    }
  }
  return jsonOk(data, 201);
}
