import type { SupabaseClient } from "@supabase/supabase-js";

export type HouseholdMember = {
  household_id: string;
  user_id: string;
  display_name: string;
  role: "owner" | "member";
};

export async function getHouseholdMember(supabase: SupabaseClient, userId: string) {
  const { data, error } = await supabase
    .from("household_members")
    .select("household_id, user_id, display_name, role")
    .eq("user_id", userId)
    .maybeSingle();

  if (error) throw error;
  return data as HouseholdMember | null;
}
