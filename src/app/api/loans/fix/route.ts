import { getAuthUser, jsonError, jsonOk } from "@/lib/api-helpers";

export async function GET() {
  const auth = await getAuthUser();
  if (!auth) return jsonError("Unauthorized", 401);

  const supabase = auth.supabase;
  const userId = auth.user.id;

  const { data: loans, error: loansError } = await supabase
    .from("loans")
    .select("*")
    .eq("user_id", userId);

  if (loansError) return jsonError(loansError.message, 500);

  let fixedCount = 0;
  const fixedDetails: { name: string; oldRemaining: number; newRemaining: number }[] = [];

  for (const loan of loans) {
    const { data: collections } = await supabase
      .from("loan_collections")
      .select("*")
      .eq("loan_id", loan.id);

    if (!collections) continue;

    let expectedRemaining = loan.advanced_interest
      ? Number(loan.total_amount)
      : Number(loan.total_amount) + (Number(loan.total_amount) * Number(loan.interest_rate)) / 100;

    let totalInstallmentsCollected = 0;
    let expectedSavings = 0;

    for (const col of collections) {
      if (col.kind === "collection") {
        totalInstallmentsCollected += Number(col.installment_amount);
        expectedSavings += Number(col.savings_delta);
      } else if (col.kind === "withdrawal") {
        expectedSavings += Number(col.savings_delta); // negative
      }
    }

    expectedRemaining = Math.max(0, expectedRemaining - totalInstallmentsCollected);
    expectedSavings = Math.max(0, expectedSavings);

    const isRemainingWrong = Math.abs(expectedRemaining - Number(loan.remaining_balance)) > 0.01;
    const isSavingsWrong = Math.abs(expectedSavings - Number(loan.savings_balance)) > 0.01;

    if (isRemainingWrong || isSavingsWrong) {
      await supabase
        .from("loans")
        .update({
          remaining_balance: Number(expectedRemaining.toFixed(2)),
          savings_balance: Number(expectedSavings.toFixed(2)),
        })
        .eq("id", loan.id);

      fixedCount++;
      fixedDetails.push({
        name: loan.person_name,
        oldRemaining: loan.remaining_balance,
        newRemaining: Number(expectedRemaining.toFixed(2)),
      });
    }
  }

  return jsonOk({ success: true, fixedCount, fixedDetails });
}
