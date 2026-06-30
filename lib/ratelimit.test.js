const { test } = require('node:test');
const assert = require('node:assert');
const { checkRateLimit } = require('./ratelimit');

function memStore() {
  const m = new Map();
  return { async get(k) { return m.get(k); }, async set(k, v) { m.set(k, v); } };
}

test('allows under the per-minute limit', async () => {
  const s = memStore(); const now = 1_000_000;
  for (let i = 0; i < 5; i++) {
    const r = await checkRateLimit(s, '1.1.1.1', now + i * 1000);
    assert.equal(r.allowed, true);
  }
});

test('blocks the 6th request within a minute', async () => {
  const s = memStore(); const now = 2_000_000;
  for (let i = 0; i < 5; i++) await checkRateLimit(s, '2.2.2.2', now + i * 100);
  const r = await checkRateLimit(s, '2.2.2.2', now + 600);
  assert.equal(r.allowed, false);
});

test('separate IPs are independent', async () => {
  const s = memStore(); const now = 3_000_000;
  for (let i = 0; i < 5; i++) await checkRateLimit(s, '3.3.3.3', now + i * 100);
  const r = await checkRateLimit(s, '4.4.4.4', now + 600);
  assert.equal(r.allowed, true);
});
