'use strict';
const crypto = require('node:crypto');

function b64url(buf) { return Buffer.from(buf).toString('base64url'); }

function hmac(body, secret) {
  return crypto.createHmac('sha256', secret).update(body).digest('base64url');
}

function signUnlockToken(payload, secret) {
  const body = b64url(JSON.stringify(payload));
  return `${body}.${hmac(body, secret)}`;
}

function verifyUnlockToken(token, secret, now) {
  try {
    if (typeof token !== 'string') return null;
    const parts = token.split('.');
    if (parts.length !== 2) return null;
    const [body, sig] = parts;
    const expected = hmac(body, secret);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(Buffer.from(body, 'base64url').toString('utf8'));
    if (!payload || typeof payload.exp !== 'number' || payload.exp <= now) return null;
    return payload;
  } catch (e) {
    return null;
  }
}

module.exports = { signUnlockToken, verifyUnlockToken };
