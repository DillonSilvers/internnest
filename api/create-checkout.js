'use strict';
const { createCheckoutSession, PRODUCTS } = require('../lib/stripe');

function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  try { return JSON.parse(req.body || '{}'); } catch (e) { return null; }
}

module.exports = async (req, res) => {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });

  const body = readBody(req);
  if (body === null) return res.status(400).json({ error: 'bad JSON' });
  const product = (body.product || '').toString();
  if (!PRODUCTS[product]) return res.status(400).json({ error: 'unknown product' });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return res.status(503).json({ error: 'payments not configured' });

  const proto = (req.headers['x-forwarded-proto'] || 'https');
  const host = req.headers.host || req.headers['x-forwarded-host'];
  const origin = req.headers.origin || `${proto}://${host}`;

  try {
    const { url } = await createCheckoutSession({ secretKey, product, origin });
    return res.status(200).json({ url });
  } catch (e) {
    return res.status(502).json({ error: 'stripe error' });
  }
};
