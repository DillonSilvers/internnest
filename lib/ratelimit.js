'use strict';
const MIN_WINDOW = 60 * 1000, MIN_MAX = 5;
const DAY_WINDOW = 24 * 60 * 60 * 1000, DAY_MAX = 30;

async function checkRateLimit(store, ip, now) {
  const key = 'rl:' + ip;
  let rec;
  try { rec = await store.get(key); } catch (e) { rec = null; }
  if (typeof rec === 'string') { try { rec = JSON.parse(rec); } catch (e) { rec = null; } }
  let hits = (rec && Array.isArray(rec.hits)) ? rec.hits : [];
  hits = hits.filter(t => now - t < DAY_WINDOW);
  const inMinute = hits.filter(t => now - t < MIN_WINDOW).length;
  if (inMinute >= MIN_MAX) return { allowed: false, reason: 'minute' };
  if (hits.length >= DAY_MAX) return { allowed: false, reason: 'day' };
  hits.push(now);
  try { await store.set(key, JSON.stringify({ hits })); } catch (e) { /* fail-open on store errors */ }
  return { allowed: true };
}

module.exports = { checkRateLimit };
