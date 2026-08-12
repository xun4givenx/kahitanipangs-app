import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

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
  const cleanName = typeof name === "string" ? name.trim() : "";
  const cleanType = type === "income" || type === "expense" ? type : "";
  const cleanColor = typeof color === "string" && color.trim() ? color.trim() : "#6366f1";
  const cleanIcon = typeof icon === "string" && icon.trim() ? icon.trim().slice(0, 8) : null;

  if (!cleanName || !cleanType) return jsonError("Name and type are required");

  const { data, error } = await auth.supabase
    .from("categories")
    .insert({ user_id: auth.user.id, name: cleanName, type: cleanType, color: cleanColor, icon: cleanIcon })
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk(data, 201);
}
