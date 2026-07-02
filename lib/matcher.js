'use strict';

function cityOf(loc) {
  return String(loc || '').split('/')[0].split(',')[0].trim().toLowerCase();
}

// Ultra-selective employers where GPA is a real gate (Dillon's ask: a 2.5 shouldn't be shown Goldman).
const ELITE = [
  'goldman', 'blackrock', 'morgan stanley', 'jpmorgan', 'jp morgan', 'j.p. morgan', 'blackstone',
  'citadel', 'jane street', 'two sigma', 'point72', 'kkr', 'evercore', 'centerview', 'de shaw',
  'd. e. shaw', 'mckinsey', 'bain', 'boston consulting', 'bcg', 'google', 'meta', 'nvidia', 'openai', 'apple',
];
function isEliteCompany(name) {
  const n = String(name || '').toLowerCase();
  return ELITE.some(k => n.includes(k));
}
// Parse a GPA on a 0-4.5 scale; returns null if absent/unusable so scoring stays unchanged.
function parseGpa(v) {
  const g = parseFloat(v);
  return (!isNaN(g) && g > 0 && g <= 4.5) ? g : null;
}

// Score a listing's *surface* fit (used for pre-ranking + the no-AI fallback).
function fitScore(profile, l) {
  let s = 70;
  const userLoc = String(profile.location || '').toLowerCase();
  const city = cityOf(l.location);
  if (city && userLoc.includes(city)) s += 8;
  if (profile.worktype === 'remote' && l.work_type === 'Remote') s += 6;
  if (profile.worktype === 'remote' && l.work_type !== 'Remote') s -= 10;
  if (profile.worktype === 'onsite' && l.work_type === 'Remote') s -= 6;
  const skills = String(profile.skills || '').toLowerCase();
  const overlap = (l.required_skills || []).filter(k => skills.includes(String(k).toLowerCase())).length;
  s += Math.min(12, overlap * 4);

  const gpa = parseGpa(profile.gpa);

  // Hard eligibility gates from enriched listings (stated requirements in the JD).
  if (gpa !== null && typeof l.gpa_min === 'number' && gpa < l.gpa_min) return 6;
  if (profile.year && Array.isArray(l.class_years) && l.class_years.length
      && !l.class_years.includes(profile.year)) return 6;

  // GPA gate for the most selective firms.
  if (gpa !== null && isEliteCompany(l.company)) {
    if (gpa < 3.0) return 8;          // hard down-rank: sinks below every normal listing
    if (gpa < 3.3) s -= 22;
    else if (gpa < 3.5) s -= 8;
    else if (gpa >= 3.8) s += 4;      // strong GPA earns a slight edge at top firms
  }
  return Math.max(50, Math.min(98, s));
}

function prefilter(profile, listings) {
  const inIndustry = listings.filter(l => l.industry === profile.industry);
  let pool = inIndustry;
  // Backfill thin industries with cross-industry remote/rolling roles.
  if (inIndustry.length < 3 || profile.worktype === 'remote') {
    const extra = listings.filter(l => l.industry !== profile.industry && (l.work_type === 'Remote' || /rolling/i.test(l.term || '')));
    pool = inIndustry.concat(extra);
  }
  // De-dup, rank by surface fit, cap at 15.
  const seen = new Set();
  return pool
    .filter(l => { const k = l.company + '|' + l.role; if (seen.has(k)) return false; seen.add(k); return true; })
    .map(l => ({ l, s: fitScore(profile, l) }))
    .sort((a, b) => b.s - a.s)
    .slice(0, 15)
    .map(x => x.l);
}

function toCard(listing, fields) {
  return {
    id: (listing.company + '-' + listing.role).replace(/[^a-z0-9]+/gi, '-').toLowerCase().slice(0, 60),
    title: listing.role,
    company: listing.company,
    location: listing.location,
    type: listing.work_type,
    application_url: listing.application_url,
    term: listing.term,
    score: fields.score,
    why: fields.why,
    missing: fields.missing || [],
    tip: fields.tip || '',
    outreach: fields.outreach || '',
  };
}

function deterministicRank(profile, candidates) {
  const name = (profile.name || 'there').trim();
  const known = String(profile.skills || '').toLowerCase();
  return candidates
    .map(l => {
      const score = fitScore(profile, l);
      return toCard(l, {
        score,
        why: `Matches your interest in ${l.industry}: a ${l.role} role at ${l.company} (${l.location}).`,
        // never tell someone to learn a skill they already listed
        missing: (l.required_skills || []).filter(k => !known.includes(String(k).toLowerCase())).slice(0, 3),
        tip: `Tailor your resume to highlight ${(l.required_skills || []).slice(0, 2).join(' and ') || 'relevant skills'}, then apply directly.`,
        outreach: `Hi,\n\nI'm ${name} and I'm very interested in the ${l.role} role at ${l.company}. I'd love to learn more and share why I'd be a strong fit.\n\nBest,\n${name}`,
      });
    })
    .sort((a, b) => b.score - a.score);
}

module.exports = { prefilter, toCard, deterministicRank, fitScore, isEliteCompany };
