import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

export async function DELETE(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { error } = await auth.supabase
    .from("debts")
    .delete()
    .eq("id", params.id);
  if (error) return jsonError(error.message, 500);
  return jsonOk({ success: true });
}
