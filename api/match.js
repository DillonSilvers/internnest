'use strict';
const listings = require('../internships.json');
const { prefilter, deterministicRank } = require('../lib/matcher');
const { buildMatchPrompt, parseMatchResponse, callClaude } = require('../lib/claude');

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
  for (const k of ['skills', 'role', 'location', 'companies']) {
    if (typeof profile[k] === 'string') profile[k] = profile[k].slice(0, 500);
  }

  const candidates = prefilter(profile, listings);
  if (candidates.length === 0) return res.status(200).json({ matches: [], mode: 'empty' });

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    const aiCandidates = candidates.slice(0, 8);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 9000);
    try {
      const { system, user } = buildMatchPrompt(profile, aiCandidates);
      const text = await callClaude({ apiKey, system, user, signal: controller.signal });
      const matches = parseMatchResponse(text, aiCandidates);
      clearTimeout(timer);
      return res.status(200).json({ matches, mode: 'ai' });
    } catch (e) {
      clearTimeout(timer);
      // fall through to deterministic ranking
    }
  }
  return res.status(200).json({ matches: deterministicRank(profile, candidates), mode: 'fallback' });
};
