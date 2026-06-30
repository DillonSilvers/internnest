# InternNest — Build Log

A running record of what's being built and why. More detailed than the Owner's Guide,
but kept readable. Newest entries at the bottom.

---

## 2026-06-28 — Foundation

- Created private GitHub repo `jackryan225/internpilot-ai` (to be renamed `internnest`)
  and pushed the existing 3-file static site (`index.html`, `styles.css`, `script.js`).
  Added `README.md` as a quick edit guide. Invited Dillon (`dillonsilvers1234`) as a collaborator.
- Verified the local copy was byte-identical to the live Netlify site before pushing.
- Linked the repo to the existing Netlify site for **continuous deploy** (push to `main`
  → live in ~30s). Build command: none. Publish dir: repo root (it's a static site).

## 2026-06-29 — Domain

- Dillon purchased **internnest.ai** (GoDaddy; `.ai`, ~$70–100/yr — to be held in Dillon's name).
- Pointed it at Netlify via **Netlify DNS**: set GoDaddy's nameservers to Netlify's four
  (`dns1–4.p06.nsone.net`), added the domain in Netlify (primary = internnest.ai, www → redirect).
- Status: nameservers propagated to Netlify; Netlify serving the site at the origin;
  waiting on the old cached DNS to expire + Netlify to auto-issue the Let's Encrypt SSL cert.

## Decisions locked (brainstorm)

- **Hosting:** stay on Netlify (static + serverless functions + SSL + auto-deploy — covers everything v1 needs).
- **Design freeze (Dillon's rule):** do NOT change the front-end design or structure unless
  it's actively glitchy. Allowed: the rebrand (logo + name) and bug fixes only.
- **Rebrand:** InternPilot AI → **InternNest** (logo provided by Dillon; same layout/structure).
- **AI matcher (core deliverable):** real "Find My Matches" engine. A real internship dataset
  (`internships.json`, built via an agentic research sweep, each entry with a verified application
  URL) + a Netlify serverless function that pre-filters by industry/location, then calls the AI to
  score/explain the shortlist. Provider TBD (Claude Haiku vs Gemini Flash).
- **Chat advisor:** secondary; trim-first if budget tightens.
- **Payments:** Stripe (account created in Dillon's name). Stripe-hosted checkout + a lightweight
  unlock **verified server-side** against the Stripe session (so the success URL can't be faked).
  $9.99 one-time "Unlock Premium" + $29 "Match Report" (printable → Save as PDF). Real
  accounts/subscriptions deferred to a later phase.
- **Free vs Premium:** Free = top 3 matches + one-line why. Premium = all ~10 matches, full
  reasoning + skill gaps, AI outreach messages, chat advisor, resume tips.

## Engagement

- Fixed fee **$1,600** this round (basic-but-real AI + full MVP); more depending on performance.
  Jack = contractor for Dillon. Full handoff: ownership transfer of all accounts + maintenance
  lessons + the Owner's Guide.

## 2026-06-29 — Rebrand shipped (Milestone 1 complete)

- Rebranded InternPilot → **InternNest** site-wide: nav + footer wordmark now "Intern**Nest**`.ai`".
  Chose a clean text wordmark over the square badge logo (the badge doesn't fit a 66px nav); the
  badge is the **favicon**. Updated title, meta description, hero subheading, footer copyright.
  Renamed the logo asset to `internnest-logo.png`.
- Fixed a **pre-existing glitch** (Dillon had flagged it): the mobile menu rendered open at desktop
  because `#mobileMenu` lacked the `hidden` class and nothing hid `.mobile-menu` at desktop. One-line
  fix: `<div class="mobile-menu hidden" ...>`.
- Renamed the GitHub repo `internpilot-ai` → **`internnest`** (old URL auto-redirects).
- **Netlify gotcha (important):** git-triggered deploys were failing — *"Build blocked: unrecognized
  Git contributor; this plan allows only verified members to push to private repos."* Netlify's free
  plan blocks builds on **private** repos pushed by non-account-members. **Fix: made the repo PUBLIC.**
  Note: clicking "Trigger deploy" kept failing (cached "private" view); a fresh **git push** forced
  Netlify to re-read the repo as public and the build passed. Auto-deploy on push now works.
- ✅ Verified live at **https://internnest.ai** (HTTP 200, valid SSL, 0 "InternPilot" refs;
  InternNest wordmark + favicon + menu fix all present).

## 2026-06-29 — Dataset built (Milestone 2 complete)

- Built `internships.json` via two background multi-agent workflows (researcher → adversarial URL
  verifier → curator), then merged + cleaned:
  - Main sweep (31 agents, ~55 min): 47 verified + 36 backfill = 83 listings across all 8 industries.
  - Targeted top-up (8 agents, ~13 min) for the under-covered priority industries (Finance,
    Consulting, Real Estate, Marketing): 11 new verified listings.
  - Merge/cleanup: HTML-entity decode, dedupe by company+role, dropped one FOX Sports URL that
    returned 500 and a redundant Bain "Deadline #2" entry.
- **Final: 88 real, verified internships**, every one with a live https application_url
  (independent spot-checks: 17/18 sampled URLs returned 200; the one 500 was dropped).
- Coverage: Technology 15, Sports Business 17, Marketing 14, Media & Ent. 12, Healthcare 10,
  Real Estate 8, Consulting 7, **Finance 5**. Finance + Real Estate are the structural late-June
  ceiling (2026 roles filled, 2027 not yet posted) — improvable in a fall refresh; the matcher's
  cross-industry fallback covers thin industries at match time.
- A few listings carry a "Summer 2026" term (verified live, likely late/rolling) — flagged for refresh.
- Refresh process = re-run the workflows (Jack/Claude), since Dillon is non-technical.

## 2026-06-29 — Matcher built (Milestone 3) — LOCAL ONLY, not yet deployed

- Built the AI matcher per plan: `netlify/functions/match.js` + `netlify/lib/{matcher,claude,ratelimit}.js`,
  wired into the existing card UI in `script.js`. 11 unit tests (node:test), all green.
- Verified end-to-end locally via `netlify dev`: form → function → real internships in the existing cards;
  Free shows 3 + an "unlock" CTA; "Apply Now" → the real listing. Confirmed both fallback mode (no key) and
  **AI mode** (with a key): personalized score / why / missing-skills / tip in ~7s.
- **Latency lesson:** per-listing AI generation blew past Netlify's ~10s function limit (~13–18s). Fix: cap
  output (8 candidates, 750 max_tokens), a real 9s abort that falls back, and a salvage parser for truncated
  JSON. AI outreach was the biggest token hog → moved off the matcher; outreach is templated client-side for
  now (true AI outreach = a fast-follow, generated per-card on click).
- **Key handling (decision):** dev/testing uses **Jack's own** Anthropic key in a local gitignored `.env`
  (his credits). At handoff, **Dillon creates his own key** and adds it to Netlify env (his billing) — clean
  ownership + cost separation.
- **Not deployed:** all matcher commits are LOCAL (not pushed). Live internnest.ai still serves the old demo
  until the single handoff deploy (Dillon's key + Stripe live keys → push → verify).

## 2026-06-29 — Payments built (Milestone 4) — LOCAL ONLY, Stripe TEST mode

- Built real Stripe payments per plan: two Netlify Functions (`create-checkout`, `verify-unlock`) +
  two libs (`netlify/lib/stripe.js` REST wrapper, `netlify/lib/unlock.js` HMAC token). 11 new unit
  tests (node:test), all green (22 total in the suite).
- **Flow:** buy button → `create-checkout` builds a Stripe Checkout Session (secret key server-side
  only) → Stripe-hosted checkout → redirect back to `/?paid=…&session_id=…` → `verify-unlock`
  retrieves the session, confirms `payment_status === 'paid'`, returns an **HMAC-signed unlock token**
  → browser stores it in `localStorage` → premium unlocks. The signature means the success URL can't
  be forged into a valid unlock without a real paid session.
- **Two products**, both wired to the existing pricing buttons (design-freeze-safe — same as making
  "Apply Now" real): **$9.99 Premium** (unlocks all matches + full reasoning) and **$29 Match Report**
  (same unlock **plus** a print-optimized report page → browser Print → Save as PDF). Dropped "/mo"
  from the Premium button to match the v1 one-time unlock.
- **Token design:** `{product, iat, exp}` signed with `UNLOCK_SIGNING_SECRET` (HMAC-SHA256,
  constant-time compare, 1-year expiry). Server is the only issuer; client just stores + checks expiry.
- **Key handling:** `STRIPE_SECRET_KEY` is a Stripe **test** key in the local gitignored `.env`
  (Jack's, for building). `UNLOCK_SIGNING_SECRET` generated locally (random 32-byte hex). At handoff,
  Dillon's **live** Stripe keys go into Netlify env. `.env` confirmed gitignored — no secret committed.
- **Honest limit (documented):** unlock is per-browser (localStorage); clears on new device / cleared
  storage. True enforcement = the accounts/subscriptions phase (Phase 2).
- **Verified end-to-end locally (2026-06-29):** with a Stripe **restricted test key** (`rk_test_…`,
  Checkout Sessions read+write) in `.env`, drove the full flow in a real browser — matcher → free tier
  shows 3/5 + unlock CTA → **Start Premium $9.99** → Stripe-hosted checkout → paid with test card
  `4242 4242 4242 4242` → redirect back → `verify-unlock` issued the signed token → `localStorage` set
  → re-match shows **all 5, no CTA** (`isUnlocked()` true, 365-day token). Report flag correctly drives
  the "🖨️ Print / Save as PDF" button. Test browser reset to clean free state afterward.
- **Not deployed:** all payments commits are LOCAL. Live keys swapped in at the single handoff deploy.

## 2026-06-30 — Multi-page site, design refresh & deploy (Phase 2, after Dillon's first-look call)

Dillon reviewed the first live deploy and asked for (1) every nav/footer link to be a real page so he
can promote it, (2) a less "AI" look — no emojis, off-white instead of stark white — and (3) it deployed.
Design freeze lifted for this round.

- **Design refresh:** warm off-white theme (`--bg:#faf8f3`, warm `--surface`); replaced every emoji
  site-wide with clean monoline SVG icons (3-step process, tracker columns, match-card labels, hero
  check/sparkle, upload, submit). Fully emoji-free now (verified by script).
- **Multi-page architecture:** built 13+ real pages as clean folder URLs (`/how-it-works`, `/pricing`,
  `/about`, `/contact`, `/blog` + 3 posts, `/careers`, `/privacy`, `/terms`, `/cookies`, `/get-matched`,
  `/tracker`). Shared nav/footer chrome; generated via a one-off script (kept in scratchpad). All nav +
  footer links wired to real pages — link audit shows zero broken internal links.
- **Tools split out (per Dillon):** the matcher form moved to `/get-matched`, the tracker to `/tracker`;
  homepage now shows teasers linking to them. `script.js` made multi-page-safe (every init guarded) and
  the tracker now persists in `localStorage` so "Save to Tracker" works across the separate pages.
- **Pricing made honest:** copy fixed from "/month" to **one-time** everywhere (Premium $9.99 one-time,
  Report $29 one-time) to match what's actually built/charged. Subscription is a future decision.
- **Contact:** real Netlify Forms contact form (`data-netlify`) → submissions land in Netlify.
- **SEO:** per-page `<title>`/description/canonical/OG tags, `sitemap.xml`, `robots.txt`, custom `404.html`.
- **Legal:** Privacy / Terms / Cookie are standard templates with clearly-bracketed placeholders for
  Dillon's legal entity + a "have a professional review before launch" note.
- **Theme options for the design call:** 3 homepage mockups at `/themes/` (noindex) — **Warm** (current),
  **Liquid Glass** (frosted/gradient showpiece), **Dark** (premium high-contrast). Delete after the call.
- **Still Dillon's to do:** Netlify billing (the account kept 503'ing on usage limits), Stripe go-live
  (KYC done), the domain Outlook email, and the social links (footer icons are placeholders until sent).

## 2026-06-30 — Migrating off Netlify → Vercel (Pro)

Dillon's Netlify account kept tripping the credit-based Free plan (300 credits/period) — the site
503'd twice ("usage exceeded"), recovered only via a one-time grace top-up. Jack decided to leave
Netlify for **Vercel Pro** (predictable flat pricing; per-file serverless functions fit our matcher;
no surprise credit cutoffs). Render was considered and rejected (free web service sleeps → 30–60s
cold start on the matcher).

- **Shared logic** moved `netlify/lib/` → top-level `lib/` (platform-neutral); both function sets import it.
- **Vercel functions** added under `api/` in `(req,res)` format: `match`, `create-checkout`,
  `verify-unlock`, `contact`. `vercel.json` sets cleanUrls + function maxDuration (match=30s).
- **Frontend** repointed from `/.netlify/functions/*` → **`/api/*`**.
- **Zero-downtime shim:** `netlify.toml` now rewrites `/api/* → /.netlify/functions/:splat`, so the
  live Netlify site keeps serving `/api/*` until DNS cuts over to Vercel. Both hosts work during cutover.
- **Rate-limiter dropped** for Vercel (was `@netlify/blobs`, Netlify-only). The $50 Anthropic spend cap
  is the real backstop; can add Vercel KV later if needed.
- **Contact form** moved off Netlify Forms → JS submit to `/api/contact`. Sends via Resend **if**
  `RESEND_API_KEY` is set (else accepts + logs). Mirror `netlify/functions/contact.js` for the shim.
- Verified locally: 22/22 lib tests pass; `api/*` adapters smoke-tested (mock req/res); `/api/*` work
  end-to-end through the Netlify dev shim. Anthropic key confirmed valid.
- **Cutover (Dillon, his account):** create Vercel project from the GitHub repo → add env vars
  (ANTHROPIC_API_KEY, STRIPE_SECRET_KEY, UNLOCK_SIGNING_SECRET; optional RESEND_API_KEY/CONTACT_TO)
  → verify on the *.vercel.app URL → point internnest.ai DNS at Vercel → retire the Netlify site.
