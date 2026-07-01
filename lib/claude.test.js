const { test } = require('node:test');
const assert = require('node:assert');
const { buildMatchPrompt, parseMatchResponse, modelFor, MODELS } = require('./claude');

const candidates = [
  { company: 'A', role: 'Finance Intern', industry: 'Finance', location: 'NYC', work_type: 'In-Person', required_skills: ['Excel'], application_url: 'https://a.test', term: 'Rolling' },
  { company: 'B', role: 'SWE Intern', industry: 'Technology', location: 'Remote', work_type: 'Remote', required_skills: ['JS'], application_url: 'https://b.test', term: 'Rolling' },
];

test('buildMatchPrompt includes the candidates and the profile', () => {
  const { system, user } = buildMatchPrompt({ industry: 'Finance', skills: 'Excel' }, candidates);
  assert.match(system, /internship/i);
  assert.match(user, /Finance Intern/);
  assert.match(user, /Excel/);
});

test('parseMatchResponse merges model scores with real listing data', () => {
  const text = '```json\n[{"index":0,"score":92,"why":"great fit","missing":["m"],"tip":"t","outreach":"hi"}]\n```';
  const cards = parseMatchResponse(text, candidates);
  assert.equal(cards.length, 1);
  assert.equal(cards[0].company, 'A');
  assert.equal(cards[0].application_url, 'https://a.test');
  assert.equal(cards[0].score, 92);
  assert.equal(cards[0].why, 'great fit');
});

test('parseMatchResponse throws on unparseable output', () => {
  assert.throws(() => parseMatchResponse('not json at all', candidates));
});

test('buildMatchPrompt includes GPA and prior experience when provided', () => {
  const { user } = buildMatchPrompt({ industry: 'Finance', gpa: '3.8', experience: 'summer analyst at a boutique' }, candidates);
  assert.match(user, /GPA: 3\.8/);
  assert.match(user, /summer analyst at a boutique/);
});

test('buildMatchPrompt surfaces enriched eligibility requirements', () => {
  const enriched = [{ ...candidates[0], gpa_min: 3.5, class_years: ['Junior'], sponsorship: 'no', paid: true, deadline: '2026-10-01' }];
  const { user } = buildMatchPrompt({ industry: 'Finance' }, enriched);
  assert.match(user, /min GPA 3\.5/);
  assert.match(user, /for Juniors/);
  assert.match(user, /no visa sponsorship/);
  assert.match(user, /apply by 2026-10-01/);
});

test('modelFor picks the premium model only for premium', () => {
  assert.equal(modelFor(true), MODELS.premium);
  assert.equal(modelFor(false), MODELS.free);
  assert.notEqual(MODELS.premium, MODELS.free);
});
