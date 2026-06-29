# InternNest v1 (MVP) — Design Spec

**Date:** 2026-06-29
**Domain:** internnest.ai (live on Netlify)
**Builder:** Jack (contractor) · **Owner/client:** Dillon (non-technical)
**Budget:** $1,600 fixed this round ("basic-but-real AI + full MVP"); more depending on performance.

This spec is the agreed design for the paid v1 build. It was produced by walking the full
decision tree in a brainstorming + grill session. The companion docs `docs/OWNER-GUIDE.md`
(non-technical) and `docs/BUILD-LOG.md` (running record) are maintained alongside it.

---

## 1. Goal

Turn the existing static demo into a **real, owned, monetizable product**: an AI engine that
matches a student to **real, verified internships**, with working payments — all on the
existing site design, fully transferred to Dillon at the end.

## 2. Hard constraints

- **Design freeze (Dillon's rule):** do NOT change the front-end design or structure unless it's
  actively glitchy. Only allowed visible changes: the rebrand (logo + name) and bug fixes. Every
  new feature slots into the **existing UI** (cards, results section, etc.).
- **Stay on Netlify** (static hosting + serverless Functions + env vars + SSL + auto-deploy).
- **All accounts in Dillon's name** (GitHub, Netlify, GoDaddy, Stripe, Anthropic).
- **AI provider:** Claude (Haiku model) for cost + structured-output reliability.
- **Fixed scope.** The chat advisor is the only flexible item (stretch).

## 3. Architecture

```
Browser (existing static site, unchanged design)
   │  form profile / buy clicks
   ▼
Netlify Functions (Node; secret keys server-side)
   ├─ match        → pre-filters internships.json → Claude (Haiku) scores/explains → JSON
   ├─ chat (stretch)
   ├─ create-checkout-session → Stripe
   └─ verify-unlock → Stripe (confirm paid) → HMAC-signed token
   │
   ├─ internships.json  (real, verified dataset, committed to repo)
   ├─ Anthropic API  (Claude Haiku)
   └─ Stripe API
```

Runtime is cheap and simple: a static page calling small functions; the dataset is a local
committed file (no live job-feed in v1).

## 4. Internship dataset

- **Cycle:** target **what's findable today** (rolling/year-round + off-cycle + any early
  Fall-2026 / Summer-2027 listings). Tag each with `term` + `last_verified`. Accept a modest pool
  now; richer after a fall refresh.
- **Coverage:** all **8 industries** (Finance, Technology, Marketing, Consulting, Healthcare,
  Sports Business, Media & Entertainment, Real Estate). Deeper focus on **Finance, Technology,
  Consulting** (highest demand). Target ~**10/industry** to start; **quality over quota** — never
  pad. Thin industries supplemented with strong real remote/rolling cross-over roles.
- **Schema per listing:** `company, role, industry, location, work_type, short_description,
  required_skills[], application_url, source_url, term, date_posted?, last_verified`.
- **Anti-hallucination rule (non-negotiable):** a listing exists only if it has a real
  `application_url` that is **programmatically verified to return a live listing page** (not
  404/homepage). Unverifiable → dropped, never guessed. The matcher AI is only ever handed
  verified entries; it scores/explains, never invents.
- **Build pipeline (build-time, not runtime) — a repeatable orchestrated workflow:**
  1. **Researcher** (one per industry, parallel) — web-search + fetch real postings, extract schema.
  2. **Verifier** (adversarial, independent) — confirm each URL is live + matches its source;
     reject when unsure.
  3. **Curator** — dedupe, normalize into `internships.json`, check coverage, **loop back** to
     re-research thin industries up to a cap, then log honestly whatever it couldn't fill.
- **Refresh:** re-run the workflow periodically. Since Dillon is non-technical, refreshes are a
  "Jack/Claude re-runs the pipeline" task, documented in the Owner's Guide.

## 5. Matcher (runtime)

- **Input:** form fields only (resume upload stays cosmetic; parsing deferred to Phase 2).
- **Flow:** hard-filter dataset by chosen industry (remote pref → include all remote); rank by
  location/work-type fit; pass **top ~15** real listings to Claude Haiku, which returns, per match:
  `match_score (0-100), why, missing_skills[], application_tip, outreach_message`. Attach the real
  `company/role/location/work_type/application_url` from the dataset. Render into the **existing
  card UI** unchanged.
- **Scoring:** AI sets `match_score`; keep a small deterministic nudge for exact location/remote
  match (consistency).
- **Gating:** Free = top 3 by score; Premium = all returned (up to 10).
- **"Apply Now"** → opens the real external `application_url` in a new tab (makes the currently-dead
  button real).
- **Thin/empty fallback:** if an industry has <3 listings, score what exists + fold in strong real
  cross-industry remote/rolling roles so results never look empty.

## 6. Reliability, cost & abuse

- **Loading state:** spinner + "Analyzing your profile against N internships…" inside the existing
  (hidden-until-submit) results section — a state of an existing component, not a design change.
- **Graceful degradation (no hard-fail):** if the AI call errors/times out, fall back to a
  **deterministic ranking** of the same real pre-filtered listings with generic "why" text. The
  student always gets real, clickable matches; the site never shows an error wall.
- **Cost controls:** (1) **$50/mo hard spend cap** in the Anthropic console (the backstop);
  (2) **per-IP rate limit** ~5/min, ~30/day via Netlify Blobs; (3) request-size + output-token
  caps + Haiku; (4) optional short-TTL result cache keyed by profile hash. **No CAPTCHA** (design
  freeze + friction; the cap makes it unnecessary).

## 7. Payments & premium

- **Free vs Premium:** Free = top 3 matches + one-line why. Premium = all ~10 matches, full
  reasoning + skill-gap analysis, AI outreach messages, resume tips, and the chat advisor (if built).
- **Mechanism:** **Stripe Checkout Sessions** (created by a serverless function — needed so the
  payment is server-verifiable). Flow: click buy → function creates session → Stripe-hosted
  checkout → redirect to `/success?session_id=…` → `verify-unlock` function confirms session is
  **paid** → returns an **HMAC-signed unlock token** → browser stores it (localStorage) → premium
  unlocks. Signed token = the success URL can't be forged.
- **Products (both kept from the existing pricing page):**
  - **$9.99 "Unlock Premium"** — one-time in v1; unlocks all premium features for that browser.
  - **$29 "Match Report"** — full premium results as a **polished printable page → Save as PDF**
    (no email infra in v1); also flips on the unlock.
- **Money → Dillon's Stripe → his bank.** Built entirely in **Stripe test mode**; swap to live keys
  at handoff.
- **Honest limits:** unlock is **per-browser** (clears on new device / cleared storage); a determined
  techie could bypass it. True enforcement = the accounts/subscriptions phase (Phase 2).

## 8. Chat advisor — STRETCH (not committed scope)

Built only if Milestones 1–4 land comfortably within budget; otherwise rolls to Phase 2.
- **UI:** a floating chat bubble (an addition, design-freeze safe — not a new section).
- **Behavior:** Claude with the student's form profile (+ match results) as context — answers
  internship/career questions, writes outreach, gives resume tips. Same backend pattern; conversation
  length capped; counts against the $50 cap. **Premium-gated** (free users see it, prompted to unlock).

## 9. Rebrand

- Wire in the provided logo (`intern nest logo.png` → renamed web-safe) in header + footer; add a
  favicon from it.
- Find-and-replace all "InternPilot" → "InternNest" (title, wordmark, meta description, footer).
- **Rename the GitHub repo** `internpilot-ai` → `internnest` (GitHub redirects the old URL; Netlify
  link survives).
- Keep the decorative hero cards as-is. **Leave the "10,000+ internships tracked" line for now**;
  revisit after the big scrape (known item — flip it to a truthful value once the dataset grows).

## 10. Build workflow & environment

- **Local development with `netlify dev`** (serves the site AND runs the functions locally with env
  vars — plain `localhost`/file-open won't run the matcher/Stripe). Test locally → **push to `main`
  only when a feature is tested + ready** (push to main = deploy to live internnest.ai; near-zero
  traffic makes this safe). Spin a preview branch only for anything risky.
- **Secrets** in a gitignored `.env` locally + Netlify env settings in production; never committed.
  Add `.env` to `.gitignore`.
- **Env vars:** `ANTHROPIC_API_KEY`, `STRIPE_SECRET_KEY`, `STRIPE_PRICE_UNLOCK`,
  `STRIPE_PRICE_REPORT`, `UNLOCK_SIGNING_SECRET`.

## 11. Milestones & acceptance criteria (build order)

1. **Rebrand** — *Done:* site reads InternNest (logo/favicon/text), repo renamed, nothing else changed.
2. **Dataset** — *Done:* `internships.json` committed, ~10/industry (deeper on Fin/Tech/Consulting),
   every URL verified live.
3. **Matcher** — *Done:* real matches render for all 8 industries, "Apply Now" → real listing,
   loading + graceful fallback + rate limit/caps working.
4. **Payments** — *Done:* test-mode purchase unlocks premium and generates the $29 report; free/premium
   gating correct.
5. **Handoff** — *Done:* all accounts in Dillon's name, live keys swapped in, Owner's Guide + lessons
   delivered.
- **Chat advisor** = stretch, only after #4 if budget remains.
- Each milestone is tested locally before being merged to live.

## 12. Out of scope for v1 → Phase 2 backlog (noted for later)

Recorded so it isn't lost; explicitly **not** in this round:
- Real user accounts / login
- Enforced recurring subscriptions (true monthly billing)
- Resume upload parsing → feed into matcher
- Live job-board feed / large-scale real-time data
- Email delivery (e.g., emailing the match report)
- Server-generated PDF (vs browser "Save as PDF")
- Admin dashboard
- SEO / marketing
- Analytics (traffic insights for Dillon)
- Bigger / scheduled auto-refreshed dataset
- Provider A/B or switch (Claude ↔ Gemini)

## 13. Ownership & handoff

- Transfer to Dillon: GitHub repo, Netlify site, GoDaddy domain, Stripe account, Anthropic account.
- Maintain `OWNER-GUIDE.md` + `BUILD-LOG.md` throughout; deliver maintenance lessons; swap Stripe +
  Anthropic to live keys; confirm Dillon holds every login.

## 14. Engagement

$1,600 fixed this round (basic-but-real AI + full MVP); more depending on performance. Jack =
contractor for Dillon; full ownership transfer + lessons included.
