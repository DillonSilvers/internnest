'use strict';

const PRODUCTS = {
  premium: { amount: 999, name: 'InternNest Premium Unlock' },
  report: { amount: 2900, name: 'InternNest Match Report' },
};

function buildSessionParams({ product, origin }) {
  const p = PRODUCTS[product];
  if (!p) throw new Error('unknown product');
  const params = new URLSearchParams();
  params.set('mode', 'payment');
  params.set('line_items[0][quantity]', '1');
  params.set('line_items[0][price_data][currency]', 'usd');
  params.set('line_items[0][price_data][unit_amount]', String(p.amount));
  params.set('line_items[0][price_data][product_data][name]', p.name);
  params.set('metadata[product]', product);
  params.set('success_url', `${origin}/?paid=${product}&session_id={CHECKOUT_SESSION_ID}`);
  params.set('cancel_url', `${origin}/#pricing`);
  return params;
}

async function createCheckoutSession({ secretKey, product, origin, fetchImpl = fetch }) {
  const body = buildSessionParams({ product, origin });
  const res = await fetchImpl('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secretKey}`,
      'content-type': 'application/x-www-form-urlencoded',
    },
    body: body.toString(),
  });
  if (!res.ok) throw new Error('stripe ' + res.status + ': ' + (await res.text()).slice(0, 200));
  const data = await res.json();
  return { id: data.id, url: data.url };
}

async function retrieveSession({ secretKey, sessionId, fetchImpl = fetch }) {
  const res = await fetchImpl('https://api.stripe.com/v1/checkout/sessions/' + encodeURIComponent(sessionId), {
    method: 'GET',
    headers: { Authorization: `Bearer ${secretKey}` },
  });
  if (!res.ok) throw new Error('stripe ' + res.status + ': ' + (await res.text()).slice(0, 200));
  return res.json();
}

module.exports = { PRODUCTS, buildSessionParams, createCheckoutSession, retrieveSession };
