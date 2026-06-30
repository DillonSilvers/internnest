const { test } = require('node:test');
const assert = require('node:assert');
const { prefilter, toCard, deterministicRank } = require('./matcher');

const listings = [
  { company: 'A', role: 'Finance Intern', industry: 'Finance', location: 'New York, NY', work_type: 'In-Person', required_skills: ['Excel'], application_url: 'https://a.test', term: 'Rolling' },
  { company: 'B', role: 'SWE Intern', industry: 'Technology', location: 'Remote', work_type: 'Remote', required_skills: ['JS'], application_url: 'https://b.test', term: 'Rolling' },
  { company: 'C', role: 'Analyst', industry: 'Finance', location: 'Boston, MA', work_type: 'Hybrid', required_skills: ['SQL'], application_url: 'https://c.test', term: 'Rolling' },
];

test('prefilter keeps the chosen industry', () => {
  const out = prefilter({ industry: 'Finance', location: 'New York', worktype: 'any' }, listings);
  assert.ok(out.every(l => l.industry === 'Finance' || l.work_type === 'Remote'));
  assert.ok(out.some(l => l.company === 'A'));
});

test('prefilter caps at 15', () => {
  const many = Array.from({ length: 40 }, (_, i) => ({ ...listings[0], company: 'co' + i }));
  assert.equal(prefilter({ industry: 'Finance', location: '', worktype: 'any' }, many).length, 15);
});

test('remote preference pulls in cross-industry remote roles', () => {
  const out = prefilter({ industry: 'Finance', location: '', worktype: 'remote' }, listings);
  assert.ok(out.some(l => l.company === 'B'));
});

test('toCard maps fields for buildCard', () => {
  const card = toCard(listings[0], { score: 90, why: 'fits', missing: ['x'], tip: 'do y', outreach: 'hi' });
  assert.equal(card.title, 'Finance Intern');
  assert.equal(card.type, 'In-Person');
  assert.equal(card.application_url, 'https://a.test');
  assert.equal(card.score, 90);
  assert.equal(typeof card.outreach, 'string');
});

test('deterministicRank returns scored cards sorted desc', () => {
  const cards = deterministicRank({ industry: 'Finance', location: 'New York', worktype: 'any', skills: 'Excel' }, listings.filter(l => l.industry === 'Finance'));
  assert.ok(cards.length >= 1);
  assert.ok(cards[0].score >= cards[cards.length - 1].score);
  assert.ok(cards[0].why && cards[0].tip);
});
