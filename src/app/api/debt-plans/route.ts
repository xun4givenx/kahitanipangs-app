import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { calculateDebtPayoff } from "@/lib/utils/finance";
import type { Debt, DebtStrategy } from "@/types/database";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { data, error } = await auth.supabase
    .from("debt_plans")
    .select("*")
    .eq("is_active", true)
    .order("created_at", { ascending: false });

  if (error) return jsonError(error.message, 500);
  return jsonOk(data);
}

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const { strategy, monthly_budget } = body as {
    strategy: DebtStrategy;
    monthly_budget: number;
  };

  if (!strategy || !monthly_budget) {
    return jsonError("Strategy and monthly budget are required");
  }

  const { data: debts, error: debtsError } = await auth.supabase
    .from("debts")
    .select("*")
    .eq("is_active", true)
    .gt("balance", 0);

  if (debtsError) return jsonError(debtsError.message, 500);
  if (!debts?.length) return jsonError("No active debts found");

  const { schedule, totalInterest, monthsToPayoff } = calculateDebtPayoff(
    debts as Debt[],
    monthly_budget,
    strategy
  );

  const tip =
    strategy === "avalanche"
      ? "Avalanche strategy: paying down your highest-interest debt first minimizes total interest paid over time."
      : "Snowball strategy: paying off your smallest balance first builds momentum with quick wins.";

  await auth.supabase
    .from("debt_plans")
    .update({ is_active: false })
    .eq("user_id", auth.user.id);

  const { data, error } = await auth.supabase
    .from("debt_plans")
    .insert({
      user_id: auth.user.id,
      strategy,
      monthly_budget,
      schedule,
      ai_advice: tip,
      total_interest: totalInterest,
      months_to_payoff: monthsToPayoff,
      is_active: true,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk(data, 201);
}
