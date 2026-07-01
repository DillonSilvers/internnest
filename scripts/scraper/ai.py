"""AI normalization — turn raw postings into site-schema records.

Uses Claude Haiku (cheap: ~1000 postings for well under $1). Reads
ANTHROPIC_API_KEY from the environment or the repo-root .env. If no key is
available, falls back to keyword heuristics so the pipeline still runs.
"""
import json
import os
import re
import urllib.request
from pathlib import Path

from sources import SSL_CTX

MODEL = 'claude-haiku-4-5-20251001'
BATCH_SIZE = 15

INDUSTRIES = ['Finance', 'Technology', 'Marketing', 'Consulting', 'Healthcare',
              'Sports Business', 'Media & Entertainment', 'Real Estate']
WORK_TYPES = ['Remote', 'Hybrid', 'In-Person']

SYSTEM = f"""You normalize internship postings for a student internship-matching site.
For EACH numbered posting return one JSON object:
{{"index": <n>, "keep": <bool>, "industry": "...", "work_type": "...", "term": "...",
  "location": "...", "required_skills": ["...", ...], "short_description": "..."}}

Rules:
- keep=false for anything that is not a real internship for college students
  (full-time roles, fellowships for PhDs, "internal" roles, ambiguous titles).
- industry MUST be exactly one of: {', '.join(INDUSTRIES)}. If none fits, keep=false.
- work_type MUST be exactly one of: {', '.join(WORK_TYPES)}. Infer from the location
  text ("Remote" in location -> Remote); default In-Person.
- term: like "Summer 2026" / "Fall 2026" / "Rolling". Use the term hint if given.
- location: clean it up, "City, ST" style; keep "Remote" if remote.
- required_skills: 3-5 concrete skills a student would need (e.g. "Excel", "Python",
  "Communication") — inferred from the role title; generic but sensible is fine.
- short_description: one factual sentence (<=25 words) describing the role. Never
  invent specifics you cannot infer from the title/company.
Return ONLY a JSON array with one object per posting, no other text."""


def load_api_key():
    key = os.environ.get('ANTHROPIC_API_KEY', '').strip()
    if key:
        return key
    env_path = Path(__file__).resolve().parents[2] / '.env'
    if env_path.exists():
        for line in env_path.read_text().splitlines():
            m = re.match(r'\s*ANTHROPIC_API_KEY\s*=\s*["\']?([^"\'\s]+)', line)
            if m:
                return m.group(1)
    return ''


def call_claude(api_key, system, user, max_tokens=3500, model=MODEL):
    # no `temperature`: newer models (sonnet-5+) reject it as deprecated
    body = json.dumps({
        'model': model, 'max_tokens': max_tokens,
        'system': system, 'messages': [{'role': 'user', 'content': user}],
    }).encode()
    req = urllib.request.Request(
        'https://api.anthropic.com/v1/messages', data=body, method='POST',
        headers={'x-api-key': api_key, 'anthropic-version': '2023-06-01',
                 'content-type': 'application/json'})
    with urllib.request.urlopen(req, timeout=120, context=SSL_CTX) as res:
        data = json.loads(res.read().decode())
    return ''.join(b.get('text', '') for b in data.get('content', []) if b.get('type') == 'text')


def parse_ai_array(text):
    """Parse the model's JSON array; salvage complete objects if truncated."""
    start = text.find('[')
    if start < 0:
        raise ValueError('no JSON array in model output')
    raw = text[start:]
    try:
        return json.loads(raw[:raw.rfind(']') + 1])
    except (ValueError, json.JSONDecodeError):
        out = []
        for m in re.finditer(r'\{[^{}]*\}', raw):
            try:
                out.append(json.loads(m.group(0)))
            except json.JSONDecodeError:
                pass
        if not out:
            raise
        return out


def _batch_prompt(batch):
    lines = []
    for i, p in enumerate(batch):
        hint = f" | term hint: {p['term_hint']}" if p.get('term_hint') else ''
        ind = f" | industry hint: {p['industry_hint']}" if p.get('industry_hint') else ''
        lines.append(f"{i}. {p['role']} @ {p['company']} | {p['location']}{hint}{ind}")
    return 'POSTINGS:\n' + '\n'.join(lines)


def normalize_with_ai(postings, api_key, log=print):
    """Yield site-schema records for the postings the model says to keep."""
    out = []
    for start in range(0, len(postings), BATCH_SIZE):
        batch = postings[start:start + BATCH_SIZE]
        try:
            text = call_claude(api_key, SYSTEM, _batch_prompt(batch))
            items = parse_ai_array(text)
        except Exception as e:
            log(f'  ! AI batch {start // BATCH_SIZE + 1} failed ({e}) — using heuristics for it')
            out.extend(normalize_heuristic(batch))
            continue
        for item in items:
            try:
                p = batch[int(item['index'])]
            except (KeyError, ValueError, IndexError, TypeError):
                continue
            if not item.get('keep'):
                continue
            if item.get('industry') not in INDUSTRIES or item.get('work_type') not in WORK_TYPES:
                continue
            out.append(build_record(p, item))
        done = min(start + BATCH_SIZE, len(postings))
        log(f'  ai-normalized {done}/{len(postings)} (kept {len(out)})')
    return out


# ---- no-key fallback: crude but keeps the pipeline usable ----

_HEUR = [
    ('Finance', r'финанс|financ|invest|bank|trading|equity|account|audit|wealth|capital'),
    ('Technology', r'software|engineer|developer|\bdata\b|\bit\b|machine learning|\bai\b|cyber|cloud|product manage'),
    ('Marketing', r'market|brand|social media|growth|content|seo|advertis'),
    ('Consulting', r'consult|strategy|advisory'),
    ('Healthcare', r'health|clinic|pharma|biotech|medical|nurse'),
    ('Sports Business', r'sport|athlet|team operations|stadium|league'),
    ('Media & Entertainment', r'media|entertain|film|music|studio|journal|broadcast|gaming'),
    ('Real Estate', r'real estate|property|leasing|realty|construction'),
]


def normalize_heuristic(postings):
    out = []
    for p in postings:
        blob = f"{p['role']} {p['company']} {p.get('industry_hint', '')}".lower()
        industry = next((name for name, pat in _HEUR if re.search(pat, blob)), None)
        if not industry:
            continue
        loc = p['location'] or 'United States'
        work = 'Remote' if re.search(r'remote', loc, re.I) else 'In-Person'
        m = re.search(r'(summer|fall|winter|spring)\s*20\d\d', f"{p['role']} {p.get('term_hint', '')}", re.I)
        term = m.group(0).title() if m else 'Rolling'
        out.append(build_record(p, {
            'industry': industry, 'work_type': work, 'term': term, 'location': loc,
            'required_skills': ['Communication', 'Teamwork', 'Time management'],
            'short_description': f"{p['role']} internship at {p['company']}.",
        }))
    return out


def build_record(posting, fields):
    return {
        'company': posting['company'],
        'role': posting['role'],
        'industry': fields['industry'],
        'location': (fields.get('location') or posting['location'] or '').strip() or 'United States',
        'work_type': fields['work_type'],
        'short_description': str(fields.get('short_description', ''))[:300],
        'required_skills': [str(s) for s in (fields.get('required_skills') or [])][:6],
        'application_url': posting['application_url'],
        'source_url': posting['application_url'],
        'term': str(fields.get('term', 'Rolling'))[:60],
    }
