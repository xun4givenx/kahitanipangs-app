import { getManilaToday } from "@/lib/utils/finance";
import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);
  const { data, error } = await auth.supabase.from("loans").select("*").order("created_at", { ascending: false });
  if (error) return jsonError(error.message, 500);
  return jsonOk(data || []);
}

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);
  const body = await request.json();
  const personName = typeof body.personName === "string" ? body.personName.trim() : "";
  const startingBalance = Number(body.startingBalance);
  if (!personName || !Number.isFinite(startingBalance) || startingBalance <= 0) {
    return jsonError("Enter a person and a starting balance greater than zero");
  }
  const { data, error } = await auth.supabase.from("loans").insert({
    user_id: auth.user.id,
    person_name: personName,
    total_amount: startingBalance,
    remaining_balance: startingBalance,
    amount_released: 0,
    interest_rate: 0,
    start_date: typeof body.startDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.startDate) ? body.startDate : getManilaToday(),
    frequency: "monthly",
    installments: 0,
    repayment_amount: 0,
    advanced_interest: false,
  }).select().single();
  if (error) return jsonError(error.message, 500);
  return jsonOk(data, 201);
}
