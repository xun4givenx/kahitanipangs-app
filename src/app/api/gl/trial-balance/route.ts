import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";
import { getTrialBalance } from "@/lib/server/ledger-gl";
import type { Book } from "@/types/database";

export async function GET(request: Request) {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const { searchParams } = new URL(request.url);
  const bookParam = searchParams.get("book");
  const book = bookParam === "personal" || bookParam === "business" ? (bookParam as Book) : undefined;
  const asOf = searchParams.get("asOf") ?? undefined;

  const result = await getTrialBalance(auth.supabase, { book, asOf });
  if (!result.ok) return jsonError(result.error, result.status ?? 500);
  return jsonOk(result.data);
}
