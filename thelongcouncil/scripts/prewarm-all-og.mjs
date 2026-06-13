// One-off backfill: warm every OG card (canonical + per member) for ALL existing
// sessions, so per-member quote shares are never cold on a crawler's first fetch.
// New sessions are warmed automatically at creation (pipeline.js prewarmOgImage);
// this covers everything that already existed. Idempotent — safe to re-run.
// Run from thelongcouncil/: node scripts/prewarm-all-og.mjs
import fs from 'node:fs';

const env = Object.fromEntries(
  fs
    .readFileSync(new URL('../.env.local', import.meta.url), 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=');
      return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')];
    }),
);
const SUPA = env.NEXT_PUBLIC_SUPABASE_URL;
const KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const HOST = 'https://www.thelongcouncil.com';
const stripTier = (n) =>
  String(n || '').replace(/\s*[—–-]\s*(Practitioner|Framer|Leader|Thinker|Wildcard)\s*$/i, '').trim();

const res = await fetch(`${SUPA}/rest/v1/sessions?select=slug,member_names&order=created_at.desc`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
});
const sessions = await res.json();

const urls = [];
for (const s of sessions) {
  if (!s.slug) continue;
  urls.push(`${HOST}/api/og/vs/${s.slug}`);
  for (const n of s.member_names || []) {
    const c = stripTier(n);
    if (c) urls.push(`${HOST}/api/og/vs/${s.slug}?member=${encodeURIComponent(c)}`);
  }
}
console.log(`Warming ${urls.length} cards across ${sessions.length} sessions...`);

let done = 0;
let ok = 0;
const CONC = 6;
async function worker(list) {
  for (const u of list) {
    try {
      const r = await fetch(u, { headers: { 'User-Agent': 'TLC-Prewarm-Backfill/1.0' } });
      await r.arrayBuffer().catch(() => {});
      if (r.status === 200) ok++;
    } catch {
      /* best-effort */
    }
    done++;
    if (done % 50 === 0) console.log(`  ${done}/${urls.length} (HTTP 200: ${ok})`);
  }
}
const chunks = Array.from({ length: CONC }, () => []);
urls.forEach((u, i) => chunks[i % CONC].push(u));
await Promise.all(chunks.map(worker));
console.log(`Done: ${done} fetched, ${ok} returned HTTP 200.`);
