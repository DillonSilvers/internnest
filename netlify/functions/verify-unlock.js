'use strict';
const { retrieveSession } = require('../../lib/stripe');
const { signUnlockToken } = require('../../lib/unlock');

const json = (statusCode, obj) => ({ statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) });
const YEAR_MS = 365 * 24 * 60 * 60 * 1000;

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  let sessionId;
  try {
    sessionId = (JSON.parse(event.body || '{}').session_id || '').toString();
  } catch (e) { return json(400, { error: 'bad JSON' }); }
  if (!sessionId) return json(400, { error: 'missing session_id' });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  const signingSecret = process.env.UNLOCK_SIGNING_SECRET;
  if (!secretKey || !signingSecret) return json(503, { error: 'payments not configured' });

  let session;
  try {
    session = await retrieveSession({ secretKey, sessionId });
  } catch (e) {
    return json(502, { error: 'stripe error' });
  }

  if (!session || session.payment_status !== 'paid') return json(402, { error: 'not paid' });

  const product = (session.metadata && session.metadata.product) || 'premium';
  const now = Date.now();
  const token = signUnlockToken({ product, iat: now, exp: now + YEAR_MS }, signingSecret);
  return json(200, { token, product });
};
