# InternNest (internnest.ai)

AI internship matching for college students. Static HTML/CSS/JS site + Vercel
serverless functions. The owner, Dillon, is non-technical: explain things in
plain English, make changes for him, and verify before saying something works.

## How things ship
- A push to `main` deploys to production via Vercel in ~30 seconds. There is no
  staging: commit small, test first, push when green.
- Tests: `node --test lib/*.test.js` (must pass before any push).
- Never commit `.env` (gitignored; holds ANTHROPIC_API_KEY, USAJOBS_API_KEY).

## Layout
- Site pages: root + folders (`get-matched/`, `pricing/`, `tracker/`, ...);
  shared logic in `script.js`, styles in `styles.css` (Liquid Glass theme).
- Serverless: `api/*.js` (match, create-checkout, verify-unlock, account-token,
  contact). Shared logic + tests in `lib/`.
- Data: `internships.json` (~2,300 verified listings). NEVER edit it by hand —
  it is produced by the scraper pipeline below.
- Owner's manual: `docs/owner-guide.html` (unlisted page, plain-English map of
  every service). Keep it current when services or flows change.

## The data machine (scripts/scraper/ — see its README)
Loop: `scrape.py` (7 public sources) -> review `candidates.json` ->
`merge.py` -> `enrich.py` (Sonnet reads JDs for GPA/visa/pay facts) ->
`discover.py` (harvests new boards) -> test -> commit + push.
"Run the scraper loop" means exactly that sequence. Seasonal playbook lives in
the owner guide: big run each August, monthly Oct-Feb, quiet in spring.
`refresh.py` retires dead listings; a weekly GitHub Action runs it.

## How matching works (so you can answer questions)
`/api/match`: prefilter picks 15 by industry + eligibility gates (stated GPA
minimums, class years, elite-firm GPA sanity) -> top 8 (12 with a resume) go to
Claude (Haiku free / Opus premium, chosen by the signed unlock token) -> scores
with reasons. A PDF resume is passed as a native document block. On AI failure
it falls back to formula ranking (`mode: "fallback"` in the response).

## House rules
- Site copy: concise and direct. No em dashes, no emojis (inline SVG icons
  only), no AI-sounding phrases, no stacked reassurances.
- Every public claim must be literally true (listing counts, "AI reads your
  resume", prices). Do not inflate numbers.
- Money: Stripe is live. $9.99 premium unlock / $29 report, one-time. Premium
  is account-based (Supabase `profiles.premium`).
- Accounts are centralized under hello@internnest.ai.

## Useful checks
- Live API probe: POST https://www.internnest.ai/api/match with
  `{"profile":{"industry":"Finance"}}` — expect `mode:"ai"`.
- Data stats: `python3 -c "import json;d=json.load(open('internships.json'));print(len(d))"`

## This machine (Dillon's, Windows)
- Use `python`, not `python3` (Windows installs it as `python`).
- Run tests as `node --test lib/` (the folder form; shell globs differ here).
- Paths use backslashes in Windows shells, but forward slashes in these docs
  work fine when passed to python/node.
- Git credentials come from GitHub Desktop; push normally.
