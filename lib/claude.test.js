const { test } = require('node:test');
const assert = require('node:assert');
const { buildMatchPrompt, parseMatchResponse } = require('./claude');

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
