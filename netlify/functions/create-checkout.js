'use strict';
const { createCheckoutSession, PRODUCTS } = require('../../lib/stripe');

const json = (statusCode, obj) => ({ statusCode, headers: { 'content-type': 'application/json' }, body: JSON.stringify(obj) });

exports.handler = async (event) => {
  if (event.httpMethod !== 'POST') return json(405, { error: 'POST only' });

  let product;
  try {
    product = (JSON.parse(event.body || '{}').product || '').toString();
  } catch (e) { return json(400, { error: 'bad JSON' }); }
  if (!PRODUCTS[product]) return json(400, { error: 'unknown product' });

  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) return json(503, { error: 'payments not configured' });

  // Origin to build the return URLs; fall back to the site host header.
  const proto = (event.headers['x-forwarded-proto'] || 'https');
  const host = event.headers.host || event.headers['x-forwarded-host'];
  const origin = event.headers.origin || `${proto}://${host}`;

  try {
    const { url } = await createCheckoutSession({ secretKey, product, origin });
    return json(200, { url });
  } catch (e) {
    return json(502, { error: 'stripe error' });
  }
};
