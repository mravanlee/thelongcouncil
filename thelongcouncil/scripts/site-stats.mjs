#!/usr/bin/env node
// Website stats voor alle 3 sites: Cloudflare Web Analytics (verkeer/bronnen/prestaties)
// + optioneel Google Search Console (échte Google-vindbaarheid: impressies/positie/zoektermen).
// Sites: thelongcouncil.com + longevitywatch.nl + longevity-watch.com (één CF-account).
//
// Reads thelongcouncil/.env.local:
//   CLOUDFLARE_ANALYTICS_TOKEN   (scope: Account Analytics:Read)   — verplicht
//   CLOUDFLARE_ACCOUNT_ID                                          — verplicht
//   GSC_SERVICE_ACCOUNT_JSON     (pad naar Google service-account .json)  — optioneel (Google-vindbaarheid)
//   GSC_SITES                    (comma-lijst GSC-properties, default sc-domain:<host>) — optioneel
//
// Run vanuit project root:
//   node scripts/site-stats.mjs              # 30 dagen
//   node scripts/site-stats.mjs --days 7
//
// LET OP (Cloudflare is cookieloos):
//  - GEEN unieke bezoekers — "bezoeken" = sessies (beste proxy).
//  - GEEN klik-events (knoppen/links) — "kliks" = navigatie: top-pagina's + verkeersbronnen.
//  - GEEN AI-crawler-hits (domeinen zijn geen CF-zones).  Bezoeken worden gesteekproefd/afgerond.
//  - LLM-vindbaarheid hier = AI-VERWIJSVERKEER (mensen die via ChatGPT/Perplexity/... binnenkomen).
//  - De wrangler OAuth-token kan GEEN analytics lezen — daarvoor is de aparte Analytics-token.

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { createSign } from 'node:crypto';

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = {};
try {
  readFileSync(join(__dirname, '..', '.env.local'), 'utf-8').split('\n').forEach(line => {
    const t = line.trim(); if (!t || t.startsWith('#')) return;
    const eq = t.indexOf('='); if (eq < 0) return;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  });
} catch (e) { console.error(`Cannot read .env.local: ${e.message}`); process.exit(1); }

const TOKEN = env.CLOUDFLARE_ANALYTICS_TOKEN, ACCT = env.CLOUDFLARE_ACCOUNT_ID;
if (!TOKEN || !ACCT) { console.error('Missing CLOUDFLARE_ANALYTICS_TOKEN / CLOUDFLARE_ACCOUNT_ID in .env.local'); process.exit(1); }

const days = Number(process.argv.includes('--days') ? process.argv[process.argv.indexOf('--days') + 1] : 30) || 30;
const ORDER = ['thelongcouncil.com', 'longevitywatch.nl', 'longevity-watch.com'];
const norm = h => (h || '').replace(/^www\./, '');
const iso = d => d.toISOString().slice(0, 10);
const ago = n => { const d = new Date(); d.setUTCDate(d.getUTCDate() - n); return iso(d); };
const START = ago(days), END = ago(0);
const label = { 'thelongcouncil.com': '🏛️  The Long Council', 'longevitywatch.nl': '🇳🇱 Longevitywatch NL', 'longevity-watch.com': '🇬🇧 Longevitywatch EN' };
const lbl = h => label[h] || h;
const hostsIn = set => [...ORDER.filter(s => set.has(s)), ...[...set].filter(s => !ORDER.includes(s))];

async function rum(dims, { agg = 'count sum{visits}', limit = 1000, ds = 'rumPageloadEventsAdaptiveGroups', start = START, end = END } = {}) {
  const query = `query($a:String!,$s:Date!,$e:Date!){viewer{accounts(filter:{accountTag:$a}){` +
    `${ds}(limit:${limit},filter:{date_geq:$s,date_leq:$e},orderBy:[count_DESC]){${agg} dimensions{${dims}}}}}}`;
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST', headers: { Authorization: `Bearer ${TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables: { a: ACCT, s: start, e: end } }),
  });
  const j = await res.json();
  if (j.errors) { console.error('CF API error:', JSON.stringify(j.errors)); process.exit(1); }
  return j.data.viewer.accounts[0][ds];
}
const PREV_START = ago(days * 2), PREV_END = ago(days + 1);

// ── Verwijzer-classificatie (zoekmachines / AI-LLM / social) ──────────────
// hosts zijn al genormaliseerd (www. eraf); anker op begin zodat app-referers als
// "com.google.android.gm" (Gmail) NIET als zoekmachine tellen.
const SEARCH = [/^google\.[a-z.]+$/, /^bing\.com$/, /^duckduckgo\.com$/, /^search\.yahoo\./, /^ecosia\.org$/, /^startpage\.com$/, /^yandex\.[a-z.]+$/, /^baidu\.com$/, /^search\.brave\.com$/];
const AI = [/chatgpt\.com/, /chat\.openai\.com/, /openai\.com/, /perplexity\.ai/, /gemini\.google\.com/, /bard\.google\.com/, /claude\.ai/, /copilot\.microsoft\.com/, /(^|\.)you\.com/, /poe\.com/, /phind\.com/, /t3\.chat/, /deepseek\.com/, /grok\.com/, /x\.ai/];
const SOCIAL = [/t\.co/, /twitter\.com/, /(^|\.)x\.com/, /linkedin\.(com|android)/, /facebook\.com/, /instagram\.com/, /reddit\.com/, /mastodon/, /bsky\.app/, /youtube\.com/];
const matchAny = (h, arr) => arr.some(re => re.test(h));
const classify = h => !h ? 'direct' : matchAny(h, AI) ? 'ai' : matchAny(h, SEARCH) ? 'search' : matchAny(h, SOCIAL) ? 'social' : 'other';

console.log(`\n📊 WEBSITE-STATS — laatste ${days} dagen (${START} → ${END})`);
console.log('   bron: Cloudflare Web Analytics (cookieloos: "bezoeken"=sessies, geen unieke bezoekers)\n');

// 1) Overzicht
{
  const m = {}; for (const g of await rum('requestHost siteTag')) { const h = norm(g.dimensions.requestHost); (m[h] ||= { pv: 0, v: 0 }); m[h].pv += g.count; m[h].v += g.sum.visits; }
  console.log('═══ Overzicht ═══'); let tpv = 0, tv = 0;
  for (const h of hostsIn(new Set(Object.keys(m)))) { console.log(`${lbl(h).padEnd(22)} ${String(m[h].pv).padStart(6)} pageviews   ${String(m[h].v).padStart(6)} bezoeken`); tpv += m[h].pv; tv += m[h].v; }
  console.log(`${'TOTAAL'.padEnd(22)} ${String(tpv).padStart(6)} pageviews   ${String(tv).padStart(6)} bezoeken`);
}

// 1b) Groei vs vorige periode + pagina's per bezoek (betrokkenheid)
{
  const cur = {}, prev = {};
  for (const g of await rum('requestHost')) { const h = norm(g.dimensions.requestHost); (cur[h] ||= { pv: 0, v: 0 }); cur[h].pv += g.count; cur[h].v += g.sum.visits; }
  for (const g of await rum('requestHost', { start: PREV_START, end: PREV_END })) { const h = norm(g.dimensions.requestHost); prev[h] = (prev[h] || 0) + g.sum.visits; }
  const pct = (now, was) => was ? `${now >= was ? '▲' : '▼'}${Math.round(Math.abs(now - was) / was * 100)}%` : (now ? 'nieuw' : '—');
  console.log('\n═══ Groei (bezoeken vs vorige ' + days + ' dagen) + betrokkenheid ═══');
  for (const h of hostsIn(new Set(Object.keys(cur)))) {
    const ppv = cur[h].v ? (cur[h].pv / cur[h].v).toFixed(1) : '0';
    console.log(`  ${lbl(h).padEnd(22)} ${String(cur[h].v).padStart(5)} bezoeken  ${pct(cur[h].v, prev[h] || 0).padStart(7)}   ·   ${ppv} pagina's/bezoek`);
  }
  const ct = Object.values(cur).reduce((a, b) => a + b.v, 0), pt = Object.values(prev).reduce((a, b) => a + b, 0);
  console.log(`  ${'TOTAAL'.padEnd(22)} ${String(ct).padStart(5)} bezoeken  ${pct(ct, pt).padStart(7)}`);
}

// 2) Vindbaarheid: zoekmachine- & AI/LLM-verwijsverkeer
{
  const buckets = { search: 0, ai: 0, social: 0, direct: 0, other: 0 };
  const srcDetail = {}; // host -> count voor search/ai
  for (const g of await rum('refererHost')) {
    const h = norm(g.dimensions.refererHost); const c = classify(h); buckets[c] += g.count;
    if ((c === 'search' || c === 'ai') && h) srcDetail[h] = (srcDetail[h] || 0) + g.count;
  }
  console.log('\n═══ Vindbaarheid — verwijsverkeer (pageviews) ═══');
  console.log(`   🔍 Zoekmachines (Google/Bing/…) : ${buckets.search}`);
  console.log(`   🤖 AI / LLM (ChatGPT/Perplexity/…): ${buckets.ai}`);
  console.log(`   📣 Social (X/LinkedIn/…)         : ${buckets.social}`);
  console.log(`   🔗 Direct/overig                 : ${buckets.direct + buckets.other}`);
  const det = Object.entries(srcDetail).sort((a, b) => b[1] - a[1]);
  if (det.length) det.forEach(([h, c]) => console.log(`        ↳ ${String(c).padStart(4)}  ${h}`));
  else console.log('   (nog geen zoek- of AI-verwijsverkeer gemeten in deze periode)');
}

// 3) Top-pagina's per site
{
  const bySite = {}; for (const g of await rum('requestHost requestPath')) { const h = norm(g.dimensions.requestHost); (bySite[h] ||= []).push({ p: g.dimensions.requestPath, pv: g.count }); }
  console.log('\n═══ Top-pagina\'s (pageviews) ═══');
  for (const h of hostsIn(new Set(Object.keys(bySite)))) { console.log(`  ${lbl(h)}`); bySite[h].sort((a, b) => b.pv - a.pv).slice(0, 5).forEach(r => console.log(`     ${String(r.pv).padStart(5)}  ${r.p}`)); }
}

// 4) Prestaties (laadtijd) — telt mee voor Google-ranking
{
  const rows = await rum('requestHost', { agg: 'count quantiles{pageLoadTimeP50 firstContentfulPaintP50}', ds: 'rumPerformanceEventsAdaptiveGroups' });
  const m = {}; for (const g of rows) { const h = norm(g.dimensions.requestHost); (m[h] ||= []).push(g); }
  console.log('\n═══ Prestaties (mediaan, laager=beter) ═══');
  for (const h of hostsIn(new Set(Object.keys(m)))) {
    const g = m[h].sort((a, b) => b.count - a.count)[0]; const q = g.quantiles;
    const s = us => (us / 1e6).toFixed(2) + 's';
    console.log(`  ${lbl(h).padEnd(22)} laadtijd ${s(q.pageLoadTimeP50).padStart(6)}   eerste content ${s(q.firstContentfulPaintP50).padStart(6)}`);
  }
}

// 5) Landen + 6) Apparaten
{
  const m = {}; for (const g of await rum('countryName')) m[g.dimensions.countryName] = (m[g.dimensions.countryName] || 0) + g.count;
  console.log('\n═══ Landen (pageviews, alle sites) ═══');
  Object.entries(m).sort((a, b) => b[1] - a[1]).slice(0, 8).forEach(([c, n]) => console.log(`   ${String(n).padStart(5)}  ${c}`));
  const d = {}; let tot = 0; for (const g of await rum('deviceType')) { const k = g.dimensions.deviceType || 'onbekend'; d[k] = (d[k] || 0) + g.count; tot += g.count; }
  console.log('═══ Apparaten (alle sites) ═══');
  Object.entries(d).sort((a, b) => b[1] - a[1]).forEach(([k, n]) => console.log(`   ${String(n).padStart(5)}  ${k.padEnd(8)} ${tot ? Math.round(n / tot * 100) : 0}%`));
}

// 6b) Beste dag van de week (wanneer is je publiek actief)
{
  const WD = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];
  const byWd = Array(7).fill(0);
  for (const g of await rum('date')) { const wd = new Date(g.dimensions.date + 'T12:00:00Z').getUTCDay(); byWd[wd] += g.sum.visits; }
  const max = Math.max(1, ...byWd);
  console.log('\n═══ Bezoeken per weekdag (beste posttijd-indicatie) ═══');
  for (let i = 1; i <= 7; i++) { const d = i % 7; const bar = '█'.repeat(Math.round(byWd[d] / max * 20)); console.log(`   ${WD[d]} ${String(byWd[d]).padStart(4)} ${bar}`); }
}

// 7) Google Search Console — échte vindbaarheid (impressies/positie/zoektermen)
await googleSearchConsole();

console.log('\nℹ️  Unieke bezoekers/klik-events → cookie-analytics (Plausible/GA) toevoegen. LLM-vindbaarheid hier = AI-verwijsverkeer.');

// ───────────────────────────────────────────────────────────────────────
async function getGoogleToken(creds) {
  // authorized_user (gcloud ADC) — eigen Google-login, geen service-account nodig
  if (creds.type === 'authorized_user' || creds.refresh_token) {
    const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'refresh_token', client_id: creds.client_id, client_secret: creds.client_secret, refresh_token: creds.refresh_token }) });
    const j = await res.json(); if (!j.access_token) throw new Error('ADC token: ' + JSON.stringify(j).slice(0, 160));
    return j.access_token;
  }
  // service_account — JWT/RS256 self-signed
  const now = Math.floor(Date.now() / 1000);
  const b64 = o => Buffer.from(JSON.stringify(o)).toString('base64url');
  const jwt = `${b64({ alg: 'RS256', typ: 'JWT' })}.${b64({ iss: creds.client_email, scope: 'https://www.googleapis.com/auth/webmasters.readonly', aud: 'https://oauth2.googleapis.com/token', exp: now + 3600, iat: now })}`;
  const sig = createSign('RSA-SHA256').update(jwt).sign(creds.private_key, 'base64url');
  const res = await fetch('https://oauth2.googleapis.com/token', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${jwt}.${sig}` }) });
  const j = await res.json(); if (!j.access_token) throw new Error('SA token: ' + JSON.stringify(j).slice(0, 160));
  return j.access_token;
}
function resolveGoogleCreds() {
  // 1) service-account json via env  2) gcloud ADC (eigen login)
  if (env.GSC_SERVICE_ACCOUNT_JSON) { try { return { src: 'service-account', creds: JSON.parse(readFileSync(env.GSC_SERVICE_ACCOUNT_JSON.replace(/^\.\//, __dirname + '/../'), 'utf-8')) }; } catch (e) { return { err: e.message }; } }
  const adc = join(process.env.HOME, '.config/gcloud/application_default_credentials.json');
  try { return { src: 'gcloud-login (ADC)', creds: JSON.parse(readFileSync(adc, 'utf-8')) }; } catch { return null; }
}
async function googleSearchConsole() {
  console.log('\n═══ Google-vindbaarheid (Search Console) ═══');
  const r = resolveGoogleCreds();
  if (!r) {
    console.log('   ⚠️  Niet geconfigureerd. Kies één van twee:');
    console.log('       A) gcloud auth application-default login --scopes=https://www.googleapis.com/auth/webmasters.readonly');
    console.log('       B) zet GSC_SERVICE_ACCOUNT_JSON=<pad .json> in .env.local en deel elke property met het SA-mailadres.');
    return;
  }
  if (r.err) { console.log('   ❌ creds: ' + r.err.slice(0, 120)); return; }
  console.log(`   (bron: ${r.src})`);
  let token; try { token = await getGoogleToken(r.creds); } catch (e) { console.log('   ❌ ' + e.message.slice(0, 180)); return; }
  const gh = { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(env.GSC_QUOTA_PROJECT ? { 'x-goog-user-project': env.GSC_QUOTA_PROJECT } : {}) };
  const gApi = async (path, body) => (await fetch('https://www.googleapis.com/webmasters/v3/' + path, { method: body ? 'POST' : 'GET', headers: gh, body: body ? JSON.stringify(body) : undefined })).json();
  // properties automatisch ontdekken (domein- én URL-prefix), of override via GSC_SITES
  let sites = env.GSC_SITES ? env.GSC_SITES.split(',').map(s => s.trim()) : null;
  if (!sites) { const l = await gApi('sites'); if (l.error) { console.log('   ❌ ' + l.error.message?.slice(0, 140)); return; } sites = (l.siteEntry || []).filter(e => /Owner|FullUser/.test(e.permissionLevel)).map(e => e.siteUrl); }
  if (!sites.length) { console.log('   (geen properties gevonden op dit account)'); return; }
  const propHost = s => s.replace(/^sc-domain:/, '').replace(/^https?:\/\//, '').replace(/\/$/, '').replace(/^www\./, '');
  sites.sort((a, b) => (ORDER.indexOf(propHost(a)) + 1 || 99) - (ORDER.indexOf(propHost(b)) + 1 || 99));
  const q = body => ({ startDate: START, endDate: END, ...body });
  for (const site of sites) {
    const enc = encodeURIComponent(site);
    const tot = await gApi(`sites/${enc}/searchAnalytics/query`, q({ rowLimit: 1 }));
    if (tot.error) { console.log(`  ${lbl(propHost(site))}: ⚠️ ${tot.error.message?.slice(0, 80)}`); continue; }
    const t = (tot.rows || [])[0] || { impressions: 0, clicks: 0, position: 0 };
    console.log(`  ${lbl(propHost(site))}  —  ${Math.round(t.impressions)} impressies · ${Math.round(t.clicks)} klikken · gem. positie ${t.position ? t.position.toFixed(1) : '—'}`);
    const tq = await gApi(`sites/${enc}/searchAnalytics/query`, q({ dimensions: ['query'], rowLimit: 100 }));
    const top = (tq.rows || []).sort((a, b) => b.impressions - a.impressions).slice(0, 5);
    top.forEach(r => console.log(`       ${String(Math.round(r.impressions)).padStart(4)} impr  ${String(Math.round(r.clicks)).padStart(2)} klik  pos ${r.position.toFixed(1).padStart(4)}  "${r.keys[0]}"`));
    if (!top.length) console.log('       (nog geen zoekvertoningen in deze periode)');
  }
}
