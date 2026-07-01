#!/usr/bin/env python3
"""Merge reviewed candidates.json into the site's internships.json.

Validates every record against the site schema, skips duplicates, backs up the
old file first (internships.backup.json). The site deploys the new data on the
next git push.

Usage:
  python3 merge.py               # merge everything in candidates.json
  python3 merge.py --limit 200   # merge at most 200 (top of file first)
  python3 merge.py --dry-run     # report what would happen, write nothing
"""
import argparse
import json
import re
import sys
from pathlib import Path

from ai import INDUSTRIES, WORK_TYPES

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SITE_JSON = ROOT / 'internships.json'
BACKUP = ROOT / 'internships.backup.json'
CANDIDATES = HERE / 'candidates.json'

REQUIRED = ['company', 'role', 'industry', 'location', 'work_type',
            'short_description', 'required_skills', 'application_url', 'source_url', 'term']


def norm_key(company, role):
    return re.sub(r'[^a-z0-9]+', '-', f'{company}|{role}'.lower()).strip('-')


def problems(r):
    out = [k for k in REQUIRED if not r.get(k)]
    if r.get('industry') not in INDUSTRIES:
        out.append(f"industry={r.get('industry')!r}")
    if r.get('work_type') not in WORK_TYPES:
        out.append(f"work_type={r.get('work_type')!r}")
    if not str(r.get('application_url', '')).startswith('http'):
        out.append('application_url not http(s)')
    if not isinstance(r.get('required_skills'), list) or not r.get('required_skills'):
        out.append('required_skills empty')
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--dry-run', action='store_true')
    args = ap.parse_args()

    if not CANDIDATES.exists():
        return print('no candidates.json — run scrape.py first')
    candidates = json.loads(CANDIDATES.read_text())
    site = json.loads(SITE_JSON.read_text())
    existing = {norm_key(x['company'], x['role']) for x in site}

    added, skipped_dup, skipped_bad = [], 0, 0
    for r in candidates:
        if args.limit and len(added) >= args.limit:
            break
        bad = problems(r)
        if bad:
            skipped_bad += 1
            print(f"  skip (invalid: {', '.join(bad)}): {r.get('company')} — {r.get('role')}")
            continue
        k = norm_key(r['company'], r['role'])
        if k in existing:
            skipped_dup += 1
            continue
        existing.add(k)
        added.append({key: r[key] for key in REQUIRED})

    print(f'\n{len(added)} to add | {skipped_dup} duplicates | {skipped_bad} invalid')
    print(f'internships.json: {len(site)} -> {len(site) + len(added)}')
    if args.dry_run or not added:
        return print('(dry run — nothing written)' if args.dry_run else '')

    BACKUP.write_text(json.dumps(site, indent=2) + '\n')
    SITE_JSON.write_text(json.dumps(site + added, indent=2) + '\n')
    print(f'backed up old file -> {BACKUP.name}')
    print(f'wrote {SITE_JSON}')
    print('\nnext: git diff to sanity-check, run the site tests, commit + push to deploy')


if __name__ == '__main__':
    sys.exit(main())
