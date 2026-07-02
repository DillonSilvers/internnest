'use strict';
const listings = require('../internships.json');
const { prefilter, deterministicRank } = require('../lib/matcher');
const { buildMatchPrompt, parseMatchResponse, callClaude, modelFor } = require('../lib/claude');
const { verifyUnlockToken } = require('../lib/unlock');

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return null; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const body = readBody(req);
  if (body === null) return res.status(400).json({ error: 'bad JSON' });
  const profile = body.profile || body;
  if (!profile || !profile.industry) return res.status(400).json({ error: 'missing industry' });
  for (const k of ['skills', 'role', 'location', 'companies', 'experience']) {
    if (typeof profile[k] === 'string') profile[k] = profile[k].slice(0, 500);
  }
  if (profile.gpa != null) profile.gpa = String(profile.gpa).slice(0, 8);

  // Premium accounts (proven by a valid signed unlock token) get the higher-quality model.
  const premium = !!verifyUnlockToken(body.token, process.env.UNLOCK_SIGNING_SECRET, Date.now());
  const tier = premium ? 'premium' : 'free';

  const candidates = prefilter(profile, listings);
  if (candidates.length === 0) return res.status(200).json({ matches: [], mode: 'empty', tier });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const aiCandidates = candidates.slice(0, 8);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), premium ? 20000 : 15000);
    try {
      const { system, user } = buildMatchPrompt(profile, aiCandidates);
      const text = await callClaude({ apiKey, system, user, model: modelFor(premium), signal: controller.signal });
      const matches = parseMatchResponse(text, aiCandidates);
      clearTimeout(timer);
      return res.status(200).json({ matches, mode: 'ai', tier });
    } catch (e) {
      clearTimeout(timer);
      // fall through to deterministic ranking
    }
  }
  return res.status(200).json({ matches: deterministicRank(profile, candidates), mode: 'fallback', tier });
};
