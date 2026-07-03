// Submit the site's URLs to IndexNow (Bing, Yandex, Seznam, Naver — not Google).
// Reads sitemap.xml at the repo root and pings the IndexNow API with every URL.
//
//   node scripts/indexnow.mjs            # submit all sitemap URLs
//   node scripts/indexnow.mjs <url> ...  # submit only the given URLs
//
// The key file (<KEY>.txt) must already be live at the site root so IndexNow can
// verify ownership. Google ignores IndexNow; it indexes via the sitemap + GSC.
import { readFileSync } from 'node:fs';

const HOST = 'internnest.ai';
const KEY = '19dab1d4c0f64a4888091322bdb92de6b13f0c9c73d9402a99147e292dd0fca1';
const KEY_LOCATION = `https://${HOST}/${KEY}.txt`;

function sitemapUrls() {
  const xml = readFileSync(new URL('../sitemap.xml', import.meta.url), 'utf8');
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1].trim());
}

const urlList = process.argv.slice(2).length ? process.argv.slice(2) : sitemapUrls();
if (!urlList.length) { console.error('no URLs to submit'); process.exit(1); }

const res = await fetch('https://api.indexnow.org/indexnow', {
  method: 'POST',
  headers: { 'content-type': 'application/json; charset=utf-8' },
  body: JSON.stringify({ host: HOST, key: KEY, keyLocation: KEY_LOCATION, urlList }),
});

console.log(`Submitted ${urlList.length} URL(s) to IndexNow -> HTTP ${res.status} ${res.statusText}`);
const body = await res.text();
if (body) console.log(body);
// 200 or 202 = accepted. 403 = key file not found/valid yet (deploy it first).
process.exit(res.ok ? 0 : 1);
