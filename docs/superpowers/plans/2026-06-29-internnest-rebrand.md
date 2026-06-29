# InternNest Rebrand — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Rebrand the existing site from "InternPilot AI" to "InternNest" (logo image, all brand text, favicon, repo name) without touching layout or structure.

**Architecture:** Pure static-content change to `index.html` + `styles.css`, plus a logo asset and a GitHub repo rename. No JS logic, no functions. Verification is grep-based assertions + a visual check (no unit-test framework — that's introduced in the matcher milestone, where it adds value; forcing one here would violate YAGNI).

**Tech Stack:** Static HTML/CSS, GitHub CLI (`gh`), Netlify (auto-deploy from `main`).

## Global Constraints

- **Design freeze:** do NOT change front-end design or structure except the rebrand (logo + name) and glitch fixes. Layout, spacing, colors, sections stay as-is.
- **Stay on Netlify;** push to `main` = deploy to live internnest.ai → only push tested, ready work.
- **All accounts in Dillon's name** (repo will be his at handoff).
- **Secrets never committed** (`.env` is gitignored — set up in this milestone for later).
- Provider for later milestones: **Claude (Haiku)**.

**Current brand strings (verbatim, for reference):**
- Header logo (`index.html:18`): `<a href="#" class="logo">Intern<span class="logo-blue">Pilot</span><span class="logo-tag">AI</span></a>`
- Footer logo (`index.html:389`): `<div class="logo">Intern<span class="logo-blue">Pilot</span><span class="logo-tag">AI</span></div>`
- Title (`index.html:6`): `<title>InternPilot AI — Find Your Dream Internship</title>`
- Meta description (`index.html:7`): `content="InternPilot AI matches college students with their best-fit internships using AI. Get personalized match scores, resume tips, and outreach messages."`
- Footer copyright (`index.html:421`): `<p>© 2026 InternPilot AI. Built by students, for students.</p>`
- Logo CSS (`styles.css:159-178`): `.logo`, `.logo-blue`, `.logo-tag`. Nav height is `66px` (`styles.css:157`).
- Logo asset currently in repo root: `intern nest logo.png` (note the spaces).

---

### Task 1: Wire in the InternNest logo image (header + footer) + favicon + .gitignore

**Files:**
- Rename: `intern nest logo.png` → `internnest-logo.png`
- Modify: `index.html` (header logo `:18`, footer logo `:389`, add favicon link in `<head>`)
- Modify: `styles.css` (add `.logo-img` rule near `:159`)
- Modify: `.gitignore` (add `.env`)

**Interfaces:**
- Produces: a web-safe logo file `internnest-logo.png` referenced by `index.html`; `.logo-img` CSS class.

- [ ] **Step 1: Rename the logo file to a web-safe name**

```bash
cd /Users/jackryan/CodingProjects/InternPilotAI
git mv "intern nest logo.png" internnest-logo.png 2>/dev/null || mv "intern nest logo.png" internnest-logo.png
ls -la internnest-logo.png
```
Expected: `internnest-logo.png` exists.

- [ ] **Step 2: Eyeball the logo (size + background) so footer placement is informed**

Open `internnest-logo.png` and note: its aspect ratio, and whether it's a dark/colored mark (matters for the footer, which may be on a light or dark background). You'll use this in Step 5.

- [ ] **Step 3: Replace the header wordmark with the logo image**

In `index.html`, replace the header logo (line ~18):
```html
<a href="#" class="logo"><img src="internnest-logo.png" alt="InternNest" class="logo-img" /></a>
```

- [ ] **Step 4: Add the favicon link in `<head>`**

In `index.html`, add right after the `<title>` line:
```html
<link rel="icon" type="image/png" href="internnest-logo.png" />
```

- [ ] **Step 5: Replace the footer wordmark**

In `index.html`, replace the footer logo (line ~389). Default to the image:
```html
<div class="logo"><img src="internnest-logo.png" alt="InternNest" class="logo-img" /></div>
```
If Step 2 showed the logo is a dark mark and the footer background is dark (check it in Step 8's visual pass), use this text fallback instead so it stays legible:
```html
<div class="logo">Intern<span class="logo-blue">Nest</span></div>
```

- [ ] **Step 6: Add the logo-image CSS**

In `styles.css`, immediately after the `.logo { ... }` rule (ends line ~165), add:
```css
.logo { display: flex; align-items: center; }
.logo-img { height: 38px; width: auto; display: block; }
```
(38px sits comfortably in the 66px nav; adjust in the visual pass if the mark looks too big/small.)

- [ ] **Step 7: Gitignore secrets for later milestones**

Append to `.gitignore`:
```
# Local secrets (Netlify functions)
.env
```

- [ ] **Step 8: Visual check locally**

```bash
cd /Users/jackryan/CodingProjects/InternPilotAI
python3 -m http.server 8000
```
Open http://localhost:8000 — confirm: the logo shows crisply in the nav at a sensible size, the favicon shows in the tab, the footer logo is legible against its background (switch to the text fallback from Step 5 if not), and **nothing else in the layout shifted**. Stop the server (Ctrl-C).

- [ ] **Step 9: Commit**

```bash
git add internnest-logo.png index.html styles.css .gitignore
git commit -m "Rebrand: wire in InternNest logo + favicon, gitignore .env"
```

---

### Task 2: Swap remaining brand text to InternNest

**Files:**
- Modify: `index.html` (title `:6`, meta description `:7`, footer copyright `:421`)

**Interfaces:**
- Consumes: nothing.
- Produces: an `index.html` with zero "InternPilot" occurrences.

- [ ] **Step 1: Update the page title**

In `index.html` line ~6:
```html
<title>InternNest — Find Your Dream Internship</title>
```

- [ ] **Step 2: Update the meta description**

In `index.html` line ~7:
```html
<meta name="description" content="InternNest matches college students with their best-fit internships using AI. Get personalized match scores, resume tips, and outreach messages." />
```

- [ ] **Step 3: Update the footer copyright**

In `index.html` line ~421:
```html
<p>© 2026 InternNest. Built by students, for students.</p>
```

- [ ] **Step 4: Verify no "InternPilot" remains in the page**

```bash
cd /Users/jackryan/CodingProjects/InternPilotAI
grep -c "InternPilot" index.html
```
Expected: `0`.

- [ ] **Step 5: Verify the brand now reads InternNest**

```bash
grep -o "InternNest" index.html | wc -l
```
Expected: ≥ 4 (title, meta, header alt, footer).

- [ ] **Step 6: Commit**

```bash
git add index.html
git commit -m "Rebrand: swap remaining InternPilot text to InternNest"
```

---

### Task 3: Rename the GitHub repository to `internnest`

**Files:** none (remote + local git config only).

**Interfaces:**
- Consumes: existing repo `jackryan225/internpilot-ai`.
- Produces: repo `jackryan225/internnest`; local `origin` pointing to it.

- [ ] **Step 1: Rename the repo on GitHub**

```bash
gh repo rename internnest -R jackryan225/internpilot-ai --yes
```
Expected: confirmation that the repo is now `jackryan225/internnest` (GitHub auto-redirects the old URL).

- [ ] **Step 2: Point the local remote at the new name**

```bash
cd /Users/jackryan/CodingProjects/InternPilotAI
git remote set-url origin https://github.com/jackryan225/internnest.git
git remote -v
```
Expected: `origin` shows `.../internnest.git`.

- [ ] **Step 3: Verify push still works**

```bash
git fetch origin && echo "remote OK"
```
Expected: `remote OK` (no auth/url errors).

- [ ] **Step 4: Note for handoff**

No commit needed. Add a line under the Build Log later: repo renamed `internpilot-ai` → `internnest`; the Netlify ↔ GitHub link survives the rename (Netlify references the repo by ID). Confirm the next deploy (Task 4) still triggers automatically — if it doesn't, re-link the repo in Netlify → Build & deploy.

---

### Task 4: Deploy to live and verify

**Files:** none (deploy only).

- [ ] **Step 1: Push to `main` (triggers Netlify deploy)**

```bash
cd /Users/jackryan/CodingProjects/InternPilotAI
git push origin main
```

- [ ] **Step 2: Wait for the deploy, then verify the live site rebranded**

Give Netlify ~30–60s, then:
```bash
curl -s https://internnest.ai | grep -o "<title>[^<]*</title>"
curl -s https://internnest.ai | grep -c "InternPilot"
curl -s https://internnest.ai | grep -o "internnest-logo.png" | head -1
```
Expected: title contains `InternNest`; `InternPilot` count is `0`; `internnest-logo.png` is referenced.

- [ ] **Step 3: Final visual confirmation**

Open https://internnest.ai in a browser — logo in nav, favicon in tab, InternNest in footer, layout unchanged. Rebrand milestone done.

---

## Self-Review

**Spec coverage (§9 Rebrand):**
- Logo wired into header + footer → Task 1 ✅
- Favicon from logo → Task 1 (Step 4) ✅
- All "InternPilot" → "InternNest" (title, wordmark, meta, footer) → Tasks 1–2 ✅
- Repo rename `internpilot-ai` → `internnest` → Task 3 ✅
- Keep decorative hero cards / "10,000+" line → untouched (no task modifies them) ✅
- `.env` gitignore prep (spec §10) → Task 1 (Step 7) ✅
- Design freeze respected → only logo swap + text + favicon; visual-check steps confirm no layout shift ✅

**Placeholder scan:** none — every step has exact strings, paths, and commands. The one conditional (footer image vs text fallback) ships concrete markup for both branches with a decision rule.

**Name consistency:** `internnest-logo.png` and `.logo-img` are used identically across Tasks 1–4; repo `jackryan225/internnest` consistent in Tasks 3–4.
