# InternNest Matcher Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the hard-coded demo matching with a real AI matcher: a Netlify function that pre-filters `internships.json` by the student's profile, has Claude (Haiku) score + explain the best matches, and renders them in the existing card UI — with a loading state, graceful non-AI fallback, and per-IP rate limiting.

**Architecture:** A Netlify **Function** (`netlify/functions/match.js`) is the only network surface; it holds the API key server-side. All real logic lives in small pure modules under `netlify/lib/` so it's unit-testable without the network. The browser's form submit POSTs the profile to the function and renders the returned matches into the *existing* cards (design freeze). If the AI call fails, the function returns a deterministic ranking of the same real listings, so the matcher never hard-fails.

**Tech Stack:** Netlify Functions (Node, CommonJS handler), raw `fetch` to the Anthropic Messages API (no SDK dependency), `@netlify/blobs` for rate-limit counters, `node:test` for unit tests, Netlify CLI (`netlify dev`) for local run.

## Global Constraints

- **Design freeze:** no front-end design/structure changes except wiring matches into the existing cards + a loading state + making "Apply Now" real. No relayouts.
- **Stay on Netlify;** push to `main` = deploy to live → only push tested, ready work. Develop locally with `netlify dev`.
- **AI provider:** Claude (Haiku) — model id `claude-haiku-4-5-20251001`. Verify the model id + Messages API request shape against the **claude-api** skill before implementing Task 3.
- **Secrets never committed:** `ANTHROPIC_API_KEY` lives in a gitignored `.env` (local) and Netlify env settings (prod). `.env` is already gitignored.
- **Cost controls:** $50/mo Anthropic spend cap (set in console by Dillon); per-IP rate limit ~5/min and ~30/day; cap output tokens; ~15 candidates max to the model.
- **Free vs Premium:** Free = top 3 matches; Premium (unlock arrives in Milestone 4) = all (≤10). Build the gate now; the unlock check is a stub returning `false` until M4.

**Existing integration points (verified in current `script.js`):**
- Form submit handler at `script.js:230` builds a `user` object from these field ids: `name, email, school, major, year, industry, role, location, worktype, skills, companies`. It currently uses local `DATA` and calls `renderResults(scored, user)`.
- `renderResults(matches, user)` (`script.js:267`) sets `#resultsHeading` / `#resultsSubheading`, sets `#matchCards` innerHTML to `matches.map((job,i)=>buildCard(job,user,i)).join('')`, unhides `#results`, scrolls.
- `buildCard(job, user, index)` (`script.js:279`) expects job fields: `id, title, company, location, type, score, why, missing[], tip, outreach, application_url(new)`. **Note two changes needed:** it currently calls `job.outreach(user.name, user.school)` as a *function* (must accept a string instead), and the "Apply Now" button calls `markApplied(...)` (must instead open `application_url`).

---

### Task 1: Function scaffolding — `package.json`, `netlify.toml`, local run

**Files:**
- Create: `package.json`
- Create: `netlify.toml`
- Create: `netlify/functions/match.js` (placeholder)
- Create: `.env.example`

**Interfaces:**
- Produces: a deployable functions setup; `GET/POST /.netlify/functions/match` reachable under `netlify dev`.

- [ ] **Step 1: Create `package.json`**

```json
{
  "name": "internnest",
  "version": "1.0.0",
  "private": true,
  "type": "commonjs",
  "scripts": {
    "test": "node --test"
  },
  "dependencies": {
    "@netlify/blobs": "^8.1.0"
  }
}
```

- [ ] **Step 2: Create `netlify.toml`**

```toml
[build]
  publish = "."
  functions = "netlify/functions"

[functions]
  node_bundler = "esbuild"
```

- [ ] **Step 3: Create `.env.example`** (documents the needed vars; the real `.env` is gitignored)

```
ANTHROPIC_API_KEY=sk-ant-xxxxx
UNLOCK_SIGNING_SECRET=any-long-random-string
```

- [ ] **Step 4: Create placeholder `netlify/functions/match.js`**

```js
exports.handler = async () => ({
  statusCode: 200,
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ ok: true, matches: [], mode: 'placeholder' }),
});
```

- [ ] **Step 5: Install deps + verify the function runs locally**

```bash
cd /Users/jackryan/CodingProjects/InternPilotAI
npm install
npx netlify dev --offline &   # starts on http://localhost:8888
sleep 6
curl -s http://localhost:8888/.netlify/functions/match | head -1
```
Expected: `{"ok":true,"matches":[],"mode":"placeholder"}`. (If `netlify` isn't installed: `npm i -g netlify-cli` first.) Stop the dev server when done.

- [ ] **Step 6: Commit**

```bash
git add package.json netlify.toml netlify/functions/match.js .env.example
git commit -m "Matcher: scaffold Netlify functions setup"
```

---

### Task 2: Pure matching logic — `netlify/lib/matcher.js`

**Files:**
- Create: `netlify/lib/matcher.js`
- Test: `netlify/lib/matcher.test.js`

**Interfaces:**
- Produces:
  - `prefilter(profile, listings) -> Array<listing>` — industry-first filter, location/work-type ranked, capped at 15, with cross-industry remote backfill when the chosen industry has < 3.
  - `toCard(listing, fields) -> object` — maps a raw listing + `{score, why, missing, tip, outreach}` into the shape `buildCard` expects.
  - `deterministicRank(profile, candidates) -> Array<card>` — the no-AI fallback: heuristic score + generic copy.

- [ ] **Step 1: Write failing tests**

```js
// netlify/lib/matcher.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { prefilter, toCard, deterministicRank } = require('./matcher');

const listings = [
  { company: 'A', role: 'Finance Intern', industry: 'Finance', location: 'New York, NY', work_type: 'In-Person', required_skills: ['Excel'], application_url: 'https://a.test', term: 'Rolling' },
  { company: 'B', role: 'SWE Intern', industry: 'Technology', location: 'Remote', work_type: 'Remote', required_skills: ['JS'], application_url: 'https://b.test', term: 'Rolling' },
  { company: 'C', role: 'Analyst', industry: 'Finance', location: 'Boston, MA', work_type: 'Hybrid', required_skills: ['SQL'], application_url: 'https://c.test', term: 'Rolling' },
];

test('prefilter keeps the chosen industry', () => {
  const out = prefilter({ industry: 'Finance', location: 'New York', worktype: 'any' }, listings);
  assert.ok(out.every(l => l.industry === 'Finance' || l.work_type === 'Remote'));
  assert.ok(out.some(l => l.company === 'A'));
});

test('prefilter caps at 15', () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ ...listings[0], company: 'co' + i }));
  assert.equal(prefilter({ industry: 'Finance', location: '', worktype: 'any' }, many).length, 15);
});

test('remote preference pulls in cross-industry remote roles', () => {
  const out = prefilter({ industry: 'Finance', location: '', worktype: 'remote' }, listings);
  assert.ok(out.some(l => l.company === 'B'));
});

test('toCard maps fields for buildCard', () => {
  const card = toCard(listings[0], { score: 90, why: 'fits', missing: ['x'], tip: 'do y', outreach: 'hi' });
  assert.equal(card.title, 'Finance Intern');
  assert.equal(card.type, 'In-Person');
  assert.equal(card.application_url, 'https://a.test');
  assert.equal(card.score, 90);
  assert.equal(typeof card.outreach, 'string');
});

test('deterministicRank returns scored cards sorted desc', () => {
  const cards = deterministicRank({ industry: 'Finance', location: 'New York', worktype: 'any', skills: 'Excel' }, listings.filter(l => l.industry === 'Finance'));
  assert.ok(cards.length >= 1);
  assert.ok(cards[0].score >= cards[cards.length - 1].score);
  assert.ok(cards[0].why && cards[0].tip);
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `node --test netlify/lib/matcher.test.js`
Expected: FAIL (`Cannot find module './matcher'`).

- [ ] **Step 3: Implement `netlify/lib/matcher.js`**

```js
'use strict';

function cityOf(loc) {
  return String(loc || '').split('/')[0].split(',')[0].trim().toLowerCase();
}

// Score a listing's *surface* fit (used for pre-ranking + the no-AI fallback).
function fitScore(profile, l) {
  let s = 70;
  const userLoc = String(profile.location || '').toLowerCase();
  const city = cityOf(l.location);
  if (city && userLoc.includes(city)) s += 8;
  if (profile.worktype === 'remote' && l.work_type === 'Remote') s += 6;
  if (profile.worktype === 'remote' && l.work_type !== 'Remote') s -= 10;
  if (profile.worktype === 'onsite' && l.work_type === 'Remote') s -= 6;
  const skills = String(profile.skills || '').toLowerCase();
  const overlap = (l.required_skills || []).filter(k => skills.includes(String(k).toLowerCase())).length;
  s += Math.min(12, overlap * 4);
  return Math.max(50, Math.min(98, s));
}

function prefilter(profile, listings) {
  const inIndustry = listings.filter(l => l.industry === profile.industry);
  let pool = inIndustry;
  // Backfill thin industries with cross-industry remote/rolling roles.
  if (inIndustry.length < 3 || profile.worktype === 'remote') {
    const extra = listings.filter(l => l.industry !== profile.industry && (l.work_type === 'Remote' || /rolling/i.test(l.term || '')));
    pool = inIndustry.concat(extra);
  }
  // De-dup, rank by surface fit, cap at 15.
  const seen = new Set();
  return pool
    .filter(l => { const k = l.company + '|' + l.role; if (seen.has(k)) return false; seen.add(k); return true; })
    .map(l => ({ l, s: fitScore(profile, l) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 15)
    .map(x => x.l);
}

function toCard(listing, fields) {
  return {
    id: (listing.company + '-' + listing.role).replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60),
    title: listing.role,
    company: listing.company,
    location: listing.location,
    type: listing.work_type,
    application_url: listing.application_url,
    term: listing.term,
    score: fields.score,
    why: fields.why,
    missing: fields.missing || [],
    tip: fields.tip || '',
    outreach: fields.outreach || '',
  };
}

function deterministicRank(profile, candidates) {
  const name = (profile.name || 'there').trim();
  return candidates
    .map(l => {
      const score = fitScore(profile, l);
      return toCard(l, {
        score,
        why: `Matches your interest in ${l.industry}: a ${l.role} role at ${l.company} (${l.location}).`,
        missing: (l.required_skills || []).slice(0, 3),
        tip: `Tailor your resume to highlight ${(l.required_skills || []).slice(0, 2).join(' and ') || 'relevant skills'}, then apply directly.`,
        outreach: `Hi,\n\nI'm ${name} and I'm very interested in the ${l.role} role at ${l.company}. I'd love to learn more and share why I'd be a strong fit.\n\nBest,\n${name}`,
      });
    })
    .sort((a, b) => b.score - a.score);
}

module.exports = { prefilter, toCard, deterministicRank, fitScore };
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `node --test netlify/lib/matcher.test.js`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add netlify/lib/matcher.js netlify/lib/matcher.test.js
git commit -m "Matcher: pure prefilter + fallback ranking logic with tests"
```

---

### Task 3: Claude integration — `netlify/lib/claude.js`

> Before coding: open the **claude-api** skill and confirm the Messages API endpoint, headers, model id, and response shape.

**Files:**
- Create: `netlify/lib/claude.js`
- Test: `netlify/lib/claude.test.js`

**Interfaces:**
- Produces:
  - `buildMatchPrompt(profile, candidates) -> { system, user }`
  - `parseMatchResponse(text, candidates) -> Array<card>` — parses Claude's JSON array, merges each item with the real candidate listing (so company/url/term come from our data, never the model), shapes via `toCard`. Throws on unusable output.
  - `async callClaude({ apiKey, system, user, model, maxTokens }) -> string` — POSTs to Anthropic, returns the text content.

- [ ] **Step 1: Write failing tests** (pure functions only; `callClaude` is covered by the live test in Task 5)

```js
// netlify/lib/claude.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { buildMatchPrompt, parseMatchResponse } = require('./claude');

const candidates = [
  { company: 'A', role: 'Finance Intern', industry: 'Finance', location: 'NYC', work_type: 'In-Person', required_skills: ['Excel'], application_url: 'https://a.test', term: 'Rolling' },
  { company: 'B', role: 'SWE Intern', industry: 'Technology', location: 'Remote', work_type: 'Remote', required_skills: ['JS'], application_url: 'https://b.test', term: 'Rolling' },
];

test('buildMatchPrompt includes the candidates and the profile', () => {
  const { system, user } = buildMatchPrompt({ industry: 'Finance', skills: 'Excel' }, candidates);
  assert.match(system, /internship/i);
  assert.match(user, /Finance Intern/);
  assert.match(user, /Excel/);
});

test('parseMatchResponse merges model scores with real listing data', () => {
  const text = '```json\n[{"index":0,"score":92,"why":"great fit","missing":["m"],"tip":"t","outreach":"hi"}]\n```';
  const cards = parseMatchResponse(text, candidates);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].company, 'A');               // from real data
  assert.equal(cards[0].application_url, 'https://a.test'); // from real data
  assert.equal(cards[0].score, 92);                  // from model
  assert.equal(cards[0].why, 'great fit');
});

test('parseMatchResponse throws on unparseable output', () => {
  assert.throws(() => parseMatchResponse('not json at all', candidates));
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `node --test netlify/lib/claude.test.js`
Expected: FAIL (`Cannot find module './claude'`).

- [ ] **Step 3: Implement `netlify/lib/claude.js`**

```js
'use strict';
const { toCard } = require('./matcher');

const SYSTEM = `You are an expert internship-matching assistant for college students.
You will be given a student's profile and a numbered list of REAL internships.
Score how well EACH internship fits the student (0-100), and for each return a short reason,
2-3 concrete missing skills the student should build, a one-line application tip, and a short,
ready-to-send outreach message written in the student's voice.
Only use the internships provided — never invent companies, roles, or URLs.
Return ONLY a JSON array, one object per internship you were given, each:
{"index": <number>, "score": <0-100>, "why": "...", "missing": ["...","..."], "tip": "...", "outreach": "..."}`;

function buildMatchPrompt(profile, candidates) {
  const list = candidates.map((c, i) =>
    `${i}. ${c.role} @ ${c.company} | ${c.industry} | ${c.location} | ${c.work_type} | skills: ${(c.required_skills || []).join(', ')}`
  ).join('\n');
  const user = `STUDENT PROFILE
Name: ${profile.name || 'Student'}
School: ${profile.school || ''}
Major: ${profile.major || ''}
Year: ${profile.year || ''}
Target industry: ${profile.industry || ''}
Target role: ${profile.role || ''}
Preferred location: ${profile.location || ''}
Work preference: ${profile.worktype || 'any'}
Skills: ${profile.skills || ''}
Target companies: ${profile.companies || ''}

INTERNSHIPS (score every one, keep the index):
${list}`;
  return { system: SYSTEM, user };
}

function parseMatchResponse(text, candidates) {
  const m = String(text).match(/\[[\s\S]*\]/); // first JSON array
  if (!m) throw new Error('no JSON array in model output');
  let arr;
  try { arr = JSON.parse(m[0]); } catch (e) { throw new Error('bad JSON: ' + e.message); }
  if (!Array.isArray(arr) || arr.length === 0) throw new Error('empty model output');
  const cards = [];
  for (const item of arr) {
    const c = candidates[item.index];
    if (!c) continue;
    cards.push(toCard(c, {
      score: Math.max(0, Math.min(100, Number(item.score) || 0)),
      why: String(item.why || '').slice(0, 400),
      missing: Array.isArray(item.missing) ? item.missing.slice(0, 3).map(String) : [],
      tip: String(item.tip || '').slice(0, 300),
      outreach: String(item.outreach || '').slice(0, 1200),
    }));
  }
  if (cards.length === 0) throw new Error('no candidates matched model indices');
  return cards.sort((a, b) => b.score - a.score);
}

async function callClaude({ apiKey, system, user, model = 'claude-haiku-4-5-20251001', maxTokens = 2000 }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error('anthropic ' + res.status + ': ' + (await res.text()).slice(0, 200));
  const data = await res.json();
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}

module.exports = { buildMatchPrompt, parseMatchResponse, callClaude, SYSTEM };
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `node --test netlify/lib/claude.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add netlify/lib/claude.js netlify/lib/claude.test.js
git commit -m "Matcher: Claude prompt builder + response parser with tests"
```

---

### Task 4: Per-IP rate limiting — `netlify/lib/ratelimit.js`

**Files:**
- Create: `netlify/lib/ratelimit.js`
- Test: `netlify/lib/ratelimit.test.js`

**Interfaces:**
- Produces: `async checkRateLimit(store, ip, now) -> { allowed: boolean, reason?: string }` — `store` is an injected key/value object `{ get(key), set(key, val) }` (Netlify Blobs in prod, a Map in tests). Limits: 5 per rolling 60s and 30 per rolling 24h per IP.

- [ ] **Step 1: Write failing tests**

```js
// netlify/lib/ratelimit.test.js
const { test } = require('node:test');
const assert = require('node:assert');
const { checkRateLimit } = require('./ratelimit');

function memStore() {
  const m = new Map();
  return { async get(k) { return m.get(k); }, async set(k, v) { m.set(k, v); } };
}

test('allows under the per-minute limit', async () => {
  const s = memStore(); const now = 1_000_000;
  for (let i = 0; i < 5; i++) {
    const r = await checkRateLimit(s, '1.1.1.1', now + i * 1000);
    assert.equal(r.allowed, true);
  }
});

test('blocks the 6th request within a minute', async () => {
  const s = memStore(); const now = 2_000_000;
  for (let i = 0; i < 5; i++) await checkRateLimit(s, '2.2.2.2', now + i * 100);
  const r = await checkRateLimit(s, '2.2.2.2', now + 600);
  assert.equal(r.allowed, false);
});

test('separate IPs are independent', async () => {
  const s = memStore(); const now = 3_000_000;
  for (let i = 0; i < 5; i++) await checkRateLimit(s, '3.3.3.3', now + i * 100);
  const r = await checkRateLimit(s, '4.4.4.4', now + 600);
  assert.equal(r.allowed, true);
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `node --test netlify/lib/ratelimit.test.js`
Expected: FAIL (`Cannot find module './ratelimit'`).

- [ ] **Step 3: Implement `netlify/lib/ratelimit.js`**

```js
'use strict';
const MIN_WINDOW = 60 * 1000, MIN_MAX = 5;
const DAY_WINDOW = 24 * 60 * 60 * 1000, DAY_MAX = 30;

async function checkRateLimit(store, ip, now) {
  const key = 'rl:' + ip;
  let rec;
  try { rec = await store.get(key); } catch (e) { rec = null; }
  if (typeof rec === 'string') { try { rec = JSON.parse(rec); } catch (e) { rec = null; } }
  let hits = (rec && Array.isArray(rec.hits)) ? rec.hits : [];
  hits = hits.filter(t => now - t < DAY_WINDOW);
  const inMinute = hits.filter(t => now - t < MIN_WINDOW).length;
  if (inMinute >= MIN_MAX) return { allowed: false, reason: 'minute' };
  if (hits.length >= DAY_MAX) return { allowed: false, reason: 'day' };
  hits.push(now);
  try { await store.set(key, JSON.stringify({ hits })); } catch (e) { /* fail-open on store errors */ }
  return { allowed: true };
}

module.exports = { checkRateLimit };
```

- [ ] **Step 4: Run tests, verify they pass**

Run: `node --test netlify/lib/ratelimit.test.js`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add netlify/lib/ratelimit.js netlify/lib/ratelimit.test.js
git commit -m "Matcher: per-IP rate limiting with tests"
```

---

### Task 5: The function handler — `netlify/functions/match.js`

**Files:**
- Modify: `netlify/functions/match.js` (replace the placeholder)

**Interfaces:**
- Consumes: `prefilter`, `deterministicRank` (matcher.js); `buildMatchPrompt`, `parseMatchResponse`, `callClaude` (claude.js); `checkRateLimit` (ratelimit.js); `@netlify/blobs`; `internships.json`.
- Produces: `POST /.netlify/functions/match` with body `{profile}` → `200 {matches: card[], mode: 'ai'|'fallback'}`, or `429 {error}` when rate-limited, or `400` on bad input.

- [ ] **Step 1: Implement the handler**

```js
'use strict';
const { getStore } = require('@netlify/blobs');
const listings = require('../../internships.json');
const { prefilter, deterministicRank } = require('../lib/matcher');
const { buildMatchPrompt, parseMatchResponse, callClaude } = require('../lib/claude');
const { checkRateLimit } = require('../lib/ratelimit');

const json = (statusCode, obj) => ({ statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  let profile;
  try {
    const body = JSON.parse(event.body || '{}');
    profile = body.profile || body;
  } catch (e) { return json(400, { error: 'bad JSON' }); }
  if (!profile || !profile.industry) return json(400, { error: 'missing industry' });
  // Cap input sizes (cost/abuse guard).
  for (const k of ['skills', 'role', 'location', 'companies']) {
    if (typeof profile[k] === 'string') profile[k] = profile[k].slice(0, 500);
  }

  const ip = (event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  try {
    const store = getStore('ratelimit');
    const rl = await checkRateLimit(store, ip, Date.now());
    if (!rl.allowed) return json(429, { error: 'rate limited, try again shortly' });
  } catch (e) { /* if Blobs unavailable locally, fail open */ }

  const candidates = prefilter(profile, listings);
  if (candidates.length === 0) return json(200, { matches: [], mode: 'empty' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const { system, user } = buildMatchPrompt(profile, candidates);
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 22000);
      const text = await callClaude({ apiKey, system, user });
      clearTimeout(timer);
      const matches = parseMatchResponse(text, candidates);
      return json(200, { matches, mode: 'ai' });
    } catch (e) {
      // fall through to deterministic ranking
    }
  }
  return json(200, { matches: deterministicRank(profile, candidates), mode: 'fallback' });
};
```

- [ ] **Step 2: Smoke-test locally WITHOUT a key (must use the fallback path)**

```bash
cd /Users/jackryan/CodingProjects/InternPilotAI
npx netlify dev --offline &
sleep 6
curl -s -X POST http://localhost:8888/.netlify/functions/match \
  -H 'content-type: application/json' \
  -d '{"profile":{"name":"Sam","industry":"Technology","location":"New York","worktype":"any","skills":"Python, React"}}' \
  | node -e 'let s="";process.stdin.on("data",d=>s+=d).on("end",()=>{const j=JSON.parse(s);console.log("mode="+j.mode+" matches="+j.matches.length+" first="+(j.matches[0]&&j.matches[0].company));})'
```
Expected: `mode=fallback matches=<N>` with a real company (the deterministic path works with no key). Stop the dev server.

- [ ] **Step 3: Live-test WITH a key (once Dillon's key is in `.env`)**

Add `ANTHROPIC_API_KEY=sk-ant-...` to `.env`, then repeat Step 2's curl. Expected: `mode=ai` and matches with AI-written `why`/`outreach`. (If the key isn't available yet, this step is deferred — the fallback path is already proven.)

- [ ] **Step 4: Commit**

```bash
git add netlify/functions/match.js
git commit -m "Matcher: function handler (prefilter -> Claude -> graceful fallback) + rate limit"
```

---

### Task 6: Frontend wiring — `script.js`

**Files:**
- Modify: `script.js` (form submit handler ~`:230`; `buildCard` ~`:279`)

**Interfaces:**
- Consumes: `POST /.netlify/functions/match`.
- Produces: real matches rendered in the existing cards; loading state; "Apply Now" opens the listing; Free shows top 3.

- [ ] **Step 1: Replace the form submit handler body** (keep the `user` object collection exactly as-is; replace everything from `const rawMatches = ...` through `renderResults(scored, user);`)

```js
  // show loading in the existing results section
  const section = document.getElementById('results');
  document.getElementById('resultsHeading').textContent = 'Finding your matches…';
  document.getElementById('resultsSubheading').textContent = 'Analyzing your profile against real internships.';
  document.getElementById('matchCards').innerHTML =
    '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-500);font-weight:600">🤖 Scoring internships for you…</div>';
  section.classList.remove('hidden');
  section.scrollIntoView({ behavior: 'smooth', block: 'start' });

  let matches = [];
  try {
    const resp = await fetch('/.netlify/functions/match', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ profile: user }),
    });
    const data = await resp.json();
    matches = data.matches || [];
  } catch (err) {
    matches = [];
  }
  if (!matches.length) {
    document.getElementById('matchCards').innerHTML =
      '<div style="grid-column:1/-1;text-align:center;padding:40px;color:var(--gray-500)">We couldn\'t load matches just now — please try again in a moment.</div>';
    return;
  }
  renderResults(matches, user);
```

Then make the submit listener `async`: change `function (e) {` at `script.js:230` to `async function (e) {`.

- [ ] **Step 2: Gate Free vs Premium in `renderResults`** (replace the `#matchCards` innerHTML line)

```js
  const isPremium = isUnlocked();            // stub from Task wiring; false until Milestone 4
  const shown = isPremium ? matches : matches.slice(0, 3);
  document.getElementById('matchCards').innerHTML = shown.map((job, i) => buildCard(job, user, i)).join('')
    + (!isPremium && matches.length > shown.length
      ? `<div style="grid-column:1/-1;text-align:center;padding:24px"><a href="#pricing" class="btn-primary">Unlock all ${matches.length} matches + AI outreach →</a></div>`
      : '');
```

Add near the top of `script.js`:
```js
function isUnlocked() { return false; } // Milestone 4 replaces this with the Stripe unlock check
```

- [ ] **Step 3: Fix `buildCard`** — outreach is now a string, and "Apply Now" opens the listing.

Replace the outreach line:
```js
  const outreachText = (typeof job.outreach === 'string' && job.outreach) ? job.outreach
    : `Hi,\n\nI'm ${user.name} from ${user.school}. I'm interested in the ${job.title} role at ${job.company}.\n\nBest,\n${user.name}`;
```
Replace the "Apply Now" button (the `markApplied(...)` button) with:
```js
    <a class="btn-primary" href="${job.application_url || '#'}" target="_blank" rel="noopener" onclick="markApplied('${job.id}','${titleEsc}','${companyEsc}',${job.score})">
      Apply Now →
    </a>
```

- [ ] **Step 4: End-to-end test in the browser** (with `netlify dev`)

```bash
cd /Users/jackryan/CodingProjects/InternPilotAI
npx netlify dev --offline
```
Open http://localhost:8888, fill the form (industry Technology), submit. Expected: loading state appears, then 3 real match cards render with working "Apply Now" links to real listings, and an "Unlock all N matches" CTA below. With a key in `.env`, the copy is AI-written; without, it's the deterministic fallback. Confirm the existing layout is unchanged.

- [ ] **Step 5: Commit**

```bash
git add script.js
git commit -m "Matcher: wire form to the match function, loading state, Free gate, real Apply links"
```

---

## Self-Review

**Spec coverage (§5 Matcher, §6 Reliability/cost):**
- Form-fields-only input → Tasks 5/6 ✅ (profile from form, no resume)
- Pre-filter by industry (+remote backfill), ≤15 to model → Task 2 `prefilter` ✅
- Claude scores/explains into existing card fields → Tasks 3/6 ✅
- Free top 3 / Premium ≤10 (unlock stub until M4) → Task 6 ✅
- "Apply Now" → real external URL in new tab → Task 6 ✅
- Loading state in existing results section → Task 6 ✅
- Graceful degradation to deterministic ranking on AI failure → Tasks 2/5 ✅
- $50 cap (console, Dillon) + per-IP rate limit + input/output caps + Haiku → Tasks 4/5 ✅
- Key server-side only, never committed → Tasks 1/5 ✅ (env var, `.env` gitignored)
- Design freeze respected → Task 6 only adds a loading state + a CTA inside existing containers ✅

**Placeholder scan:** none — every step has real code/commands. The one stub (`isUnlocked()` → `false`) is intentional and documented as Milestone 4's seam.

**Name consistency:** `prefilter`, `toCard`, `deterministicRank`, `fitScore`, `buildMatchPrompt`, `parseMatchResponse`, `callClaude`, `checkRateLimit`, `isUnlocked` are used identically across tasks. Card shape (`id,title,company,location,type,application_url,term,score,why,missing,tip,outreach`) is consistent between `toCard` (Task 2), `parseMatchResponse` (Task 3), and `buildCard` (Task 6).

**Note on live testing:** Tasks 2–4 and the fallback path of Tasks 5–6 are fully testable *now* without any key. Only the `mode: 'ai'` path (Task 5 Step 3) needs Dillon's `ANTHROPIC_API_KEY` — everything else proves out first.
