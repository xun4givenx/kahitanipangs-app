import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

const DEFAULT_CATEGORIES = [
  { name: "Salary", type: "income", color: "#22c55e" },
  { name: "Freelance", type: "income", color: "#10b981" },
  { name: "Investments", type: "income", color: "#14b8a6" },
  { name: "Food & Dining", type: "expense", color: "#f97316" },
  { name: "Transportation", type: "expense", color: "#3b82f6" },
  { name: "Housing", type: "expense", color: "#8b5cf6" },
  { name: "Utilities", type: "expense", color: "#eab308" },
  { name: "Entertainment", type: "expense", color: "#ec4899" },
  { name: "Shopping", type: "expense", color: "#ef4444" },
  { name: "Healthcare", type: "expense", color: "#06b6d4" },
];

const DEFAULT_ACCOUNTS = [
  { name: "Checking", type: "checking", balance: 0, color: "#3b82f6" },
  { name: "Savings", type: "savings", balance: 0, color: "#22c55e" },
];

export async function POST() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { count: catCount } = await auth.supabase
    .from("categories")
    .select("*", { count: "exact", head: true });

  if (!catCount) {
    await auth.supabase.from("categories").insert(
      DEFAULT_CATEGORIES.map((c) => ({ ...c, user_id: auth.user.id }))
    );
  }

  const { count: accCount } = await auth.supabase
    .from("accounts")
    .select("*", { count: "exact", head: true });

  if (!accCount) {
    await auth.supabase.from("accounts").insert(
      DEFAULT_ACCOUNTS.map((a) => ({ ...a, user_id: auth.user.id }))
    );
  }

  return jsonOk({ seeded: true });
}
