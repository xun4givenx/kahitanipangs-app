import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { data, error } = await auth.supabase
    .from("loans")
    .select("*")
    .eq("id", params.id)
    .single();

  if (error) return jsonError(error.message, 404);
  return jsonOk(data);
}

export async function PATCH(
  request: Request,
  { params }: { params: { id: string } }
) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const body = await request.json();

  const { data, error } = await auth.supabase
    .from("loans")
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

  // Clean up GL entries for the loan disbursement
  await auth.supabase
    .from("journal_entries")
    .delete()
    .eq("reference", `loan_${params.id}`);

  // Clean up GL entries for all its collections
  // First get the collection IDs
  const { data: collections } = await auth.supabase
    .from("loan_collections")
    .select("id")
    .eq("loan_id", params.id);
    
  if (collections && collections.length > 0) {
    const colRefs = collections.map(c => `col_${c.id}`);
    await auth.supabase
      .from("journal_entries")
      .delete()
      .in("reference", colRefs);
  }

  const { error } = await auth.supabase
    .from("loans")
    .delete()
    .eq("id", params.id);

  if (error) return jsonError(error.message, 500);
  return jsonOk({ success: true });
}
