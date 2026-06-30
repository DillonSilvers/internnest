'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { PRODUCTS, buildSessionParams, createCheckoutSession, retrieveSession } = require('./stripe');

test('PRODUCTS has correct amounts', () => {
  assert.strictEqual(PRODUCTS.premium.amount, 999);
  assert.strictEqual(PRODUCTS.report.amount, 2900);
});

test('buildSessionParams encodes a known product', () => {
  const p = buildSessionParams({ product: 'premium', origin: 'http://localhost:8888' });
  assert.strictEqual(p.get('mode'), 'payment');
  assert.strictEqual(p.get('line_items[0][price_data][unit_amount]'), '999');
  assert.strictEqual(p.get('line_items[0][price_data][currency]'), 'usd');
  assert.strictEqual(p.get('line_items[0][price_data][product_data][name]'), 'InternNest Premium Unlock');
  assert.strictEqual(p.get('line_items[0][quantity]'), '1');
  assert.strictEqual(p.get('metadata[product]'), 'premium');
  assert.match(p.get('success_url'), /session_id=\{CHECKOUT_SESSION_ID\}/);
  assert.match(p.get('success_url'), /paid=premium/);
  assert.strictEqual(p.get('cancel_url'), 'http://localhost:8888/#pricing');
});

test('buildSessionParams rejects an unknown product', () => {
  assert.throws(() => buildSessionParams({ product: 'nope', origin: 'http://x' }), /unknown product/);
});

test('createCheckoutSession posts form body and returns id+url', async () => {
  let captured;
  const fakeFetch = async (url, opts) => {
    captured = { url, opts };
    return { ok: true, json: async () => ({ id: 'cs_test_123', url: 'https://checkout.stripe.com/c/cs_test_123' }) };
  };
  const out = await createCheckoutSession({ secretKey: 'sk_test_x', product: 'report', origin: 'http://localhost:8888', fetchImpl: fakeFetch });
  assert.strictEqual(out.id, 'cs_test_123');
  assert.strictEqual(out.url, 'https://checkout.stripe.com/c/cs_test_123');
  assert.strictEqual(captured.url, 'https://api.stripe.com/v1/checkout/sessions');
  assert.strictEqual(captured.opts.method, 'POST');
  assert.strictEqual(captured.opts.headers.Authorization, 'Bearer sk_test_x');
  assert.match(captured.opts.headers['content-type'], /x-www-form-urlencoded/);
});

test('createCheckoutSession throws on a non-ok response', async () => {
  const fakeFetch = async () => ({ ok: false, status: 400, text: async () => 'bad request' });
  await assert.rejects(
    createCheckoutSession({ secretKey: 'sk_test_x', product: 'premium', origin: 'http://x', fetchImpl: fakeFetch }),
    /stripe 400/
  );
});

test('retrieveSession GETs the session by id', async () => {
  let captured;
  const fakeFetch = async (url, opts) => {
    captured = { url, opts };
    return { ok: true, json: async () => ({ id: 'cs_test_123', payment_status: 'paid', metadata: { product: 'premium' } }) };
  };
  const out = await retrieveSession({ secretKey: 'sk_test_x', sessionId: 'cs_test_123', fetchImpl: fakeFetch });
  assert.strictEqual(out.payment_status, 'paid');
  assert.strictEqual(out.metadata.product, 'premium');
  assert.strictEqual(captured.url, 'https://api.stripe.com/v1/checkout/sessions/cs_test_123');
  assert.strictEqual(captured.opts.method, 'GET');
  assert.strictEqual(captured.opts.headers.Authorization, 'Bearer sk_test_x');
});
