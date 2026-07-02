const { test } = require('node:test');
const assert = require('node:assert');
const { prefilter, toCard, deterministicRank, fitScore, isEliteCompany } = require('./matcher');

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

test('isEliteCompany flags top-tier firms only', () => {
  assert.ok(isEliteCompany('Goldman Sachs'));
  assert.ok(isEliteCompany('BlackRock'));
  assert.ok(!isEliteCompany('BrightLabs'));
});

test('low GPA hard down-ranks elite firms below normal listings', () => {
  const profile = { industry: 'Finance', location: '', worktype: 'any', gpa: '2.5' };
  const elite = { company: 'Goldman Sachs', role: 'IB Intern', industry: 'Finance', location: 'New York, NY', work_type: 'In-Person', required_skills: [] };
  const normal = { company: 'BrightLabs', role: 'Finance Intern', industry: 'Finance', location: 'New York, NY', work_type: 'In-Person', required_skills: [] };
  assert.ok(fitScore(profile, elite) < fitScore(profile, normal), 'elite should rank below a normal listing for a low GPA');
});

test('strong GPA does not penalize elite firms', () => {
  const elite = { company: 'Goldman Sachs', role: 'IB Intern', industry: 'Finance', location: 'New York, NY', work_type: 'In-Person', required_skills: [] };
  const strong = fitScore({ industry: 'Finance', location: '', worktype: 'any', gpa: '3.9' }, elite);
  const low = fitScore({ industry: 'Finance', location: '', worktype: 'any', gpa: '2.5' }, elite);
  assert.ok(strong > low, 'a 3.9 GPA should score an elite firm higher than a 2.5');
});

test('no GPA leaves elite scoring unchanged (backward compatible)', () => {
  const elite = { company: 'Goldman Sachs', role: 'IB Intern', industry: 'Finance', location: 'New York, NY', work_type: 'In-Person', required_skills: [] };
  const baseline = fitScore({ industry: 'Finance', location: '', worktype: 'any' }, elite);
  assert.equal(baseline, 70, 'without a GPA, elite firms keep the neutral base score');
});

test('a stated gpa_min gates students below it', () => {
  const listing = { company: 'SpaceX', role: 'Ops Intern', industry: 'Technology', location: 'Hawthorne, CA', work_type: 'In-Person', required_skills: [], gpa_min: 3.5 };
  const below = fitScore({ industry: 'Technology', location: '', worktype: 'any', gpa: '3.2' }, listing);
  const above = fitScore({ industry: 'Technology', location: '', worktype: 'any', gpa: '3.7' }, listing);
  const none = fitScore({ industry: 'Technology', location: '', worktype: 'any' }, listing);
  assert.ok(below < 50, 'below the stated minimum should sink out of range');
  assert.ok(above >= 50 && none >= 50, 'meeting the minimum (or no GPA given) scores normally');
});

test('class_years restriction gates ineligible years', () => {
  const listing = { company: 'Anduril', role: 'SWE Intern', industry: 'Technology', location: 'Costa Mesa, CA', work_type: 'In-Person', required_skills: [], class_years: ['Junior'] };
  const frosh = fitScore({ industry: 'Technology', location: '', worktype: 'any', year: 'Freshman' }, listing);
  const junior = fitScore({ industry: 'Technology', location: '', worktype: 'any', year: 'Junior' }, listing);
  const unstated = fitScore({ industry: 'Technology', location: '', worktype: 'any' }, listing);
  assert.ok(frosh < 50, 'ineligible year should sink');
  assert.ok(junior >= 50 && unstated >= 50);
});

test('deterministicRank never lists a skill the student already has as missing', () => {
  const cards = deterministicRank(
    { industry: 'Finance', location: '', worktype: 'any', skills: 'Excel, SQL' },
    [{ company: 'A', role: 'Analyst Intern', industry: 'Finance', location: 'Boston, MA', work_type: 'Hybrid',
       required_skills: ['Excel', 'SQL', 'PowerPoint', 'Writing'], application_url: 'https://a.test', term: 'Rolling' }]);
  assert.deepEqual(cards[0].missing, ['PowerPoint', 'Writing']);
});

test('deterministicRank returns scored cards sorted desc', () => {
  const cards = deterministicRank({ industry: 'Finance', location: 'New York', worktype: 'any', skills: 'Excel' }, listings.filter(l => l.industry === 'Finance'));
  assert.ok(cards.length >= 1);
  assert.ok(cards[0].score >= cards[cards.length - 1].score);
  assert.ok(cards[0].why && cards[0].tip);
});
