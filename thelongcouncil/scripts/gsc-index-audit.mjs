#!/usr/bin/env node
// Full Google index audit: runs every sitemap URL through the GSC URL Inspection API
// and groups results by coverageState + site section (archive/brief/who/themes/other).
//
// Auth: same approach as site-stats.mjs — gcloud ADC
// (~/.config/gcloud/application_default_credentials.json, scope webmasters.readonly)
// + GSC_QUOTA_PROJECT from .env.local. Property: sc-domain:thelongcouncil.com.
//
// Rate limit: ~400ms between calls (API quota: 600/min, 2000/day per property).
// Checkpointing: results are appended to the --out JSON file after every call, so an
// interrupted run resumes where it left off (already-inspected URLs are skipped).
//
// Run from thelongcouncil/:
//   node scripts/gsc-index-audit.mjs [--out FILE] [--limit N] [--report-only]
//     --out FILE      results file (default: /tmp/gsc-index-audit-results.json)
//     --limit N       inspect at most N not-yet-inspected URLs (for testing)
//     --report-only   skip API calls, just print the report from the results file

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SITE = 'sc-domain:thelongcouncil.com';
const SITEMAP = 'https://www.thelongcouncil.com/sitemap.xml';

const args = process.argv.slice(2);
const argVal = (name, dflt) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : dflt; };
const OUT = argVal('--out', '/tmp/gsc-index-audit-results.json');
const LIMIT = Number(argVal('--limit', Infinity)) || Infinity;
const REPORT_ONLY = args.includes('--report-only');

const env = {};
try {
  readFileSync(join(__dirname, '..', '.env.local'), 'utf-8').split('\n').forEach(line => {
    const t = line.trim(); if (!t || t.startsWith('#')) return;
    const eq = t.indexOf('='); if (eq < 0) return;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  });
} catch (e) { console.error(`Cannot read .env.local: ${e.message}`); process.exit(1); }

async function getToken() {
  const adcPath = join(process.env.HOME, '.config/gcloud/application_default_credentials.json');
  const creds = JSON.parse(readFileSync(adcPath, 'utf-8'));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'refresh_token', client_id: creds.client_id, client_secret: creds.client_secret, refresh_token: creds.refresh_token }),
  });
  const j = await res.json();
  if (!j.access_token) throw new Error('ADC token: ' + JSON.stringify(j).slice(0, 200));
  return j.access_token;
}

const section = url => {
  const p = new URL(url).pathname;
  const seg = p.split('/')[1] || '(home)';
  return ['archive', 'brief', 'who', 'themes'].includes(seg) ? seg : (p === '/' ? '(home)' : seg);
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function main() {
  // Load or initialize the results file
  const results = existsSync(OUT) ? JSON.parse(readFileSync(OUT, 'utf-8')) : {};
  const save = () => writeFileSync(OUT, JSON.stringify(results, null, 1));

  if (!REPORT_ONLY) {
    const xml = await (await fetch(SITEMAP)).text();
    const urls = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map(m => m[1]);
    console.log(`Sitemap: ${urls.length} URLs. Already inspected: ${Object.keys(results).length}. Out: ${OUT}`);

    const token = await getToken();
    const headers = {
      Authorization: `Bearer ${token}`, 'Content-Type': 'application/json',
      ...(env.GSC_QUOTA_PROJECT ? { 'x-goog-user-project': env.GSC_QUOTA_PROJECT } : {}),
    };

    let done = 0;
    const todo = urls.filter(u => !results[u]);
    for (const url of todo) {
      if (done >= LIMIT) break;
      const res = await fetch('https://searchconsole.googleapis.com/v1/urlInspection/index:inspect', {
        method: 'POST', headers,
        body: JSON.stringify({ inspectionUrl: url, siteUrl: SITE }),
      });
      const j = await res.json();
      if (j.error) {
        // Quota / auth errors are fatal (checkpoint keeps progress); log and stop.
        console.error(`\n❌ ${url}: ${j.error.message?.slice(0, 200)}`);
        if (j.error.code === 429 || j.error.code === 401 || j.error.code === 403) { save(); process.exit(1); }
        results[url] = { coverageState: `API error ${j.error.code}`, verdict: 'ERROR' };
      } else {
        const r = j.inspectionResult?.indexStatusResult || {};
        results[url] = {
          coverageState: r.coverageState || '(none)',
          verdict: r.verdict || '(none)',
          lastCrawlTime: r.lastCrawlTime || null,
          googleCanonical: r.googleCanonical || null,
          userCanonical: r.userCanonical || null,
        };
      }
      done++;
      if (done % 10 === 0) { save(); process.stdout.write(`\r  inspected ${done}/${Math.min(todo.length, LIMIT)}`); }
      await sleep(400);
    }
    save();
    console.log(`\nDone: ${done} new inspections, ${Object.keys(results).length} total in ${OUT}`);
  }

  // ── Report ──────────────────────────────────────────────────────────
  const entries = Object.entries(results);
  if (!entries.length) { console.log('No results yet.'); return; }

  const byState = {};
  for (const [url, r] of entries) (byState[r.coverageState] ||= []).push(url);

  console.log(`\n═══ INDEX AUDIT — ${entries.length} URLs ═══\n`);
  for (const [state, urls] of Object.entries(byState).sort((a, b) => b[1].length - a[1].length)) {
    const perSection = {};
    urls.forEach(u => { const s = section(u); perSection[s] = (perSection[s] || 0) + 1; });
    const dist = Object.entries(perSection).sort((a, b) => b[1] - a[1]).map(([s, n]) => `${s}:${n}`).join('  ');
    console.log(`${String(urls.length).padStart(4)}  ${state}   [${dist}]`);
  }

  const bad = entries.filter(([, r]) => r.coverageState !== 'Submitted and indexed');
  if (!bad.length) { console.log('\n✅ Every URL is "Submitted and indexed".'); return; }

  console.log(`\n═══ NOT INDEXED — ${bad.length} URLs (grouped by failure type, then section) ═══`);
  const byStateBad = {};
  for (const [url, r] of bad) (byStateBad[r.coverageState] ||= []).push([url, r]);
  for (const [state, items] of Object.entries(byStateBad).sort((a, b) => b[1].length - a[1].length)) {
    console.log(`\n── ${state} (${items.length}) ──`);
    const bySec = {};
    for (const it of items) (bySec[section(it[0])] ||= []).push(it);
    for (const [sec, secItems] of Object.entries(bySec).sort((a, b) => b[1].length - a[1].length)) {
      console.log(`  ${sec} (${secItems.length}):`);
      for (const [url, r] of secItems) {
        const canonicalNote = r.googleCanonical && r.googleCanonical !== url ? `  → google-canonical: ${r.googleCanonical}` : '';
        const crawl = r.lastCrawlTime ? `  last crawl ${r.lastCrawlTime.slice(0, 10)}` : '  never crawled';
        console.log(`    ${url}${crawl}${canonicalNote}`);
      }
    }
  }
}

main().catch(e => { console.error(e); process.exit(1); });
