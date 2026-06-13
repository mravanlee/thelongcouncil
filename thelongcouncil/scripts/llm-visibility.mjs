#!/usr/bin/env node
// LLM-vindbaarheid: word je site geciteerd als een LLM (met web search) relevante vragen beantwoordt?
// Vraagt Claude (sonnet) een set vragen die jouw content zou moeten dekken, met web_search aan,
// en kijkt of jouw domein tussen de geciteerde bronnen zit + welke concurrenten wél genoemd worden.
//
// Indicatief, één model (Claude) als proxy — geen exacte meting van ChatGPT/Gemini/Perplexity.
// Reads thelongcouncil/.env.local: ANTHROPIC_API_KEY.  Kost API-tokens + web-search-fees per run.
//
// Run vanuit project root:  node scripts/llm-visibility.mjs   [--model claude-sonnet-4-20250514]

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
readFileSync(join(__dirname, '..', '.env.local'), 'utf-8').split('\n').forEach(line => {
  const t = line.trim(); if (!t || t.startsWith('#')) return; const eq = t.indexOf('='); if (eq < 0) return;
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
});
const KEY = env.ANTHROPIC_API_KEY;
if (!KEY) { console.error('Missing ANTHROPIC_API_KEY in .env.local'); process.exit(1); }
const MODEL = process.argv.includes('--model') ? process.argv[process.argv.indexOf('--model') + 1] : 'claude-sonnet-4-20250514';

// Probe-vragen per site — pas gerust aan/uit te breiden (afgeleid van jullie eigen artikelen/thema's).
const SITES = [
  { domain: 'thelongcouncil.com', label: '🏛️  The Long Council', questions: [
    'Welke lessen uit de geschiedenis gelden voor een land met snel oplopende staatsschuld?',
    'Hoe zouden historische staatslieden denken over het bijdrukken van geld bij hoge schulden?',
  ]},
  { domain: 'longevitywatch.nl', label: '🇳🇱 Longevitywatch NL', questions: [
    'Wat is het verband tussen luchtvervuiling en dementie?',
    'Kan bèta-glucaan een overactief immuunsysteem bij darmziekte temperen?',
    'Hoe versnellen dode hersencellen de veroudering?',
  ]},
  { domain: 'longevity-watch.com', label: '🇬🇧 Longevitywatch EN', questions: [
    'How do aging liver cells help cancer spread?',
    'Can lab-grown miniature brain tissue build cortical layers by itself?',
    'What universal pattern do immune clusters in tumors follow?',
  ]},
];

const stripDom = u => u.replace(/^https?:\/\/(www\.)?/, '').split('/')[0].toLowerCase();
const collectUrls = o => { const out = []; (function w(x){ if (x && typeof x === 'object') { if (typeof x.url === 'string') out.push(x.url); for (const v of Object.values(x)) w(v); } else if (Array.isArray(x)) x.forEach(w); })(o); return out; };

async function ask(q) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({ model: MODEL, max_tokens: 1024, tools: [{ type: 'web_search_20250305', name: 'web_search', max_uses: 3 }], messages: [{ role: 'user', content: q + ' Noem je bronnen.' }] }),
  });
  const d = await res.json();
  if (d.type === 'error') throw new Error(JSON.stringify(d.error).slice(0, 160));
  return [...new Set(collectUrls(d).map(stripDom))];
}

console.log(`\n🤖 LLM-VINDBAARHEID — model: ${MODEL}`);
console.log('   "Word je geciteerd als Claude (met web search) relevante vragen beantwoordt?"\n');

const competitors = {};
for (const site of SITES) {
  let hits = 0;
  console.log(`${site.label}  (${site.domain})`);
  for (const q of site.questions) {
    let doms = [];
    try { doms = await ask(q); } catch (e) { console.log(`   ⚠️ ${q.slice(0, 50)}… — ${e.message}`); continue; }
    const cited = doms.some(d => d.includes(site.domain) || site.domain.includes(d.replace(/\.(com|nl)$/, '')));
    const hit = doms.some(d => d === site.domain || d.endsWith('.' + site.domain));
    if (hit) hits++;
    doms.filter(d => d !== site.domain && !d.endsWith('.' + site.domain)).forEach(d => competitors[d] = (competitors[d] || 0) + 1);
    console.log(`   ${hit ? '✅ geciteerd' : '❌ niet'}   "${q.slice(0, 60)}${q.length > 60 ? '…' : ''}"`);
  }
  console.log(`   → ${hits}/${site.questions.length} vragen waarbij jouw site geciteerd werd\n`);
}

console.log('═══ Wie wordt er WÉL geciteerd (jouw concurrentie in LLM-antwoorden) ═══');
Object.entries(competitors).sort((a, b) => b[1] - a[1]).slice(0, 12).forEach(([d, n]) => console.log(`   ${String(n).padStart(3)}×  ${d}`));
console.log('\nℹ️  Indicatief (alleen Claude). 0 citaties = je content wordt door web search niet bovenaan gevonden →');
console.log('   zelfde hefboom als SEO: meer/diepere content, backlinks, en in Search Console laten indexeren.');
