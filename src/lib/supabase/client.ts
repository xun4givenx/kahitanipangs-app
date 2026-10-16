import { createBrowserClient } from "@supabase/ssr";

export function createClient() {
  const url = (
    process.env.NEXT_PUBLIC_SUPABASE_URL ||
    process.env.NEXT_SUPABASE_URL ||
    ""
  ).trim().replace(/\/+$/, "");

  const key = (
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
    process.env.NEXT_SUPABASE_KEY ||
    process.env.NEXT_SUPABASE_PUBLISHABLE_KEY ||
    ""
  ).trim();

  return createBrowserClient(url, key);
}
