#!/usr/bin/env python3
"""JD enrichment — schema depth. Fetches each listing's full job description
from its ATS board (same public APIs as scrape.py) and uses Claude Sonnet to
extract eligibility facts the matcher can act on:

  gpa_min        stated minimum GPA (number) — feeds the GPA matching
  class_years    which years may apply (["Sophomore","Junior"] etc.)
  sponsorship    "yes"/"no" — visa sponsorship / work-authorization stance
  paid           true/false when the posting states pay (or explicitly unpaid)
  deadline       "YYYY-MM-DD" application deadline when stated
  location/work_type refreshed when the JD is clearer than the board summary

Fields are only written when the JD explicitly supports them — the model is
instructed to return null rather than guess. Records gain `enriched_at`;
re-runs skip already-enriched records unless --force.

Usage:
  python3 -u enrich.py --limit 20      # small run to eyeball quality
  python3 -u enrich.py                 # enrich everything with a fetchable JD
  python3 enrich.py --dry-run          # report coverage, write nothing
  python3 enrich.py --selftest         # offline logic check
"""
import argparse
import datetime
import html
import json
import re
import sys
from pathlib import Path

import ai
import sources

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
SITE_JSON = ROOT / 'internships.json'
BACKUP = ROOT / 'internships.backup.json'
COMPANIES = HERE / 'companies.json'

ENRICH_MODEL = 'claude-sonnet-5'
BATCH = 5
JD_CHARS = 4500

UUID_RE = re.compile(r'[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}', re.I)
GH_ID_RE = re.compile(r'(?:gh_jid=|greenhouse\.io/[^\s]*/jobs/)(\d+)')

SYSTEM = """You extract eligibility facts from internship job descriptions for a student
internship-matching site. For EACH numbered posting return one JSON object:
{"index": <n>, "gpa_min": <number or null>, "class_years": <array or null>,
 "sponsorship": "yes"|"no"|"unstated", "paid": true|false|null,
 "deadline": "YYYY-MM-DD"|null, "location": "..."|null, "work_type": "Remote"|"Hybrid"|"In-Person"|null}

Rules — ONLY state a value the description explicitly supports; otherwise null/"unstated":
- gpa_min: a stated minimum GPA requirement (e.g. "minimum 3.0 GPA" -> 3.0).
- class_years: which students may apply, as the student's CURRENT year, subset of
  ["Freshman","Sophomore","Junior","Senior","Graduate"]. "Rising junior" means a
  current Sophomore. null when the posting doesn't restrict by year.
- sponsorship: "no" if it says no visa sponsorship / must be authorized to work
  without sponsorship; "yes" if it says sponsorship is available; else "unstated".
- paid: true if a wage/salary/stipend is stated; false ONLY if explicitly unpaid.
- deadline: the application deadline date, if one is stated.
- location: a cleaner "City, ST" (or "Remote") than the given one, if the JD is clearer.
- work_type: only if the JD clearly states remote/hybrid/on-site.
Return ONLY a JSON array, one object per posting, no other text."""


def strip_html(s):
    s = html.unescape(html.unescape(s or ''))  # greenhouse double-escapes content
    s = re.sub(r'<(script|style)[^>]*>.*?</\1>', ' ', s, flags=re.S | re.I)
    s = re.sub(r'<[^>]+>', ' ', s)
    return re.sub(r'\s+', ' ', s).strip()


# ---- build an index of JD text across every board we track ----

def fetch_jd_index(log=print):
    cfg = json.loads(COMPANIES.read_text()) if COMPANIES.exists() else {}
    by_url, by_id = {}, {}

    def add(url, key, jd):
        if not jd:
            return
        if url:
            by_url[url] = jd
        if key:
            by_id[key] = jd

    for c in cfg.get('greenhouse', []):
        try:
            data = sources.http_get_json(
                f"https://boards-api.greenhouse.io/v1/boards/{c['slug']}/jobs?content=true")
        except Exception as e:
            log(f"  ! greenhouse:{c['slug']}: {e}")
            continue
        for j in data.get('jobs', []):
            add(j.get('absolute_url'), ('gh', str(j.get('id'))), strip_html(j.get('content', '')))
    for c in cfg.get('lever', []):
        try:
            data = sources.http_get_json(f"https://api.lever.co/v0/postings/{c['slug']}?mode=json")
        except Exception as e:
            log(f"  ! lever:{c['slug']}: {e}")
            continue
        for j in data if isinstance(data, list) else []:
            parts = [j.get('description', '')] + [l.get('content', '') for l in j.get('lists', [])]
            m = UUID_RE.search(j.get('hostedUrl', '') or '')
            add(j.get('hostedUrl'), ('uuid', m.group(0).lower()) if m else None,
                strip_html(' '.join(parts)))
    for c in cfg.get('ashby', []):
        try:
            data = sources.http_get_json(f"https://api.ashbyhq.com/posting-api/job-board/{c['slug']}")
        except Exception as e:
            log(f"  ! ashby:{c['slug']}: {e}")
            continue
        for j in data.get('jobs', []):
            url = j.get('jobUrl') or j.get('applyUrl') or ''
            m = UUID_RE.search(url)
            add(url, ('uuid', m.group(0).lower()) if m else None, strip_html(j.get('descriptionHtml', '')))
    log(f'JD index: {len(by_url)} urls, {len(by_id)} ids')
    return by_url, by_id


def jd_for(record, by_url, by_id):
    url = record.get('application_url', '')
    if url in by_url:
        return by_url[url]
    if url.rstrip('/').endswith('/apply') and url.rstrip('/')[:-6] in by_url:
        return by_url[url.rstrip('/')[:-6]]
    m = GH_ID_RE.search(url)
    if m and ('gh', m.group(1)) in by_id:
        return by_id[('gh', m.group(1))]
    m = UUID_RE.search(url)
    if m and ('uuid', m.group(0).lower()) in by_id:
        return by_id[('uuid', m.group(0).lower())]
    return None


# ---- extraction ----

CLASS_YEARS = ['Freshman', 'Sophomore', 'Junior', 'Senior', 'Graduate']


def apply_fields(rec, item, today):
    g = item.get('gpa_min')
    if isinstance(g, (int, float)) and 0 < g <= 4.5:
        rec['gpa_min'] = round(float(g), 2)
    cy = item.get('class_years')
    if isinstance(cy, list):
        cy = [y for y in cy if y in CLASS_YEARS]
        if cy:
            rec['class_years'] = cy
    if item.get('sponsorship') in ('yes', 'no'):
        rec['sponsorship'] = item['sponsorship']
    if isinstance(item.get('paid'), bool):
        rec['paid'] = item['paid']
    if isinstance(item.get('deadline'), str) and re.match(r'^20\d\d-\d\d-\d\d$', item['deadline']):
        rec['deadline'] = item['deadline']
    if isinstance(item.get('location'), str) and len(item['location']) > 1:
        rec['location'] = item['location'][:120]
    if item.get('work_type') in ('Remote', 'Hybrid', 'In-Person'):
        rec['work_type'] = item['work_type']
    rec['enriched_at'] = today


def enrich(records_with_jd, api_key, today, log=print):
    enriched = 0
    for start in range(0, len(records_with_jd), BATCH):
        batch = records_with_jd[start:start + BATCH]
        user = 'POSTINGS:\n' + '\n\n'.join(
            f"{i}. {r['role']} @ {r['company']}\nJD: {jd[:JD_CHARS]}"
            for i, (r, jd) in enumerate(batch))
        try:
            text = ai.call_claude(api_key, SYSTEM, user, max_tokens=1500, model=ENRICH_MODEL)
            items = ai.parse_ai_array(text)
        except Exception as e:
            log(f'  ! batch at {start} failed ({e}) — skipped')
            continue
        for item in items:
            try:
                rec = batch[int(item['index'])][0]
            except (KeyError, ValueError, IndexError, TypeError):
                continue
            apply_fields(rec, item, today)
            enriched += 1
        log(f'  enriched {min(start + BATCH, len(records_with_jd))}/{len(records_with_jd)}')
    return enriched


def selftest():
    today = '2026-07-01'
    rec = {'company': 'A', 'role': 'X Intern', 'location': 'old', 'work_type': 'In-Person'}
    apply_fields(rec, {'gpa_min': 3.2, 'class_years': ['Sophomore', 'Junior', 'Alien'],
                       'sponsorship': 'no', 'paid': True, 'deadline': '2026-10-01',
                       'location': 'Boston, MA', 'work_type': 'Hybrid'}, today)
    assert rec['gpa_min'] == 3.2 and rec['class_years'] == ['Sophomore', 'Junior']
    assert rec['sponsorship'] == 'no' and rec['paid'] is True
    assert rec['deadline'] == '2026-10-01' and rec['location'] == 'Boston, MA'
    assert rec['work_type'] == 'Hybrid' and rec['enriched_at'] == today
    rec2 = {'company': 'B', 'role': 'Y Intern', 'location': 'kept', 'work_type': 'Remote'}
    apply_fields(rec2, {'gpa_min': 9, 'class_years': None, 'sponsorship': 'unstated',
                        'paid': None, 'deadline': 'Oct 1', 'location': None, 'work_type': None}, today)
    assert 'gpa_min' not in rec2 and 'class_years' not in rec2 and 'sponsorship' not in rec2
    assert 'paid' not in rec2 and 'deadline' not in rec2
    assert rec2['location'] == 'kept' and rec2['work_type'] == 'Remote'
    assert strip_html('&lt;p&gt;Min &lt;b&gt;3.0&lt;/b&gt; GPA&lt;/p&gt;') == 'Min 3.0 GPA'
    url_jd = {'https://x.test/jobs/1': 'JD'}
    id_jd = {('gh', '99'): 'GH', ('uuid', 'aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee'): 'UU'}
    assert jd_for({'application_url': 'https://x.test/jobs/1'}, url_jd, id_jd) == 'JD'
    assert jd_for({'application_url': 'https://co.com/careers?gh_jid=99'}, url_jd, id_jd) == 'GH'
    assert jd_for({'application_url': 'https://jobs.lever.co/z/AAAAAAAA-BBBB-CCCC-DDDD-EEEEEEEEEEEE/apply'},
                  url_jd, id_jd) == 'UU'
    print('selftest PASS (apply_fields guards, html strip, JD matching)')


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--force', action='store_true')
    ap.add_argument('--dry-run', action='store_true')
    ap.add_argument('--selftest', action='store_true')
    args = ap.parse_args()
    if args.selftest:
        return selftest()

    api_key = ai.load_api_key()
    if not api_key:
        return print('no ANTHROPIC_API_KEY — set it or add to the repo-root .env')

    data = json.loads(SITE_JSON.read_text())
    by_url, by_id = fetch_jd_index()

    todo = []
    for r in data:
        if r.get('enriched_at') and not args.force:
            continue
        jd = jd_for(r, by_url, by_id)
        if jd and len(jd) > 200:
            todo.append((r, jd))
    print(f'{len(todo)} of {len(data)} listings have a fetchable JD and need enrichment')
    if args.limit:
        todo = todo[:args.limit]
    if args.dry_run or not todo:
        return print('(dry run — nothing written)' if args.dry_run else 'nothing to do')

    today = datetime.date.today().isoformat()
    n = enrich(todo, api_key, today)

    BACKUP.write_text(json.dumps(json.loads(SITE_JSON.read_text()), indent=2) + '\n')
    SITE_JSON.write_text(json.dumps(data, indent=2) + '\n')
    stats = {k: sum(1 for r in data if k in r)
             for k in ('gpa_min', 'class_years', 'sponsorship', 'paid', 'deadline', 'enriched_at')}
    print(f'\nenriched {n} listings -> {SITE_JSON}')
    print('field coverage across all listings:', json.dumps(stats))
    print('\nnext: spot-check, run site tests, commit + push')


if __name__ == '__main__':
    sys.exit(main())
