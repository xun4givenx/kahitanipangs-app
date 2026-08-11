import { getManilaToday } from "@/lib/utils/finance";
import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { getHouseholdMember } from "@/lib/household";


export async function GET(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const limit = parseInt(searchParams.get("limit") || "50");
  const accountId = searchParams.get("account_id");

  let query = auth.supabase
    .from("transactions")
    .select("*, accounts(name, color), categories(name, color)")
    .order("date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(limit);

  if (accountId) query = query.eq("account_id", accountId);

  const { data, error } = await query;
  if (error) return jsonError(error.message, 500);
  return jsonOk(data);
}

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const { account_id, category_id, amount, type, description, notes, date, loan_id, debt_id } = body;

  if (!account_id || !amount || !type) {
    return jsonError("Account, amount, and type are required");
  }

  const transactionDate = date || getManilaToday();

  const member = await getHouseholdMember(auth.supabase, auth.user.id);
  if (!member) return jsonError("Create or join a household first", 409);
  const { data, error } = await auth.supabase
    .from("transactions")
    .insert({
      user_id: auth.user.id,
      household_id: member.household_id,
      contributor_id: auth.user.id,
      contributor_name: member.display_name,
      account_id,
      category_id,
      amount,
      type,
      description: description || "",
      notes,
      date: transactionDate,
      loan_id: loan_id ?? null,
      debt_id: debt_id ?? null,
    })
    .select("*, accounts(name), categories(name)")
    .single();

  if (error) return jsonError(error.message, 500);

  return jsonOk(data, 201);
}
