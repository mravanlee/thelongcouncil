// One-off backfill: render + STORE every OG card (canonical + per member) for
// ALL existing sessions into Supabase Storage, and write sessions.og_images.
// New sessions do this automatically at creation (pipeline.js storeOgCards).
// Idempotent (x-upsert) — safe to re-run. Run from thelongcouncil/:
//   node scripts/backfill-og-cards.mjs
import fs from 'node:fs';
import { storeOgCards } from '../lib/ogCards.mjs';

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

const res = await fetch(`${SUPA}/rest/v1/sessions?select=slug,member_names&order=created_at.desc`, {
  headers: { apikey: KEY, Authorization: `Bearer ${KEY}` },
});
const sessions = await res.json();
console.log(`Storing OG cards for ${sessions.length} sessions...`);

let done = 0;
let totalCards = 0;
const CONC = 4;
async function worker(list) {
  for (const s of list) {
    if (s.slug) {
      const map = await storeOgCards({
        slug: s.slug,
        memberNames: s.member_names || [],
        supabaseUrl: SUPA,
        serviceKey: KEY,
      });
      totalCards += Object.keys(map).length;
    }
    done++;
    if (done % 20 === 0) console.log(`  ${done}/${sessions.length} sessions (${totalCards} cards stored)`);
  }
}
const chunks = Array.from({ length: CONC }, () => []);
sessions.forEach((s, i) => chunks[i % CONC].push(s));
await Promise.all(chunks.map(worker));
console.log(`Done: ${done} sessions processed, ${totalCards} cards stored.`);
