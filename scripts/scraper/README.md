# InternNest internship scraper

Grows `internships.json` toward ~1,000 real, verified listings. Pure Python
stdlib — **no pip installs**. Nothing touches the live data until you run
`merge.py`, and even then the old file is backed up first.

## The 5-minute loop ("the reps")

```bash
cd scripts/scraper
python3 scrape.py            # pull sources -> AI-normalize -> verify -> candidates.json
# open candidates.json, spot-check ~10 entries
python3 merge.py --dry-run   # see what would be added
python3 merge.py             # merge into ../../internships.json (backs up first)
cd ../.. && node --test lib/*.test.js   # site tests still green
git add internships.json && git commit -m "data: +N internships" && git push  # deploys
```

Repeat whenever you want more listings. Each run only adds *new* postings —
duplicates (vs. the site and within the run) are dropped automatically.

## Where listings come from (all public JSON, no HTML scraping)

| Source | What it is | How to grow it |
|---|---|---|
| `simplify` | SimplifyJobs' open-source internship list (thousands, community-verified) | automatic — the volume source |
| `greenhouse` | Any company whose careers page runs on Greenhouse | add slugs to `companies.json` |
| `lever` | Same, for Lever | add slugs |
| `ashby` | Same, for Ashby | add slugs |

**Finding a company's slug:** open their careers page and look at the URL —
`boards.greenhouse.io/<slug>`, `jobs.lever.co/<slug>`, or `jobs.ashbyhq.com/<slug>`.
Put that slug in `companies.json` with a display name + industry hint. A wrong
slug just logs a warning, so guess freely. This is the lever for thin industries
(Sports Business, Real Estate, Healthcare): find 5–10 employers per industry,
add their slugs, rerun.

**The slug flywheel:** after any scrape, `python3 discover.py` harvests company
board slugs out of the candidates' own apply links and adds them to
`companies.json` — so each run discovers new boards for the next run to pull
directly. scrape → discover → scrape again compounds coverage on its own.

**Tip:** for long runs, use `python3 -u scrape.py … | tee scrape-run.log` — the
`-u` streams progress live instead of buffering it.

## AI normalization

Claude Haiku classifies each posting into the site's 8 industries, extracts
skills/work type/term, writes the one-line description, and **discards anything
that isn't a real student internship**. It reads `ANTHROPIC_API_KEY` from your
environment or the repo-root `.env` (already there for local dev). Cost:
~1,000 postings ≈ well under $1. No key? It falls back to keyword heuristics
(`--no-ai`) — usable, but the AI pass is much better; don't merge heuristic
output without reviewing it.

## Useful flags

```bash
python3 scrape.py --sources simplify          # one source only
python3 scrape.py --max-per-source 200        # smaller batch
python3 scrape.py --no-verify                 # skip link checks (faster)
python3 scrape.py --selftest                  # offline sanity check
python3 merge.py --limit 100                  # merge only the first 100
```

## Schema depth — JD enrichment (`enrich.py`)

After merging, `python3 -u enrich.py` fetches each listing's **full job
description** from its board and has **Claude Sonnet** extract stated
eligibility facts: `gpa_min`, `class_years`, `sponsorship` (visa stance),
`paid`, `deadline`, plus cleaner location/work-type. Only facts the JD
explicitly states get written — no guessing. The matcher then hard-gates
ineligible students (below a stated GPA minimum, wrong class year) and the
match AI sees the requirements in its prompt. Re-runs skip already-enriched
records, so run it after every merge; cost is roughly $6–8 for a full first
pass and cents thereafter.

## Quality guardrails (already built in)

- Title must contain "intern(ship)" — and the AI screens for real student roles.
- `industry` / `work_type` are validated against the site's exact enums, so the
  matcher's prefilter never breaks.
- Apply links are checked; 404/410 links are dropped.
- Dedup uses the same `company|role` identity as the site's matcher.
- `merge.py` re-validates every record and writes `internships.backup.json` first.

## Troubleshooting

- **`simplify failed`** — GitHub moved the file; check the repo
  `SimplifyJobs/Summer2026-Internships` and update `SIMPLIFY_URLS` in `sources.py`
  (or ask Claude to).
- **A slug logs `failed`** — the company moved ATS or the slug is wrong; fix or
  delete the entry.
- **Too many of one industry** — that's fine; run again with slugs targeted at
  the thin industries, or `merge.py --limit` to keep the mix balanced.
