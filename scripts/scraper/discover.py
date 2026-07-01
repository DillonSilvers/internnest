#!/usr/bin/env python3
"""Slug flywheel — harvest ATS board slugs from candidates.json apply URLs and
merge them into companies.json. Each scrape run discovers new company boards;
the next run then pulls those boards directly (catching roles — especially
off-season terms — that curated lists miss).

Usage:  python3 discover.py          # harvest + merge into companies.json
        python3 discover.py --dry-run
"""
import argparse
import json
import re
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
CANDIDATES = HERE / 'candidates.json'
COMPANIES = HERE / 'companies.json'

PATTERNS = {
    'greenhouse': re.compile(r'(?:job-)?boards?\.greenhouse\.io/(?:embed/job_board\?for=)?([a-z0-9]+)', re.I),
    'lever': re.compile(r'jobs\.(?:eu\.)?lever\.co/([A-Za-z0-9-]+)', re.I),
    'ashby': re.compile(r'jobs\.ashbyhq\.com/([A-Za-z0-9-]+)', re.I),
}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    if not CANDIDATES.exists():
        return print('no candidates.json — run scrape.py first')
    candidates = json.loads(CANDIDATES.read_text())
    cfg = json.loads(COMPANIES.read_text()) if COMPANIES.exists() else {}

    known = {(ats, c['slug'].lower()) for ats in PATTERNS for c in cfg.get(ats, [])}
    found = {}
    for r in candidates:
        url = r.get('application_url', '')
        for ats, pat in PATTERNS.items():
            m = pat.search(url)
            if not m:
                continue
            slug = m.group(1).lower()
            if (ats, slug) in known or (ats, slug) in found:
                continue
            found[(ats, slug)] = {'slug': slug, 'name': r['company'],
                                  'industry_hint': r.get('industry', '')}

    by_ats = {}
    for (ats, _), entry in found.items():
        by_ats.setdefault(ats, []).append(entry)
    for ats, entries in sorted(by_ats.items()):
        print(f'{ats}: +{len(entries)} new companies '
              f'({", ".join(e["slug"] for e in entries[:8])}{"…" if len(entries) > 8 else ""})')
    if not found:
        return print('no new slugs found')
    if args.dry_run:
        return print('(dry run — companies.json unchanged)')

    for ats, entries in by_ats.items():
        cfg.setdefault(ats, []).extend(sorted(entries, key=lambda e: e['slug']))
    COMPANIES.write_text(json.dumps(cfg, indent=2) + '\n')
    total = sum(len(cfg.get(a, [])) for a in PATTERNS)
    print(f'companies.json now tracks {total} company boards — rerun scrape.py to pull them')


if __name__ == '__main__':
    sys.exit(main())
