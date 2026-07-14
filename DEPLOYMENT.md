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

This `app/` folder is its own self-contained git repo (branch `main`) and is meant to be
deployed **as the repository root** — not as a subfolder of the parent `money-manager`
repo. The parent repo only tracks `app/` as a gitlink and does **not** contain the app
source, so deploy from this repo directly.

### 5a. Push this app to its own GitHub repo

From inside the `app/` folder:

```bash
# Create an empty repo on GitHub first (e.g. "money-manager-app"), then:
git remote add origin git@github.com:YOUR-USERNAME/money-manager-app.git
git push -u origin main
```

`.env.local` is gitignored, so your Supabase keys are **not** pushed — you'll add them in
the host dashboard instead (next step).

### 5b. Import to Vercel

Any Node/serverless host that runs Next 14 works (the app uses server API routes +
middleware, so it is **not** static-only). Vercel is the typical choice:

1. **Import** the `money-manager-app` GitHub repo you just pushed.
2. **Root Directory:** leave as `./` (this repo's root *is* the Next.js app — do **not**
   set it to `app`).
3. **Framework preset:** Next.js (auto-detected). Build command `npm run build` and
   output are handled automatically.
4. **Environment variables** — add these (same names as `.env.local`):
   - `NEXT_PUBLIC_SUPABASE_URL` = `https://hxhgusybmacxffczesxk.supabase.co`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY` = your `sb_publishable_…` key
   - `OPENAI_API_KEY` *(optional — only enables AI debt-payoff advice)*
5. **Deploy.**

## Notes

- After deploying, add your production URL to **Supabase → Authentication → URL
  Configuration → Site URL / Redirect URLs** so email links resolve correctly.
- The daily recurring-transaction job (Section 2 of `SUPABASE_SETUP.sql`) is optional
  and requires the `pg_cron` extension.
