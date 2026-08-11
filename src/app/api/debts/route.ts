import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

const DUE_DATE_PREFIX = "[due-date:";

function readDueDate(notes: string | null) {
  const match = notes?.match(/\[due-date:(\d{4}-\d{2}-\d{2})\]/);
  return match?.[1] || null;
}

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { data, error } = await auth.supabase
    .from("debts")
    .select("*")
    .order("is_active", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) return jsonError(error.message, 500);
  return jsonOk((data || []).map((debt) => ({ ...debt, due_date: readDueDate(debt.notes) })));
}

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const startingBalance = Number(body.startingBalance);
  const dueDate = typeof body.dueDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(body.dueDate) ? body.dueDate : null;
  if (!name || !Number.isFinite(startingBalance) || startingBalance <= 0) {
    return jsonError("Enter a debt name and a starting balance greater than zero");
  }

  const { data, error } = await auth.supabase
    .from("debts")
    .insert({
      user_id: auth.user.id,
      name,
      creditor: typeof body.creditor === "string" ? body.creditor.trim() || null : null,
      balance: startingBalance,
      original_balance: startingBalance,
      interest_rate: Math.max(0, Number(body.interestRate) || 0),
      minimum_payment: 0,
      due_day: body.dueDay ? Math.min(31, Math.max(1, Number(body.dueDay))) : null,
      notes: dueDate ? `${DUE_DATE_PREFIX}${dueDate}]` : null,
    })
    .select()
    .single();
  if (error) return jsonError(error.message, 500);
  return jsonOk({ ...data, due_date: dueDate }, 201);
}
