# Moving InternNest from Netlify → Vercel

The code is already Vercel-ready (committed + pushed to `main`). These are the **account + DNS** steps
— they need the owner's logins, so Jack/Dillon do them. ~15 minutes + DNS propagation.

> Keep accounts in **Dillon's name**. If Jack does the clicks, use Dillon's email/GitHub.

## 1. Create the Vercel project (from the existing GitHub repo)
1. Go to **vercel.com → Sign up** with the **GitHub account that owns `jackryan225/internnest`** (or add it as a team member).
2. **Add New → Project → Import** the `internnest` repo.
3. Framework preset: **Other** (it's a static site + `api/` functions). Build command: **none**. Output dir: leave default (root). Click **Deploy**.
4. First deploy lands on a `*.vercel.app` URL. It will work for pages immediately; the functions need env vars (next step).

## 2. Add environment variables (Project → Settings → Environment Variables)
Add these (same values as today), for **Production** (and Preview):
- `ANTHROPIC_API_KEY` = Dillon's Anthropic key (`sk-ant-…`)  ← the matcher
- `STRIPE_SECRET_KEY` = Stripe key (`sk_live_…` for real money, or `rk_test_…` to keep testing)  ← payments
- `UNLOCK_SIGNING_SECRET` = any long random string (reuse the current one, or generate a new 64-char hex)
- *(optional, for the contact form to email)* `RESEND_API_KEY` = a Resend.com API key, and `CONTACT_TO` = the inbox address

After adding them, **Redeploy** (Deployments → ⋯ → Redeploy) so the functions pick them up.

## 3. Verify on the vercel.app URL (before touching DNS)
On the `*.vercel.app` URL, confirm:
- Pages load (`/`, `/pricing`, `/blog`, etc.)
- "Find My Matches" returns matches (AI)
- A pricing button opens Stripe checkout
- Contact form submits without error

## 4. Point internnest.ai at Vercel (the cutover)
1. In the Vercel project: **Settings → Domains → Add** `internnest.ai` (and `www.internnest.ai`).
2. Vercel shows the **exact DNS records** to set. Today the domain uses **Netlify's nameservers**
   (`dns1–4.p06.nsone.net`) at GoDaddy, so the clean move is:
   - **GoDaddy → internnest.ai → Nameservers →** change to the nameservers Vercel gives you
     (usually `ns1.vercel-dns.com` / `ns2.vercel-dns.com`), **or** follow Vercel's A-record option
     (`A @ 76.76.21.21` + `CNAME www → cname.vercel-dns.com`) if you prefer to keep GoDaddy DNS.
3. Vercel auto-issues SSL once DNS resolves (minutes to a couple hours).

## 5. After cutover
- Confirm `https://internnest.ai` serves from Vercel (matcher + payments + pages all good).
- **Retire Netlify:** in Netlify, unlink/delete the `dynamic-stardust-6be07e` site so it stops building.
- In the repo, the Netlify shim can be removed later (the `netlify.toml` `/api/*` rewrite, the
  `netlify/` folder, and `@netlify/blobs` in `package.json`) — harmless to leave for now.

## Notes
- **Plan:** Vercel **Pro (~$20/mo)** for a commercial product (Hobby disallows commercial use). Flat + predictable.
- **Rate limiting:** dropped in the move (was Netlify-only Blobs). The **$50/mo Anthropic spend cap** is the
  backstop; add Vercel KV later if abuse shows up.
- **Stripe:** still on the **test** key until you switch to `sk_live_…`. Swap that env var when ready for real charges.
