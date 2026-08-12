import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { data, error } = await auth.supabase
    .from("categories")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error) return jsonError(error.message, 404);
  return jsonOk(data);
}

export async function PUT(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const body = await request.json() as Record<string, unknown>;
  const name = typeof body.name === "string" ? body.name.trim() : "";
  const type = body.type === "income" || body.type === "expense" ? body.type : "";
  const color = typeof body.color === "string" && body.color.trim() ? body.color.trim() : "#6366f1";
  const icon = typeof body.icon === "string" && body.icon.trim() ? body.icon.trim().slice(0, 8) : null;
  if (!name || !type) return jsonError("Name and type are required");

  const { data, error } = await auth.supabase
    .from("categories")
    .update({ name, type, color, icon })
    .eq("id", params.id)
    .select()
    .single();

  if (error) return jsonError(error.message, 500);
  return jsonOk(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { error } = await auth.supabase
    .from("categories")
    .delete()
    .eq("id", params.id);

  if (error) return jsonError(error.message, 500);
  return jsonOk({ success: true });
}
