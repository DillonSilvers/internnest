"""Source connectors — every source returns a list of raw postings:
  { company, role, location, application_url, term_hint, industry_hint, source }

All sources are public JSON endpoints (ATS job-board APIs + an open-source
internship list). No HTML scraping, no auth, no ToS gray areas.
"""
import json
import re
import ssl
import time
import urllib.request
import urllib.error

UA = 'InternNestScraper/1.0 (+https://internnest.ai; contact hello@internnest.ai)'
THROTTLE_S = 0.5  # be polite between requests

_last_fetch = [0.0]


def _ssl_context():
    """macOS python.org builds ship without system CAs; use certifi's bundle if present."""
    ctx = ssl.create_default_context()
    try:
        import certifi
        ctx.load_verify_locations(certifi.where())
    except ImportError:
        pass
    return ctx


SSL_CTX = _ssl_context()


def _request_json(url, data=None, timeout=20):
    wait = THROTTLE_S - (time.time() - _last_fetch[0])
    if wait > 0:
        time.sleep(wait)
    headers = {'User-Agent': UA, 'Accept': 'application/json'}
    if data is not None:
        headers['Content-Type'] = 'application/json'
        data = json.dumps(data).encode()
    req = urllib.request.Request(url, data=data, headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout, context=SSL_CTX) as res:
            body = res.read().decode('utf-8', errors='replace')
    except urllib.error.URLError as e:
        if 'CERTIFICATE_VERIFY_FAILED' in str(e):
            raise RuntimeError('SSL certs missing — run: pip3 install certifi '
                               '(or /Applications/Python*/Install Certificates.command)') from e
        raise
    _last_fetch[0] = time.time()
    return json.loads(body)


def http_get_json(url, timeout=20):
    return _request_json(url, timeout=timeout)


def http_post_json(url, payload, timeout=20):
    return _request_json(url, data=payload, timeout=timeout)


def _posting(company, role, location, url, term_hint='', industry_hint='', source=''):
    return {
        'company': (company or '').strip(),
        'role': (role or '').strip(),
        'location': (location or '').strip(),
        'application_url': (url or '').strip(),
        'term_hint': term_hint,
        'industry_hint': industry_hint,
        'source': source,
    }


# ---- ATS connectors (per-company "reps": add entries to companies.json) ----
# Every fetcher takes the companies.json entry dict.

def fetch_greenhouse(c):
    data = http_get_json(f"https://boards-api.greenhouse.io/v1/boards/{c['slug']}/jobs")
    out = []
    for j in data.get('jobs', []):
        loc = (j.get('location') or {}).get('name', '')
        out.append(_posting(c['name'], j.get('title'), loc, j.get('absolute_url'),
                            industry_hint=c.get('industry_hint', ''), source=f"greenhouse:{c['slug']}"))
    return out


def fetch_lever(c):
    data = http_get_json(f"https://api.lever.co/v0/postings/{c['slug']}?mode=json")
    out = []
    for j in data if isinstance(data, list) else []:
        cats = j.get('categories') or {}
        out.append(_posting(c['name'], j.get('text'), cats.get('location', ''), j.get('hostedUrl'),
                            term_hint=cats.get('commitment', ''),
                            industry_hint=c.get('industry_hint', ''), source=f"lever:{c['slug']}"))
    return out


def fetch_ashby(c):
    data = http_get_json(f"https://api.ashbyhq.com/posting-api/job-board/{c['slug']}")
    out = []
    for j in data.get('jobs', []):
        out.append(_posting(c['name'], j.get('title'), j.get('location', ''),
                            j.get('jobUrl') or j.get('applyUrl'),
                            industry_hint=c.get('industry_hint', ''), source=f"ashby:{c['slug']}"))
    return out


def fetch_smartrecruiters(c, page=100, cap=500):
    """SmartRecruiters public postings API (no auth). Entry needs: slug (company
    identifier as it appears in jobs.smartrecruiters.com URLs, case-sensitive)."""
    slug = c['slug']
    out, offset = [], 0
    while offset < cap:
        data = http_get_json(
            f'https://api.smartrecruiters.com/v1/companies/{slug}/postings?limit={page}&offset={offset}')
        items = data.get('content') or []
        for j in items:
            loc = j.get('location') or {}
            city = ', '.join(x for x in (loc.get('city'), loc.get('region')) if x) or loc.get('country', '')
            out.append(_posting(c['name'], j.get('name'), city,
                                f"https://jobs.smartrecruiters.com/{slug}/{j.get('id')}",
                                industry_hint=c.get('industry_hint', ''),
                                source=f'smartrecruiters:{slug}'))
        offset += page
        if not items or offset >= int(data.get('totalFound', 0)):
            break
    return out


WD_SEARCHES = ['intern', 'co-op', 'summer analyst', 'student']  # workday search is keyword-based


def fetch_workday(c, page=20, cap=400):
    """Workday tenants expose the same JSON endpoint their own career sites use.
    Entry needs: tenant, host (wd1/wd5/...), site (the board name in the careers URL)."""
    tenant, host, site = c['tenant'], c['host'], c['site']
    base = f'https://{tenant}.{host}.myworkdayjobs.com'
    out, seen = [], set()
    for text in WD_SEARCHES:
        offset = 0
        while offset < cap:
            data = http_post_json(f'{base}/wday/cxs/{tenant}/{site}/jobs',
                                  {'appliedFacets': {}, 'limit': page, 'offset': offset,
                                   'searchText': text})
            jobs = data.get('jobPostings') or []
            for j in jobs:
                path = j.get('externalPath', '')
                if not path or path in seen:
                    continue
                seen.add(path)
                out.append(_posting(c['name'], j.get('title'), j.get('locationsText', ''),
                                    f'{base}/en-US/{site}{path}',
                                    industry_hint=c.get('industry_hint', ''),
                                    source=f'workday:{tenant}'))
            offset += page
            if not jobs or offset >= int(data.get('total', 0)):
                break
    return out


# ---- Community internship lists (the volume sources) ----
# Each group is one list with branch fallbacks; all use the same listings.json format.

LIST_GROUPS = [
    ('simplify', [
        'https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/.github/scripts/listings.json',
        'https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/main/.github/scripts/listings.json',
    ]),
    ('vanshb03', [
        'https://raw.githubusercontent.com/vanshb03/Summer2026-Internships/dev/.github/scripts/listings.json',
        'https://raw.githubusercontent.com/vanshb03/Summer2026-Internships/main/.github/scripts/listings.json',
    ]),
    ('cvrve', [
        'https://raw.githubusercontent.com/cvrve/Summer2026-Internships/dev/.github/scripts/listings.json',
        'https://raw.githubusercontent.com/cvrve/Summer2026-Internships/main/.github/scripts/listings.json',
    ]),
]


def fetch_simplify(max_items=None, log=print):
    """Pull every configured community list; a group that fails just logs."""
    out, seen = [], set()
    for name, urls in LIST_GROUPS:
        data, last_err = None, None
        for url in urls:
            try:
                data = http_get_json(url)
                break
            except Exception as e:  # branch layout changes occasionally; try the next
                last_err = e
        if data is None:
            log(f'  ! list {name} unavailable: {last_err}')
            continue
        added = 0
        for item in data if isinstance(data, list) else []:
            if not item.get('active', False):
                continue
            url = (item.get('url') or '').strip()
            if not url or url in seen:
                continue
            seen.add(url)
            terms = item.get('terms') or []
            locs = item.get('locations') or []
            out.append(_posting(
                item.get('company_name'), item.get('title'),
                ' / '.join(locs[:3]),
                url,
                term_hint=', '.join(terms[:2]),
                source=name,
            ))
            added += 1
            if max_items and len(out) >= max_items:
                return out
        log(f'  list {name}: +{added} active postings')
    if not out:
        raise RuntimeError('no community list reachable')
    return out


WD_JOB_URL = re.compile(
    r'https://([a-z0-9-]+)\.(wd\d+)\.myworkdayjobs\.com/(?:[a-z]{2}-[A-Z]{2}/)?([^/?#]+)(/job/[^?#]+)')


def fetch_workday_jd(url):
    """Full job description for any myworkdayjobs.com posting URL (or None)."""
    m = WD_JOB_URL.match(url or '')
    if not m:
        return None
    t, h, s, path = m.groups()
    data = http_get_json(f'https://{t}.{h}.myworkdayjobs.com/wday/cxs/{t}/{s}{path}')
    return (data.get('jobPostingInfo') or {}).get('jobDescription') or None


ATS_FETCHERS = {'greenhouse': fetch_greenhouse, 'lever': fetch_lever,
                'ashby': fetch_ashby, 'workday': fetch_workday,
                'smartrecruiters': fetch_smartrecruiters}
