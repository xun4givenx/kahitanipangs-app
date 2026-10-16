/** @type {import('next').NextConfig} */
const nextConfig = {
  env: {
    NEXT_PUBLIC_SUPABASE_URL: (
      process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_SUPABASE_URL ||
      ""
    ).trim().replace(/\/+$/, ""),
    NEXT_PUBLIC_SUPABASE_ANON_KEY: (
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
      process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ||
      process.env.NEXT_SUPABASE_KEY ||
      process.env.NEXT_SUPABASE_PUBLISHABLE_KEY ||
      ""
    ).trim(),
  },
};

export default nextConfig;
