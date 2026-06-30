'use strict';
const test = require('node:test');
const assert = require('node:assert');
const { signUnlockToken, verifyUnlockToken } = require('./unlock');

const SECRET = 'test-signing-secret-0123456789';

test('sign then verify round-trips the payload', () => {
  const now = 1_000_000;
  const token = signUnlockToken({ product: 'premium', exp: now + 5000 }, SECRET);
  const payload = verifyUnlockToken(token, SECRET, now);
  assert.strictEqual(payload.product, 'premium');
});

test('verify rejects a tampered body', () => {
  const now = 1_000_000;
  const token = signUnlockToken({ product: 'premium', exp: now + 5000 }, SECRET);
  const [body, sig] = token.split('.');
  const forged = Buffer.from(JSON.stringify({ product: 'report', exp: now + 5000 })).toString('base64url');
  assert.strictEqual(verifyUnlockToken(`${forged}.${sig}`, SECRET, now), null);
});

test('verify rejects a wrong secret', () => {
  const now = 1_000_000;
  const token = signUnlockToken({ product: 'premium', exp: now + 5000 }, SECRET);
  assert.strictEqual(verifyUnlockToken(token, 'other-secret', now), null);
});

test('verify rejects an expired token', () => {
  const now = 1_000_000;
  const token = signUnlockToken({ product: 'premium', exp: now - 1 }, SECRET);
  assert.strictEqual(verifyUnlockToken(token, SECRET, now), null);
});

test('verify returns null on malformed input instead of throwing', () => {
  assert.strictEqual(verifyUnlockToken('garbage', SECRET, 1), null);
  assert.strictEqual(verifyUnlockToken('', SECRET, 1), null);
  assert.strictEqual(verifyUnlockToken('a.b.c', SECRET, 1), null);
});
