import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { getHouseholdMember } from "@/lib/household";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const member = await getHouseholdMember(auth.supabase, auth.user.id);
  if (!member) return jsonError("Create or join a household first", 409);
  const { data, error } = await auth.supabase
    .from("categories")
    .select("*")
    .order("name");

  if (error) return jsonError(error.message, 500);
  return jsonOk(data);
}

export async function POST(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const body = await request.json();
  const { name, type, color, icon } = body;

  if (!name || !type) return jsonError("Name and type are required");

  const member = await getHouseholdMember(auth.supabase, auth.user.id);
  if (!member) return jsonError("Create or join a household first", 409);
  const { data, error } = await auth.supabase
    .from("categories")
    .insert({ user_id: auth.user.id, household_id: member.household_id, name, type, color, icon })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk(data, 201);
}
