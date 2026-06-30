# Login / Accounts setup (Supabase) — what Dillon needs to create

This unblocks the login feature. ~20 min. Keep it in **Dillon's name**. The Google step is the
fiddly one — Jack/Claude can drive it in the browser if needed.

## 1. Create the Supabase project
1. Go to **supabase.com → Sign up** (use Dillon's Google/email), **New project**.
2. Name: `internnest`. Pick a region near most users (US East). Set a DB password (save it).
3. When it's ready: **Project Settings → API**, copy three values:
   - **Project URL** (e.g. `https://abcdxyz.supabase.co`) — safe to share
   - **anon public key** — safe to share (goes in the frontend)
   - **service_role key** — SECRET (goes only in Vercel env; never the frontend)

## 2. Email login (built in)
- **Authentication → Providers → Email** is on by default. We'll use **magic links** (passwordless) —
  no password storage/reset to manage. Nothing to do here unless you want to tweak the email template.

## 3. Google login (the involved one)
Google sign-in needs Google OAuth credentials:
1. **console.cloud.google.com** → create/select a project → **APIs & Services → OAuth consent screen**:
   External, app name "InternNest", support email = the InternNest email, save.
2. **Credentials → Create Credentials → OAuth client ID → Web application**.
   - Authorized redirect URI: the exact one Supabase shows under **Authentication → Providers → Google**
     (looks like `https://<your-project>.supabase.co/auth/v1/callback`). Paste it.
3. Copy the **Client ID** + **Client Secret** → paste into **Supabase → Authentication → Providers →
   Google** → enable.

## 4. URL config
- **Authentication → URL Configuration**: Site URL = `https://internnest.ai`.
  Add redirect URLs: `https://internnest.ai/**` and `https://internnest-six.vercel.app/**`
  (and `http://localhost:8888/**` for local testing).

## 5. Database: profiles + premium (run this SQL)
**SQL Editor → New query**, paste and run:
```sql
create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  premium boolean not null default false,
  premium_product text,
  created_at timestamptz not null default now()
);
alter table public.profiles enable row level security;
create policy "own profile read"  on public.profiles for select using (auth.uid() = id);
create policy "own profile write" on public.profiles for update using (auth.uid() = id);

-- auto-create a profile row when a user signs up
create or replace function public.handle_new_user() returns trigger
  language plpgsql security definer as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email)
  on conflict (id) do nothing;
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();
```

## 6. Send Jack
- **Project URL** + **anon public key** (Jack puts these in the frontend config).
- Jack/you add **service_role key** to **Vercel → Settings → Environment Variables** as
  `SUPABASE_SERVICE_ROLE_KEY` (secret — used server-side to flip `premium` after payment), plus
  `SUPABASE_URL`.

---

## What Jack/Claude builds once the above exists
- Glass-styled **Log in / Sign up** (Google button + email magic link), account state in the nav.
- **Premium becomes account-based:** checkout passes the logged-in user id → after Stripe confirms,
  a server function sets `premium = true` on that user's profile (via the service_role key) →
  the site unlocks Premium by checking the signed-in user's profile, not a per-browser token.
- (Later, optional) save a user's matches / tracker to their account so they sync across devices.
