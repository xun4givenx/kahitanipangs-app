import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { getHouseholdMember } from "@/lib/household";

const DEFAULT_CATEGORIES = [
  { name: "Salary", type: "income", color: "#16845a" },
  { name: "Side hustle", type: "income", color: "#54ad78" },
  { name: "Food & dining", type: "expense", color: "#e08163" },
  { name: "Home & bills", type: "expense", color: "#4476cc" },
  { name: "Transport", type: "expense", color: "#c38a3f" },
  { name: "Fun & dates", type: "expense", color: "#c46b8c" },
];

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);
  try {
    const member = await getHouseholdMember(auth.supabase, auth.user.id);
    if (!member) return jsonOk({ household: null, member: null, members: [] });
    const [{ data: household }, { data: members }] = await Promise.all([
      auth.supabase.from("households").select("id, name, currency, invite_code").eq("id", member.household_id).single(),
      auth.supabase.from("household_members").select("user_id, display_name, role").eq("household_id", member.household_id).order("created_at"),
    ]);
    return jsonOk({ household, member, members: members || [] });
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to load household", 500);
  }
}

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);
  const { householdName, displayName } = await request.json();
  if (!householdName?.trim() || !displayName?.trim()) return jsonError("Household and display names are required");
  try {
    const existing = await getHouseholdMember(auth.supabase, auth.user.id);
    if (existing) return jsonError("You already belong to a household", 409);
    const { data: household, error: householdError } = await auth.supabase
      .from("households")
      .insert({ name: householdName.trim(), created_by: auth.user.id, currency: "PHP" })
      .select("id, name, currency, invite_code")
      .single();
    if (householdError) return jsonError(householdError.message, 500);
    const { error: memberError } = await auth.supabase.from("household_members").insert({ household_id: household.id, user_id: auth.user.id, display_name: displayName.trim(), role: "owner" });
    if (memberError) return jsonError(memberError.message, 500);
    await auth.supabase.from("categories").insert(DEFAULT_CATEGORIES.map((category) => ({ ...category, user_id: auth.user.id, household_id: household.id })));
    await auth.supabase.from("accounts").insert({ user_id: auth.user.id, household_id: household.id, name: "Shared cash", type: "checking", balance: 0, currency: "PHP", color: "#16845a" });
    return jsonOk({ household }, 201);
  } catch (error) {
    return jsonError(error instanceof Error ? error.message : "Unable to create household", 500);
  }
}
