'use strict';
const { toCard } = require('./matcher');

// Free tier uses the fast model; Premium accounts get the higher-quality model.
const MODELS = { free: 'claude-haiku-4-5-20251001', premium: 'claude-opus-4-8' };
function modelFor(premium) { return premium ? MODELS.premium : MODELS.free; }

const SYSTEM = `You are an expert internship-matching assistant for college students.
You will be given a student's profile and a numbered list of REAL internships.
Score how well EACH internship fits the student (0-100), and for each return a short reason
(1 sentence), 2-3 concrete missing skills the student should build, and a one-line application tip.
Weigh the student's GPA and prior experience realistically: for highly selective employers (top-tier
banks, consulting, big tech), a low GPA or no relevant experience should lower the fit score, while a
strong GPA and relevant experience should raise it.
Be concise. Only use the internships provided - never invent companies, roles, or URLs.
Return ONLY a JSON array, one object per internship you were given, each:
{"index": <number>, "score": <0-100>, "why": "...", "missing": ["...","..."], "tip": "..."}`;

// Stated requirements pulled from the posting's JD (enrichment) — shown so the model
// can weigh real eligibility, not guess it.
function eligibilityNote(c) {
  const bits = [];
  if (typeof c.gpa_min === 'number') bits.push(`min GPA ${c.gpa_min}`);
  if (Array.isArray(c.class_years) && c.class_years.length) bits.push(`for ${c.class_years.join('/')}s`);
  if (c.sponsorship === 'no') bits.push('no visa sponsorship');
  if (c.sponsorship === 'yes') bits.push('sponsors visas');
  if (c.paid === true) bits.push('paid');
  if (c.paid === false) bits.push('unpaid');
  if (c.deadline) bits.push(`apply by ${c.deadline}`);
  return bits.length ? ` | reqs: ${bits.join(', ')}` : '';
}

function buildMatchPrompt(profile, candidates, hasResume) {
  const list = candidates.map((c, i) =>
    `${i}. ${c.role} @ ${c.company} | ${c.industry} | ${c.location} | ${c.work_type} | skills: ${(c.required_skills || []).join(', ')}${eligibilityNote(c)}`
  ).join('\n');
  const user = `STUDENT PROFILE
Name: ${profile.name || 'Student'}
School: ${profile.school || ''}
Major: ${profile.major || ''}
Year: ${profile.year || ''}
GPA: ${profile.gpa || 'n/a'}
Target industry: ${profile.industry || ''}
Target role: ${profile.role || ''}
Preferred location: ${profile.location || ''}
Work preference: ${profile.worktype || 'any'}
Skills: ${profile.skills || ''}
Prior experience in field: ${profile.experience || 'none stated'}
Target companies: ${profile.companies || ''}

INTERNSHIPS (score every one, keep the index):
${list}`;
  const resumeNote = hasResume
    ? `\n\nRESUME: the student's resume is attached as a document. Read it. Trust the resume over the
form fields when they conflict, and use its specific experience and skills when scoring, listing
missing skills, and writing tips.`
    : '';
  return { system: SYSTEM, user: user + resumeNote };
}

// With a resume attached, the user turn becomes [pdf document, text]; plain text otherwise.
function buildUserContent(user, resume) {
  if (!resume || !resume.data) return user;
  return [
    { type: 'document', source: { type: 'base64', media_type: 'application/pdf', data: resume.data } },
    { type: 'text', text: user },
  ];
}

function parseMatchResponse(text, candidates) {
  const start = String(text).indexOf('[');
  if (start < 0) throw new Error('no JSON array in model output');
  const raw = String(text).slice(start);
  let arr;
  try {
    arr = JSON.parse(raw.slice(0, raw.lastIndexOf(']') + 1));
  } catch (e) {
    // Salvage complete top-level objects if the array was truncated.
    arr = [];
    const objRe = /\{[^{}]*\}/g; let mm;
    while ((mm = objRe.exec(raw))) { try { arr.push(JSON.parse(mm[0])); } catch (e2) { /* skip partial */ } }
  }
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
    }));
  }
  if (cards.length === 0) throw new Error('no candidates matched model indices');
  return cards.sort((a, b) => b.score - a.score);
}

async function callClaude({ apiKey, system, user, resume, model = MODELS.free, maxTokens = 750, signal }) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    signal,
    headers: {
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
      'content-type': 'application/json',
    },
    body: JSON.stringify({ model, max_tokens: maxTokens, system,
      messages: [{ role: 'user', content: buildUserContent(user, resume) }] }),
  });
  if (!res.ok) throw new Error('anthropic ' + res.status + ': ' + (await res.text()).slice(0, 200));
  const data = await res.json();
  return (data.content || []).filter(b => b.type === 'text').map(b => b.text).join('');
}

module.exports = { buildMatchPrompt, parseMatchResponse, callClaude, buildUserContent, SYSTEM, MODELS, modelFor };
