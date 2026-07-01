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


def http_get_json(url, timeout=20):
    wait = THROTTLE_S - (time.time() - _last_fetch[0])
    if wait > 0:
        time.sleep(wait)
    req = urllib.request.Request(url, headers={'User-Agent': UA, 'Accept': 'application/json'})
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


# ---- ATS connectors (per-company "reps": add slugs to companies.json) ----

def fetch_greenhouse(slug, name, industry_hint=''):
    data = http_get_json(f'https://boards-api.greenhouse.io/v1/boards/{slug}/jobs')
    out = []
    for j in data.get('jobs', []):
        loc = (j.get('location') or {}).get('name', '')
        out.append(_posting(name, j.get('title'), loc, j.get('absolute_url'),
                            industry_hint=industry_hint, source=f'greenhouse:{slug}'))
    return out


def fetch_lever(slug, name, industry_hint=''):
    data = http_get_json(f'https://api.lever.co/v0/postings/{slug}?mode=json')
    out = []
    for j in data if isinstance(data, list) else []:
        cats = j.get('categories') or {}
        out.append(_posting(name, j.get('text'), cats.get('location', ''), j.get('hostedUrl'),
                            term_hint=cats.get('commitment', ''),
                            industry_hint=industry_hint, source=f'lever:{slug}'))
    return out


def fetch_ashby(slug, name, industry_hint=''):
    data = http_get_json(f'https://api.ashbyhq.com/posting-api/job-board/{slug}')
    out = []
    for j in data.get('jobs', []):
        out.append(_posting(name, j.get('title'), j.get('location', ''),
                            j.get('jobUrl') or j.get('applyUrl'),
                            industry_hint=industry_hint, source=f'ashby:{slug}'))
    return out


# ---- SimplifyJobs open-source internship list (the volume source) ----

SIMPLIFY_URLS = [
    'https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/dev/.github/scripts/listings.json',
    'https://raw.githubusercontent.com/SimplifyJobs/Summer2026-Internships/main/.github/scripts/listings.json',
]


def fetch_simplify(max_items=None):
    data = None
    last_err = None
    for url in SIMPLIFY_URLS:
        try:
            data = http_get_json(url)
            break
        except Exception as e:  # branch layout changes occasionally; try the next
            last_err = e
    if data is None:
        raise RuntimeError(f'SimplifyJobs list unavailable: {last_err}')
    out = []
    for item in data:
        if not item.get('active', False):
            continue
        terms = item.get('terms') or []
        locs = item.get('locations') or []
        out.append(_posting(
            item.get('company_name'), item.get('title'),
            ' / '.join(locs[:3]),
            item.get('url'),
            term_hint=', '.join(terms[:2]),
            source='simplify',
        ))
        if max_items and len(out) >= max_items:
            break
    return out


ATS_FETCHERS = {'greenhouse': fetch_greenhouse, 'lever': fetch_lever, 'ashby': fetch_ashby}
