# InternNest Funnel Reformat Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reformat the site so more visitors flow into the Get Matched form — hero mini-form, real tracker add-form, aligned pricing, auth-aware CTAs, tightened copy, purple logo wordmark.

**Architecture:** Static multi-page site; one shared `styles.css` (Liquid Glass theme layered at line ~877 with `!important` overrides) and one shared `script.js` (browser globals, no bundler). All pages share identical nav markup. New UI reuses existing patterns: the glass card selector list (styles.css ~line 921) and the login-modal pattern (`.login-overlay`/`.login-card`).

**Tech Stack:** Vanilla HTML/CSS/JS, localStorage, Supabase auth (already wired), Python3/PIL for the one image crop.

**Spec:** `docs/superpowers/specs/2026-07-02-internnest-funnel-reformat-design.md`

## Global Constraints

- **Liquid Glass theme and coloring stay exactly as-is.** Accents: `--glass-accent: #5b4bff`, `--glass-accent-2: #7c5bff`, `--glass-ink: #1c1746`. No palette changes; new elements reuse these tokens.
- **Copy voice: concise and direct.** No "from X to Y" constructions, no stacked reassurances ("no subscriptions, no surprises"), no rule-of-three filler. One idea per sentence.
- **No new pages, no new dependencies.**
- "Get Matched" keeps its name everywhere.
- **Testing:** `script.js` is browser-global code with no unit harness — every task verifies through the local preview server (config in `.claude/launch.json`) with exact expected observations. Do not add a test framework.
- Commit after each task with the message given in its final step.

---

### Task 1: Hero reformat + mini-form

**Files:**
- Modify: `index.html` (hero section, ~lines 56–100)
- Modify: `styles.css` (`.hero` at line 233, glass selector list at ~line 921, new `.hero-mini` rules)
- Modify: `script.js` (new submit handler, near the matchForm handler at line 334)

**Interfaces:**
- Produces: localStorage key `inn_prefill` = JSON `{major, year, role}` (string values; `year` is one of "Freshman"/"Sophomore"/"Junior"/"Senior" or ""). Task 2 consumes it.

- [ ] **Step 1: Replace the hero headline and actions in `index.html`**

Find the current block:

```html
<h1>Find Your Dream<br>Internship with AI</h1>
```

Replace with:

```html
<h1>Find Your Dream<br>Internship</h1>
```

Find the `.hero-actions` block:

```html
<div class="hero-actions">
  <a href="/get-matched" class="btn-primary btn-xl">Find Internships</a>
  <a href="/how-it-works" class="btn-ghost btn-xl">See How It Works →</a>
</div>
```

Replace with the mini-form (three fields mirror the Get Matched form's `#major`, `#year`, `#role`):

```html
<form id="heroMiniForm" class="hero-mini" autocomplete="off">
  <div class="hero-mini-fields">
    <div class="hero-mini-group">
      <label for="hmMajor">Major</label>
      <input type="text" id="hmMajor" placeholder="e.g. Finance" />
    </div>
    <div class="hero-mini-group">
      <label for="hmYear">Class year</label>
      <select id="hmYear">
        <option value="">Select</option>
        <option>Freshman</option><option>Sophomore</option>
        <option>Junior</option><option>Senior</option>
      </select>
    </div>
    <div class="hero-mini-group">
      <label for="hmRole">Dream role</label>
      <input type="text" id="hmRole" placeholder="e.g. IB Analyst" />
    </div>
  </div>
  <button type="submit" class="btn-primary btn-xl hero-mini-btn">Get Matched →</button>
  <a href="/how-it-works" class="hero-mini-link">See how it works</a>
</form>
```

Also tighten the hero sub copy (copy voice). Replace:

```html
<p class="hero-sub">Fill out your goals, major, and skills. InternNest finds your best-fit internships, scores each match, and helps you land the role with tailored resume tips and outreach messages.</p>
```

with:

```html
<p class="hero-sub">Tell us your major and goals. Our AI scores real internships against your profile and shows you exactly where you fit.</p>
```

- [ ] **Step 2: Pull the hero up and style the mini-form in `styles.css`**

At line 233, change `.hero` padding from `90px 5% 100px` to `48px 5% 72px`.

In the Hero Visual block (~line 286), tighten the widget cluster:
- `.hero-visual { height: 400px; }` (was 420px)
- `.hv-side-1 { top: 215px; ... }` (was 240px)
- `.hv-side-2 { top: 315px; ... }` (was 340px)

Add after the `.hero-stats` rules (~line 283):

```css
/* Hero mini-form — starts the Get Matched flow from the homepage */
.hero-mini { display: flex; flex-direction: column; gap: 12px; padding: 20px; border-radius: var(--radius-lg); max-width: 540px; margin-bottom: 28px; }
.hero-mini-fields { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 10px; }
.hero-mini-group { display: flex; flex-direction: column; gap: 4px; }
.hero-mini-group label { font-size: 12px; font-weight: 700; color: var(--gray-700); }
.hero-mini input, .hero-mini select { padding: 10px 12px; border-radius: 10px; border: 1px solid rgba(255,255,255,.65); background: rgba(255,255,255,.55); font: inherit; font-size: 14px; color: var(--glass-ink); }
.hero-mini input:focus, .hero-mini select:focus { outline: 2px solid var(--glass-accent); outline-offset: 0; }
.hero-mini-btn { width: 100%; justify-content: center; }
.hero-mini-link { font-size: 14px; color: var(--gray-700); text-align: center; text-decoration: none; }
.hero-mini-link:hover { color: var(--glass-accent); }
```

In the responsive rules: inside the existing `@media (max-width: 768px)` block add `.hero-mini-fields { grid-template-columns: 1fr; }` and `.hero-mini input, .hero-mini select { font-size: 16px; }` (iOS no-zoom, matching the existing form-card rule).

Then add `.hero-mini` to the Liquid Glass card selector list at ~line 921 so it gets the glass treatment — the list currently ends `..., .contact-card, .hv-card, .hv-main, .hv-side {`; append `, .hero-mini` before the `{`. **Check the list appears twice** (background block and any hover/secondary block) — `grep -n 'hv-side' styles.css` and add `.hero-mini` to every selector list that includes `.hv-side`.

- [ ] **Step 3: Add the submit handler in `script.js`**

Directly above the `matchFormEl` block at line 334, add:

```js
/* Hero mini-form: stash the answers and continue on /get-matched (Task: funnel) */
const heroMiniEl = document.getElementById('heroMiniForm');
if (heroMiniEl) heroMiniEl.addEventListener('submit', (e) => {
  e.preventDefault();
  const prefill = {
    major: document.getElementById('hmMajor').value.trim(),
    year:  document.getElementById('hmYear').value,
    role:  document.getElementById('hmRole').value.trim(),
  };
  try { localStorage.setItem('inn_prefill', JSON.stringify(prefill)); } catch (err) { /* storage off — still navigate */ }
  window.location.href = '/get-matched';
});
```

- [ ] **Step 4: Verify in the preview**

Start the server from `.claude/launch.json` (preview_start). Then:
- `preview_snapshot` on `/`: h1 reads "Find Your Dream Internship" (no "with AI"); mini-form present with 3 fields + "Get Matched →" button; no `.hero-actions` buttons.
- `preview_fill` `#hmMajor` = "Finance", `#hmYear` = "Junior", `#hmRole` = "IB Analyst"; `preview_click` the submit button.
- Expected: navigation to `/get-matched`; `preview_eval` `localStorage.getItem('inn_prefill')` returns the JSON (Task 2 will consume+clear it — at this point it persists).
- `preview_screenshot` desktop; `preview_resize` mobile + screenshot: fields stack vertically, no horizontal scroll.

- [ ] **Step 5: Commit**

```bash
git add index.html styles.css script.js
git commit -m "feat(hero): one-line headline + glass mini-form that starts Get Matched"
```

---

### Task 2: Get Matched prefill + algorithm strip

**Files:**
- Modify: `get-matched/index.html` (section-header)
- Modify: `script.js` (prefill reader; scanning class toggles around line 361 and in `renderResults`)
- Modify: `styles.css` (`.algo-strip`, scanning animation)

**Interfaces:**
- Consumes: localStorage `inn_prefill` = JSON `{major, year, role}` from Task 1. Reads then removes the key.
- Consumes existing DOM ids on get-matched: `#matchForm`, `#major`, `#year`, `#role`, `#results`, `#resultsHeading`.

- [ ] **Step 1: Get the real dataset count**

Run: `python3 -c "import json;print(len(json.load(open('internships.json'))))"` (repo root — note the file is at the root, not `data/`).
Expected: ~1789. Round DOWN to the nearest hundred for copy → "1,700+". Use the rounded figure in the next step (recompute; don't blindly copy 1,700+ if the data grew).

- [ ] **Step 2: Add the algorithm strip in `get-matched/index.html`**

Inside the form section's `.section-header`, after the `<p class="section-sub">…</p>` line, add (with N from Step 1):

```html
<div class="algo-strip"><span class="badge-pulse"></span>Scoring you against <strong>1,700+ verified internships</strong>, updated weekly</div>
```

Also tighten the header copy. Replace `<p class="section-sub">The more detail you add, the smarter your matches will be.</p>` with `<p class="section-sub">More detail means better matches.</p>`.

- [ ] **Step 3: Add prefill + scanning to `script.js`**

Directly below the hero mini-form handler from Task 1, add:

```js
/* Arriving from the hero mini-form: pre-fill and clear the stash */
(function applyHeroPrefill() {
  if (!document.getElementById('matchForm')) return;
  let raw = null;
  try { raw = localStorage.getItem('inn_prefill'); localStorage.removeItem('inn_prefill'); } catch (err) { return; }
  if (!raw) return;
  try {
    const p = JSON.parse(raw);
    if (p.major) document.getElementById('major').value = p.major;
    if (p.year)  document.getElementById('year').value  = p.year;
    if (p.role)  document.getElementById('role').value  = p.role;
  } catch (err) { /* malformed stash — ignore */ }
})();
```

In the matchForm submit handler (~line 361), right after `const section = document.getElementById('results');` add:

```js
section.classList.add('scanning');
```

Find `function renderResults(` and add as its first line:

```js
const resSection = document.getElementById('results'); if (resSection) resSection.classList.remove('scanning');
```

Also search the submit handler for its error path (catch/finally around the fetch to `/api/match`) and add the same `classList.remove('scanning')` there so a failed request doesn't pulse forever.

- [ ] **Step 4: Style strip + scanning in `styles.css`**

Add near the FORM section (~line 400):

```css
/* Get Matched: live-dataset strip + scanning pulse while the algorithm runs */
.algo-strip { display: flex; align-items: center; justify-content: center; gap: 8px; font-size: 14px; font-weight: 600; color: var(--gray-700); margin-top: 14px; }
.algo-strip strong { color: var(--glass-accent); }
#results.scanning .section-header h2 { animation: algoPulse 1.2s ease-in-out infinite; }
@keyframes algoPulse { 0%, 100% { opacity: 1; } 50% { opacity: .55; } }
@media (prefers-reduced-motion: reduce) { #results.scanning .section-header h2 { animation: none; } }
```

(`.badge-pulse` already exists — reused as-is.)

- [ ] **Step 5: Verify in the preview**

- On `/`, fill the mini-form (Major "Finance", Year "Junior", Role "IB Analyst"), submit.
- `preview_snapshot` on the resulting `/get-matched`: `#major` value "Finance", `#year` "Junior", `#role` "IB Analyst"; algo strip visible with the count.
- `preview_eval` `localStorage.getItem('inn_prefill')` → `null` (consumed).
- Reload `/get-matched` directly: fields empty (no stale prefill), no console errors (`preview_console_logs` level error).

- [ ] **Step 6: Commit**

```bash
git add get-matched/index.html script.js styles.css
git commit -m "feat(get-matched): hero prefill + live dataset strip + scanning pulse"
```

---

### Task 3: Logged-in CTA swap

**Files:**
- Modify: `script.js` (`renderAuthNav()`, line ~780)

**Interfaces:**
- Consumes: global `authUser` (set by `initAuth`), existing `.nav-cta` anchors and the mobile-menu `.btn-primary`.
- Produces: signed-in users see "Get Matched →" instead of "Start Free →" everywhere; signed-out users see "Start Free →" (restored on sign-out without reload).

- [ ] **Step 1: Extend `renderAuthNav()`**

`renderAuthNav()` already grabs `const mm = document.getElementById('mobileMenu');`. At the end of the function (after the mobile-menu `if (mm) { ... }` block), add:

```js
  // Signed-in users never see "Start Free" — the CTA reads Get Matched instead.
  const ctaText = authUser ? 'Get Matched →' : 'Start Free →';
  document.querySelectorAll('.nav-cta').forEach((a) => { a.textContent = ctaText; });
  if (mm) { const mmCta = mm.querySelector('.btn-primary'); if (mmCta) mmCta.textContent = ctaText; }
```

(No href change needed — both CTAs already link to `/get-matched`.)

- [ ] **Step 2: Verify in the preview**

Auth needs a real Supabase session; simulate instead:
- `preview_eval`: `authUser = { email: 'test@x.com' }; renderAuthNav(); document.querySelector('.nav-cta').textContent` → Expected `"Get Matched →"`.
- `preview_eval`: `authUser = null; renderAuthNav(); document.querySelector('.nav-cta').textContent` → Expected `"Start Free →"`.
- Check the mobile menu the same way via `document.querySelector('#mobileMenu .btn-primary').textContent`.

- [ ] **Step 3: Commit**

```bash
git add script.js
git commit -m "feat(nav): swap Start Free CTA to Get Matched for signed-in users"
```

---

### Task 4: Tracker add modal

**Files:**
- Modify: `tracker/index.html` (the add button's onclick)
- Modify: `script.js` (replace `promptAddCard()` at line 602; extend `buildTrackerCard` and `exportTrackerToExcel`)
- Modify: `styles.css` (`.add-card-modal` sizing)

**Interfaces:**
- Consumes: existing globals `trackerCards`, `cardCounter`, `clearDemoCards()`, `saveTracker()`, `renderTracker()`, `STAGES`, and the `.login-overlay`/`.login-card` CSS.
- Produces: `openAddCard()` / `closeAddCard()` globals (the button calls `openAddCard()`); card model gains optional `link` and `notes` string fields; export gains Link + Notes values. Old cards without those fields must keep working (`c.link || ''`).

- [ ] **Step 1: Replace `promptAddCard()` in `script.js`**

Delete the whole `promptAddCard` function (lines 602–611) and add in its place:

```js
function escHtml(s) {
  return String(s == null ? '' : s).replace(/[&<>"']/g, (ch) => (
    { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]
  ));
}

function openAddCard() {
  let m = document.getElementById('addCardModal');
  if (!m) {
    m = document.createElement('div');
    m.id = 'addCardModal';
    m.className = 'login-overlay';
    m.innerHTML = `
      <div class="login-card add-card-modal" role="dialog" aria-modal="true">
        <button class="login-close" onclick="closeAddCard();return false;" aria-label="Close">&times;</button>
        <h3>Add an internship</h3>
        <form id="addCardForm">
          <div class="form-group"><label for="acTitle">Role title <span class="req">*</span></label><input type="text" id="acTitle" required placeholder="e.g. Software Engineering Intern" /></div>
          <div class="form-group"><label for="acCompany">Company <span class="req">*</span></label><input type="text" id="acCompany" required placeholder="e.g. Stripe" /></div>
          <div class="form-group"><label for="acLink">Listing link <span class="form-opt">(optional)</span></label><input type="url" id="acLink" placeholder="https://" /></div>
          <div class="form-group"><label for="acStage">Stage</label><select id="acStage"><option value="saved">Saved</option><option value="applied">Applied</option><option value="interviewing">Interviewing</option><option value="offer">Offer</option><option value="rejected">Rejected</option></select></div>
          <div class="form-group"><label for="acNotes">Notes <span class="form-opt">(optional)</span></label><textarea id="acNotes" rows="2" placeholder="Deadline, contact, next step"></textarea></div>
          <button type="submit" class="btn-primary">Add to tracker</button>
        </form>
      </div>`;
    document.body.appendChild(m);
    m.addEventListener('click', (e) => { if (e.target === m) closeAddCard(); });
    document.getElementById('addCardForm').addEventListener('submit', (e) => {
      e.preventDefault();
      const title = document.getElementById('acTitle').value.trim();
      const company = document.getElementById('acCompany').value.trim();
      if (!title || !company) return;
      clearDemoCards();
      trackerCards.push({
        id: `c-${cardCounter++}`, title, company,
        stage: document.getElementById('acStage').value, score: 0,
        link: document.getElementById('acLink').value.trim(),
        notes: document.getElementById('acNotes').value.trim(),
      });
      saveTracker();
      renderTracker();
      document.getElementById('addCardForm').reset();
      closeAddCard();
    });
  }
  m.classList.remove('hidden');
  document.getElementById('acTitle').focus();
}

function closeAddCard() {
  const m = document.getElementById('addCardModal');
  if (m) m.classList.add('hidden');
}
```

- [ ] **Step 2: Point the button at the modal**

In `tracker/index.html`, change `onclick="promptAddCard()"` to `onclick="openAddCard()"` on the `.add-card-btn`. Run `grep -rn 'promptAddCard' --include='*.html' .` to catch any other callers (expected: only tracker).

- [ ] **Step 3: Show link/notes on cards — `buildTrackerCard`**

In `buildTrackerCard` (script.js ~line 555), replace the `.tracker-card-top` inner block:

```js
  const linkIcon = card.link ? ` <a href="${escHtml(card.link)}" target="_blank" rel="noopener" class="tracker-link" title="Open listing" onclick="event.stopPropagation()">&#8599;</a>` : '';
  const notesLine = card.notes ? `<div class="tracker-notes">${escHtml(card.notes)}</div>` : '';
```

and use them in the returned template — company line becomes:

```html
<div class="tracker-company">${escHtml(card.company)}${linkIcon}</div>
```

with `${notesLine}` inserted directly after the closing `</div>` of `.tracker-card-top`. Also wrap the existing `${card.title}` interpolation as `${escHtml(card.title)}`.

- [ ] **Step 4: Export link + notes**

In `exportTrackerToExcel` (~line 618), change:

```js
const header = ['Company', 'Role', 'Stage', 'Match Score', 'Link', 'Notes'];
const rows = trackerCards.map(c => [
  c.company, c.title, capitalize(c.stage), c.score > 0 ? c.score + '%' : '', c.link || '', c.notes || '',
]);
```

- [ ] **Step 5: Modal + card CSS**

Add to `styles.css` near the tracker rules:

```css
/* Tracker add-internship modal (reuses the login overlay/card glass) */
.add-card-modal { max-width: 460px; width: 100%; text-align: left; }
.add-card-modal .form-group { margin-bottom: 14px; display: flex; flex-direction: column; gap: 5px; }
.add-card-modal label { font-size: 13px; font-weight: 700; }
.add-card-modal input, .add-card-modal select, .add-card-modal textarea { padding: 10px 12px; border-radius: 10px; border: 1px solid var(--gray-300); font: inherit; font-size: 14px; }
.add-card-modal .btn-primary { width: 100%; justify-content: center; }
.tracker-link { color: var(--glass-accent); text-decoration: none; font-weight: 800; }
.tracker-notes { font-size: 12.5px; color: var(--gray-500); margin-top: 6px; line-height: 1.45; }
```

- [ ] **Step 6: Verify in the preview**

- `/tracker` → `preview_click` "+ Add internship" → `preview_snapshot`: modal with 5 fields, no browser prompt.
- Fill title "Test Intern", company "Acme", link "https://example.com", notes "call recruiter"; submit.
- Expected: modal closes; card in Saved column shows title, company, ↗ link, notes line; `preview_eval` `JSON.parse(localStorage.getItem('inn_tracker')||'[]')` (check the actual storage key used by `saveTracker` first) includes `link` and `notes`.
- Reload page: card persists. Click Export to Excel → no error (CSV includes Link and Notes columns).
- Old-card compatibility: `preview_eval` push a card without link/notes, `renderTracker()` → renders without "undefined" anywhere.

- [ ] **Step 7: Commit**

```bash
git add tracker/index.html script.js styles.css
git commit -m "feat(tracker): real add-internship modal with link/notes, wired into export"
```

---

### Task 5: Pricing alignment + home sync

**Files:**
- Modify: `styles.css` (price-card internals)
- Modify: `pricing/index.html` (note position, copy tightening)
- Modify: `index.html` (replace stale pricing section)

**Interfaces:**
- Consumes: `.pricing-grid`/`.price-card` CSS from styles.css lines 658–705 (already flex-column with `margin-top:auto` buttons — the misalignment comes from the price-row wrapping and the `.plan-note` sitting *below* the featured card's button).

- [ ] **Step 1: CSS — stop the wobble**

In styles.css pricing rules (~line 696), update:

```css
.plan-price-row { display: flex; align-items: baseline; gap: 6px; flex-wrap: wrap; min-height: 52px; }
.launch-chip { white-space: nowrap; }
.plan-note { font-size: 12.5px; color: var(--gray-500); margin: 0; }
```

(Keep existing `.plan-amount`, `.plan-strike`, etc. — check their current definitions with `grep -n 'plan-strike\|launch-chip' styles.css` and only add what's missing.)

- [ ] **Step 2: HTML — button is always the last element**

In `pricing/index.html`, in the Premium card move `<p class="plan-note">…</p>` to sit *above* the `<a class="btn-primary">` line, and tighten it to: `Secure Stripe checkout. 14-day make-it-right guarantee.` With buttons last + `margin-top: auto`, all three CTAs share the bottom line.

Tighten the page-hero sub (copy voice). Replace:

```html
<p class="page-hero-sub">Start free on more than two thousand verified internships. Upgrade once when you are ready to go all-in on landing the offer. No subscriptions, no surprises.</p>
```

with (N = Task 2 Step 1 figure):

```html
<p class="page-hero-sub">Start free on 1,700+ verified internships. Upgrade once — one payment, no subscription.</p>
```

- [ ] **Step 3: Sync the home pricing section**

In `index.html`, replace the three `.price-card` divs inside `<section id="pricing">` with the exact three cards from `pricing/index.html` (post-Step-2 markup: Free "top 3 matches" list, Premium with strike $19.99 → $9.99 + launch chip + note above button, $29 Match Report). Keep the section-header, but replace its sub with `<p class="section-sub">Start free. One payment unlocks everything.</p>`.

- [ ] **Step 4: Verify in the preview**

- `/pricing` desktop `preview_screenshot`: three CTAs on one baseline (featured card intentionally floats 8px higher as a whole — that's the design; buttons align *within* each card's bottom edge).
- `preview_inspect` each `.price-card .btn-primary, .price-card .btn-outline` bounding boxes: bottom offsets within each card equal.
- `/` pricing section matches `/pricing` copy exactly (diff the feature `<li>` texts by eye in `preview_snapshot`).
- Mobile (`preview_resize`): cards stack, no wrap glitches in the price row.

- [ ] **Step 5: Commit**

```bash
git add styles.css pricing/index.html index.html
git commit -m "fix(pricing): baseline-aligned cards + home section synced to /pricing"
```

---

### Task 6: Copy pass on secondary pages (Sonnet subagents)

**Files:**
- Modify: `about/index.html`, `careers/index.html`, `contact/index.html`, `how-it-works/index.html`, `blog/index.html`, `blog/land-your-first-internship/index.html`, `blog/resume-tips-for-internships/index.html`, `blog/cold-outreach-that-gets-replies/index.html`
- Do NOT touch: `privacy/`, `terms/`, `cookies/` (legal tone stays), `docs/owner-guide.html` (internal), `404.html` copy is fine.

**Interfaces:** none — text-only edits, no markup/structure/class changes.

- [ ] **Step 1: Dispatch two parallel Sonnet subagents** (they touch disjoint files):
  - Agent A: about, careers, contact, how-it-works
  - Agent B: blog index + 3 posts

Each agent's prompt must include: the file list; "edit visible copy only — headlines, subs, paragraphs, CTA labels; never change tags, classes, ids, or attributes"; the voice rules verbatim ("concise and direct; no 'from X to Y' constructions e.g. 'from blank resume to best-fit matches'; no stacked reassurances e.g. 'no subscriptions, no surprises'; no rule-of-three filler; no em-dash chains; one idea per sentence"); and "keep factual claims unchanged (prices, counts, product behavior); return a list of every string changed (before → after)".

- [ ] **Step 2: Review the diffs**

`git diff --stat` then read the before→after lists from both agents. Reject any edit that changed markup or facts. Spot-check pages in the preview for layout breaks (long headlines shrinking, etc.).

- [ ] **Step 3: Commit**

```bash
git add about careers contact how-it-works blog
git commit -m "style(copy): concise direct voice across secondary pages"
```

---

### Task 7: Logo refresh — purple wordmark

**Files:**
- Create: `internnest-mark.png` (cropped nest mark)
- Modify: every page's nav logo markup (14 files: `index.html`, `404.html`, and each `*/index.html` + `blog/*/index.html`)
- Modify: `styles.css` (`.logo-mark`, `.logo-word`; check existing `.logo-img`/`.logo` rules with `grep -n 'logo' styles.css` first)

**Interfaces:** none downstream. Favicon (`internnest-logo.png`) unchanged.

- [ ] **Step 1: Crop the nest mark**

The current `internnest-logo-h.png` is the woven purple nest (left ~edge, square, full image height) + dark "InternNest.ai" text. Crop the mark:

```bash
python3 - <<'EOF'
from PIL import Image
img = Image.open('internnest-logo-h.png')
w, h = img.size
mark = img.crop((0, 0, int(h * 1.02), h))  # nest is square-ish at the left edge
mark.save('internnest-mark.png')
print(img.size, '->', mark.size)
EOF
```

View the result (Read the PNG) — the crop must contain the full nest with no text fragments. Adjust the crop box if the first attempt clips.

- [ ] **Step 2: Swap the nav markup on all pages**

Two variants exist — index.html uses `src="internnest-logo-h.png"` (no leading slash), subpages use `src="/internnest-logo-h.png"`. Replace both with:

```html
<img src="/internnest-mark.png" alt="" class="logo-mark" /><span class="logo-word">InternNest<span class="logo-dot">.ai</span></span>
```

(index.html keeps its relative path: `src="internnest-mark.png"`.) Keep the surrounding `<a … class="logo">` unchanged; the alt moves to the wordmark being real text. Sweep:

```bash
grep -rln 'internnest-logo-h.png' --include='*.html' . | grep -v liquid-dom-master | grep -v docs/
```

and edit each hit (the footer logo is separate text markup — leave it).

- [ ] **Step 3: Wordmark CSS**

First `grep -n '\.logo-img\|\.logo ' styles.css` to find the existing rules; replace the `.logo-img` height rule with:

```css
.logo { display: inline-flex; align-items: center; gap: 9px; text-decoration: none; }
.logo-mark { height: 34px; width: auto; display: block; }
.logo-word {
  font-size: 20px; font-weight: 800; letter-spacing: -.02em; line-height: 1;
  background: linear-gradient(120deg, #4a3ae0, var(--glass-accent-2));
  -webkit-background-clip: text; background-clip: text;
  -webkit-text-fill-color: transparent; color: var(--glass-accent); /* fallback */
}
.logo-dot { font-weight: 700; }
```

- [ ] **Step 4: Verify in the preview**

- `preview_screenshot` of `/` and `/pricing`: nest mark + purple gradient "InternNest.ai" wordmark, vertically centered with nav links, no layout jump.
- `preview_inspect` `.logo-word` → `background-image` contains the gradient; font-size 20px.
- Mobile snapshot: logo fits next to hamburger without wrapping.

- [ ] **Step 5: Commit**

```bash
git add internnest-mark.png index.html 404.html about blog careers contact cookies get-matched how-it-works pricing privacy terms tracker styles.css
git commit -m "brand: purple gradient wordmark + standalone nest mark in the nav"
```

---

### Task 8: Acceptance sweep

**Files:** none (verification only; fix-forward if a criterion fails).

- [ ] **Step 1: Run the spec's acceptance criteria** (spec §Acceptance criteria) against the preview at desktop 1280×800 and mobile:

1. Hero + widgets visible without scrolling at 1280×800; headline "Find Your Dream Internship".
2. Hero mini-form → /get-matched with 3 fields pre-filled.
3. Tracker "Add internship" opens the modal; link/notes persist and export.
4. Pricing CTAs baseline-aligned; home §pricing copy == /pricing copy.
5. `preview_eval` auth simulation: no "Start Free" text anywhere in the DOM when `authUser` set (`document.body.innerText.includes('Start Free')` → false on each core page).
6. Logo purple + crisp.
7. Grep the built pages for banned phrasings: `grep -rn 'from blank resume\|no subscriptions, no surprises' --include='*.html' . | grep -v liquid-dom-master` → no hits outside docs/.

- [ ] **Step 2: Final screenshots to the user** — home (desktop + mobile), get-matched, tracker with modal open, pricing.

- [ ] **Step 3: Push** (Vercel auto-deploys from main): `git push` — only after all criteria pass.
