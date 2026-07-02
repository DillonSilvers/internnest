#!/usr/bin/env python3
"""InternNest internship scraper — pulls real postings from public JSON sources,
AI-normalizes them into the site schema, verifies links, and writes candidates.json
for review. Nothing touches internships.json until you run merge.py.

Usage:
  python3 scrape.py                       # all sources, AI normalization, URL checks
  python3 scrape.py --sources simplify    # just the SimplifyJobs list
  python3 scrape.py --max-per-source 300  # cap volume per source
  python3 scrape.py --no-ai               # heuristic normalization (no API key needed)
  python3 scrape.py --no-verify           # skip link checking (faster)
  python3 scrape.py --selftest            # offline sanity check, no network/API
"""
import argparse
import json
import re
import sys
import urllib.error
import urllib.request
from concurrent.futures import ThreadPoolExecutor
from pathlib import Path

import ai
import sources

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SITE_JSON = ROOT / 'internships.json'
CANDIDATES = HERE / 'candidates.json'
COMPANIES = HERE / 'companies.json'

# Interns by any name: banks say "Summer Analyst", engineering/healthcare say "Co-op".
INTERN_RE = re.compile(r'\bintern(ship)?s?\b|\bco-?op\b|\bsummer (analyst|associate)s?\b', re.I)


def norm_key(company, role):
    """Same identity the site uses: company|role, alphanumeric, lowercase."""
    return re.sub(r'[^a-z0-9]+', '-', f'{company}|{role}'.lower()).strip('-')


def is_internship(p):
    return bool(INTERN_RE.search(p['role'])) and p['application_url'].startswith('http')


def gather(selected, max_per_source, log=print):
    cfg = json.loads(COMPANIES.read_text()) if COMPANIES.exists() else {}
    raw = []
    if 'simplify' in selected:
        log('fetching simplify (open-source internship list)…')
        try:
            got = sources.fetch_simplify(max_items=max_per_source)
            log(f'  simplify: {len(got)} active postings')
            raw += got
        except Exception as e:
            log(f'  ! simplify failed: {e}')
    for ats, fetch in sources.ATS_FETCHERS.items():
        if ats not in selected:
            continue
        entries = cfg.get(ats, [])
        log(f'fetching {ats} ({len(entries)} companies)…')
        count_before = len(raw)
        for c in entries:
            ident = c.get('slug') or c.get('tenant') or c.get('name')
            try:
                raw += fetch(c)[:max_per_source]
            except Exception as e:
                log(f"  ! {ats}:{ident} failed ({e}) — check the entry")
        log(f'  {ats}: {len(raw) - count_before} postings')
    return raw


def verify_urls(records, log=print):
    """Drop records whose apply link is dead (404/410). Bot-blocked (403 etc.) is kept."""
    def status(url):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': sources.UA})
            with urllib.request.urlopen(req, timeout=10, context=sources.SSL_CTX) as res:
                return res.status
        except urllib.error.HTTPError as e:
            return e.code
        except Exception:
            return -1  # network hiccup: keep, don't punish
    log(f'verifying {len(records)} application links…')
    with ThreadPoolExecutor(max_workers=8) as ex:
        codes = list(ex.map(lambda r: status(r['application_url']), records))
    kept = [r for r, c in zip(records, codes) if c not in (404, 410)]
    log(f'  dropped {len(records) - len(kept)} dead links')
    return kept


def selftest():
    fixtures = [
        {'company': 'Acme Capital', 'role': 'Investment Banking Summer Intern 2026',
         'location': 'New York, NY', 'application_url': 'https://x.test/1',
         'term_hint': 'Summer 2026', 'industry_hint': 'Finance', 'source': 'test'},
        {'company': 'Acme Capital', 'role': 'Investment Banking Summer Intern 2026',
         'location': 'New York, NY', 'application_url': 'https://x.test/1',
         'term_hint': '', 'industry_hint': '', 'source': 'test'},  # dup of #1
        {'company': 'MegaCorp', 'role': 'Internal Audit Manager',       # not an internship
         'location': 'Remote', 'application_url': 'https://x.test/2',
         'term_hint': '', 'industry_hint': '', 'source': 'test'},
        {'company': 'PixelSoft', 'role': 'Software Engineer Intern',
         'location': 'Remote - US', 'application_url': 'https://x.test/3',
         'term_hint': '', 'industry_hint': '', 'source': 'test'},
    ]
    postings = [p for p in fixtures if is_internship(p)]
    assert len(postings) == 3, f'intern filter: {len(postings)}'
    seen, deduped = set(), []
    for p in postings:
        k = norm_key(p['company'], p['role'])
        if k not in seen:
            seen.add(k)
            deduped.append(p)
    assert len(deduped) == 2, f'dedup: {len(deduped)}'
    recs = ai.normalize_heuristic(deduped)
    assert len(recs) == 2 and recs[0]['industry'] == 'Finance' and recs[1]['work_type'] == 'Remote', recs
    assert recs[0]['term'] == 'Summer 2026'
    salvaged = ai.parse_ai_array('noise [{"index":0,"keep":true},{"index":1')
    assert len(salvaged) == 1
    for r in recs:
        missing = [k for k in ('company', 'role', 'industry', 'location', 'work_type',
                               'short_description', 'required_skills', 'application_url',
                               'source_url', 'term') if k not in r]
        assert not missing, missing
    print('selftest PASS (filter, dedup, heuristics, schema, AI-parse salvage)')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--sources', default='simplify,greenhouse,lever,ashby')
    ap.add_argument('--max-per-source', type=int, default=400)
    ap.add_argument('--no-ai', action='store_true')
    ap.add_argument('--no-verify', action='store_true')
    ap.add_argument('--selftest', action='store_true')
    args = ap.parse_args()

    if args.selftest:
        return selftest()

    selected = {s.strip() for s in args.sources.split(',') if s.strip()}
    raw = gather(selected, args.max_per_source)
    postings = [p for p in raw if is_internship(p)]
    print(f'{len(raw)} raw postings -> {len(postings)} look like internships')

    existing = {norm_key(x['company'], x['role'])
                for x in json.loads(SITE_JSON.read_text())} if SITE_JSON.exists() else set()
    seen, fresh = set(existing), []
    for p in postings:
        k = norm_key(p['company'], p['role'])
        if k not in seen:
            seen.add(k)
            fresh.append(p)
    print(f'{len(fresh)} new after dedup (site already has {len(existing)})')
    if not fresh:
        return print('nothing new — try more sources/slugs')

    key = '' if args.no_ai else ai.load_api_key()
    if key:
        records = ai.normalize_with_ai(fresh, key)
    else:
        if not args.no_ai:
            print('! no ANTHROPIC_API_KEY found — falling back to heuristics (pass --no-ai to silence)')
        records = ai.normalize_heuristic(fresh)
    print(f'{len(records)} normalized into site schema')

    if not args.no_verify:
        records = verify_urls(records)

    CANDIDATES.write_text(json.dumps(records, indent=2) + '\n')
    by_ind = {}
    for r in records:
        by_ind[r['industry']] = by_ind.get(r['industry'], 0) + 1
    print(f'\nwrote {len(records)} candidates -> {CANDIDATES}')
    print('by industry:', json.dumps(by_ind, indent=2))
    print('\nnext: spot-check candidates.json, then run  python3 merge.py')


if __name__ == '__main__':
    sys.exit(main())
