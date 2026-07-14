import OpenAI from "openai";
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

  let aiAdvice: string | null = null;

  if (process.env.OPENAI_API_KEY) {
    try {
      const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
      const debtSummary = debts
        .map(
          (d: Debt) =>
            `${d.name}: $${d.balance} at ${d.interest_rate}% APR, min payment $${d.minimum_payment}`
        )
        .join("\n");

      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content:
              "You are a personal finance advisor. Provide concise, actionable debt payoff advice in 2-3 paragraphs.",
          },
          {
            role: "user",
            content: `I have these debts:\n${debtSummary}\n\nI'm using the ${strategy} strategy with a monthly budget of $${monthly_budget}. The plan will take ${monthsToPayoff} months and cost $${totalInterest} in interest. Please give me personalized advice.`,
          },
        ],
        max_tokens: 500,
      });

      aiAdvice = completion.choices[0]?.message?.content ?? null;
    } catch {
      aiAdvice = "AI advice unavailable. Please check your OpenAI API key.";
    }
  }

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
      ai_advice: aiAdvice,
      total_interest: totalInterest,
      months_to_payoff: monthsToPayoff,
      is_active: true,
    })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk(data, 201);
}
