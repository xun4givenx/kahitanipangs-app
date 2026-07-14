# Deploying Money Manager (Next.js app)

This is the Next.js app in the `app/` folder. It uses Supabase for auth + data.

## 1. Create a Supabase project

1. Go to <https://supabase.com> → **New project**.
2. Once it's ready, open **SQL Editor → New query**, paste the entire contents of
   [`SUPABASE_SETUP.sql`](./SUPABASE_SETUP.sql), and click **Run**.
   - This creates all tables, row-level-security policies, and balance triggers.
   - ⚠️ Do **not** run `supabase/migrations/20240301000000_initial_schema.sql` from the
     old Vite project — it's an incompatible older schema.
3. **Authentication → Providers → Email**: make sure Email is enabled.
   - For quick testing you can turn **"Confirm email"** off so new signups can log in
     immediately. Leave it on for production.

## 2. Get your keys

In the Supabase dashboard: **Project Settings → API**. Copy:

- **Project URL** → `NEXT_PUBLIC_SUPABASE_URL`
- **anon public** key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Both of these are safe to expose in the browser. Do **not** use the `service_role` key
here — the app never needs it.

## 3. Configure environment variables

Create `app/.env.local` (copy from `.env.local.example`):

```env
NEXT_PUBLIC_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=YOUR-ANON-KEY

# Optional — only enables the AI debt-payoff advice feature. Without it the app
# falls back to a built-in calculation.
# OPENAI_API_KEY=sk-...
```

## 4. Build & run locally

```bash
cd app
npm install
npm run build
npm start        # serves the production build on http://localhost:3000
```

Sign up, and you'll get a working, persistent account backed by your Supabase project.

## 5. Put it online

The build output is a standard Next.js app. Host it anywhere that runs Next 14 (it uses
server API routes + middleware, so it needs a Node/serverless host — not static-only
hosting). When you connect your host:

- **Root directory:** `app` (the Next.js app lives in this subfolder, not the repo root).
- **Build command:** `npm run build`   **Output:** handled by Next automatically.
- **Environment variables:** add the same `NEXT_PUBLIC_SUPABASE_URL`,
  `NEXT_PUBLIC_SUPABASE_ANON_KEY` (and optional `OPENAI_API_KEY`) in the host's
  dashboard.

### Vercel (typical)
1. Import the GitHub repo.
2. Set **Root Directory** to `app`.
3. Add the environment variables above.
4. Deploy.

## Notes

- After deploying, add your production URL to **Supabase → Authentication → URL
  Configuration → Site URL / Redirect URLs** so email links resolve correctly.
- The daily recurring-transaction job (Section 2 of `SUPABASE_SETUP.sql`) is optional
  and requires the `pg_cron` extension.
