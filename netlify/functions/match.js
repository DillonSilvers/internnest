'use strict';
const { getStore } = require('@netlify/blobs');
const listings = require('../../internships.json');
const { prefilter, deterministicRank } = require('../../lib/matcher');
const { buildMatchPrompt, parseMatchResponse, callClaude } = require('../../lib/claude');
const { checkRateLimit } = require('../../lib/ratelimit');

const json = (statusCode, obj) => ({ statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  let profile;
  try {
    const body = JSON.parse(event.body || '{}');
    profile = body.profile || body;
  } catch (e) { return json(400, { error: 'bad JSON' }); }
  if (!profile || !profile.industry) return json(400, { error: 'missing industry' });
  for (const k of ['skills', 'role', 'location', 'companies']) {
    if (typeof profile[k] === 'string') profile[k] = profile[k].slice(0, 500);
  }

  const ip = (event.headers['x-nf-client-connection-ip'] || event.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  try {
    const store = getStore('ratelimit');
    const rl = await checkRateLimit(store, ip, Date.now());
    if (!rl.allowed) return json(429, { error: 'rate limited, try again shortly' });
  } catch (e) { /* if Blobs unavailable locally, fail open */ }

  const candidates = prefilter(profile, listings);
  if (candidates.length === 0) return json(200, { matches: [], mode: 'empty' });

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
      return json(200, { matches, mode: 'ai' });
    } catch (e) {
      clearTimeout(timer);
      // fall through to deterministic ranking
    }
  }
  return json(200, { matches: deterministicRank(profile, candidates), mode: 'fallback' });
};
