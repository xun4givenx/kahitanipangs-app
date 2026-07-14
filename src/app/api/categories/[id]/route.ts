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

  const body = await request.json();

  const { data, error } = await auth.supabase
    .from("categories")
    .update(body)
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
