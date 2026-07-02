# InternNest funnel reformat — design

**Date:** 2026-07-02
**Status:** Approved by Jack (relaying Dillon's site walkthrough)
**Goal:** Reformat the site so a higher percentage of visitors flow into the Get Matched
algorithm (and from there to the paid unlock). Not a visual rebuild — the Liquid Glass v3
theme and current color palette stay exactly as they are.

## Constraints

- **Keep the Liquid Glass theme and coloring.** No palette swap, no new theme. The only
  color addition is a subtle violet accent (used in the hero glow gradient and the new
  logo wordmark) so the purple logo text has something to tie into. Blue stays primary.
- **Copy voice: concise and direct.** No AI-flavored phrasing. Kill constructions like
  "from blank resume to best-fit matches," stacked reassurances ("no subscriptions, no
  surprises"), and rule-of-three filler. Short sentences that say one thing.
- No new pages, no new dependencies. All work fits in existing files plus one new SVG
  logo asset.
- "Get Matched" keeps its name (decided against "The Algorithm" rename).

## Workstreams

### 1. Hero (index.html + styles.css)

- Headline becomes one line: **"Find Your Dream Internship"** (drop "with AI").
- Pull the hero up: `.hero` top padding 90px → ~48px, bottom 100px → ~72px; the
  absolutely-positioned side widgets (`.hv-main` Stripe card, Google card, outreach card)
  shift up to match.
- Replace the two hero CTA buttons with a **glass mini-form card**: three inputs —
  Major, Grad year (select), Dream role — and one "Get Matched →" submit button.
  A small "See how it works" text link sits under the card.
- On submit: write `inn_prefill` to localStorage as JSON `{major, gradYear, goal}` and
  navigate to `/get-matched`.
- Hero stats row stays, tightened.

### 2. Get Matched page (get-matched/index.html + script.js)

- On load, read and clear `inn_prefill`; pre-fill the matching form fields so hero
  visitors arrive with the form already started.
- Algorithm feel, light touch: header strip with the live dataset count
  ("Scoring you against N verified internships" — N computed from the actual internships
  data at build/load, since the site currently shows conflicting counts) and a subtle
  scan/pulse animation on the existing loading state. No structural rebuild.

### 3. Tracker add form (tracker/index.html + script.js + styles.css)

- Replace `promptAddCard()`'s double `prompt()` with a glass **modal**:
  Role title* · Company* · Link (optional) · Stage select (default Saved) ·
  Notes (optional).
- Card model extends from `{id, title, company, stage, score}` to also carry
  `{link, notes}`.
- Excel export: wire `notes` into the existing empty Notes column; add a Link column.
- Add-only for now (no edit-card flow — out of scope).

### 4. Pricing (pricing/index.html + index.html + styles.css)

- `.price-card` becomes a flex column: feature lists stretch, CTAs pin to a shared
  bottom line, price rows (strike $19.99 + $9.99 + launch chip) no longer wrap unevenly.
- **Sync the home page pricing section to /pricing's current copy** — the home copy is
  stale ("Up to 5 matches", no launch price) and contradicts /pricing ("top 3 matches",
  strike-through anchor).

### 5. Logged-in nav state (script.js)

- When a Supabase session exists, `renderAuthNav()` also swaps every "Start Free →"
  (desktop `.nav-cta` and the mobile-menu button) to "Get Matched →". No "Start Free"
  anywhere for signed-in users. Works on all pages since the nav is identical everywhere.

### 6. Logo (new SVG asset, all pages)

- Rebuild `internnest-logo-h.png` as an SVG: nest mark untouched, "InternNest" wordmark
  in a purplish tone that matches the new violet accent.
- Inspect the current PNG first to reproduce the mark faithfully.
- Swap the `<img>` reference on all pages; keep PNG as favicon fallback.

### 7. Copy pass (all pages)

- Sweep every page for AI-phrasing and tighten: heroes, section subs, pricing FAQ,
  blog teasers, about/careers/contact. Concise, direct, one idea per sentence.
- Run with the humanizer guidance (Wikipedia "signs of AI writing" patterns).

## Execution notes

- Order: funnel first (1, 2, 5) → tracker (3) → pricing (4) → copy pass (7) → logo (6).
- Core workstreams run sequentially in the main session — they all touch the shared
  styles.css / script.js / index.html and would conflict if parallelized.
- Copy pass on secondary pages and logo SVG generation are delegated to Sonnet
  subagents (independent files, mechanical work).
- Verify with the local preview: screenshots of hero (desktop + mobile), tracker modal
  open, pricing alignment, and logged-in nav state.

## Acceptance criteria

- Hero fits with widgets visible without scrolling on a 1280×800 laptop; headline is
  the single line "Find Your Dream Internship".
- Filling the hero mini-form lands on /get-matched with the three fields pre-filled.
- "Add internship" opens a styled modal; saved cards keep link/notes; export includes them.
- The three pricing cards' buttons sit on one baseline at desktop width; home and
  /pricing show identical plan copy.
- Signed-in users see no "Start Free" anywhere.
- Logo wordmark is purplish, matches the site, and renders crisply (SVG).
- No page copy contains the swept AI-phrasing patterns.
