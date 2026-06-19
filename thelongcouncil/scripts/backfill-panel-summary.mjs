#!/usr/bin/env node
// One-off script — backfill cards.panel_summary (plain-language tension + pole
// labels for the /who page) on existing sessions.
// Reads .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY).
// Idempotent: skips sessions that already have cards.panel_summary unless --force.
// Run from project root:
//   node scripts/backfill-panel-summary.mjs [--limit N] [--slug SLUG] [--force] [--dry-run]

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { extractAssemblyFraming, buildPanelSummaryPrompt, parsePanelSummary } from '../lib/panelSummary.mjs';

// ── Load .env.local ────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
const env = {};
try {
  readFileSync(envPath, 'utf-8').split('\n').forEach((line) => {
    const t = line.trim();
    if (!t || t.startsWith('#')) return;
    const eq = t.indexOf('=');
    if (eq < 0) return;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  });
} catch (e) {
  console.error(`Cannot read ${envPath}: ${e.message}`);
  process.exit(1);
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
const ANTHROPIC_KEY = env.ANTHROPIC_API_KEY;
if (!SUPABASE_URL || !SERVICE_KEY || !ANTHROPIC_KEY) {
  console.error('Missing one of: NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY');
  process.exit(1);
}

// ── CLI args ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const get = (flag) => { const i = args.indexOf(flag); return i >= 0 ? args[i + 1] : null; };
const LIMIT = get('--limit') ? parseInt(get('--limit'), 10) : null;
const ONLY_SLUG = get('--slug');
const SINCE = get('--since'); // ISO date, e.g. 2026-06-16 — only debates created on/after
const FORCE = args.includes('--force');
const DRY_RUN = args.includes('--dry-run');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// ── Call Anthropic (current model; sonnet-4-20250514 was retired Jun 2026) ──
async function callClaude(prompt, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-6',
          max_tokens: 1500,
          messages: [{ role: 'user', content: prompt }],
        }),
      });
      const data = await r.json();
      if (data.error) {
        if (data.error.type === 'overloaded_error' && attempt < retries) {
          console.log('   ⏳ overloaded, retry in 5s...');
          await new Promise((rs) => setTimeout(rs, 5000));
          continue;
        }
        throw new Error(`${data.error.type}: ${data.error.message}`);
      }
      return data.content[0].text;
    } catch (e) {
      if (attempt === retries) throw e;
    }
  }
}

async function main() {
  let query = supabase
    .from('sessions')
    .select('id, slug, original_issue, cards')
    .order('created_at', { ascending: false });
  if (ONLY_SLUG) query = query.eq('slug', ONLY_SLUG);
  if (SINCE) query = query.gte('created_at', SINCE);
  if (LIMIT) query = query.limit(LIMIT);

  const { data: sessions, error } = await query;
  if (error) { console.error('Query failed:', error); process.exit(1); }
  if (!sessions || sessions.length === 0) { console.log('No sessions found.'); return; }

  console.log(`Scanning ${sessions.length} session(s)${DRY_RUN ? ' (DRY RUN — no DB writes)' : ''}\n`);

  let ok = 0, skipped = 0, failed = 0;
  for (const [i, s] of sessions.entries()) {
    const n = `[${i + 1}/${sessions.length}]`;
    const cards = s.cards || {};
    if (!cards.assembly) { console.log(`${n} ⚠️  ${s.slug}: no assembly — skip`); skipped++; continue; }
    if (cards.panel_summary && !FORCE) { console.log(`${n} ↷ ${s.slug}: already has panel_summary — skip`); skipped++; continue; }

    const framing = extractAssemblyFraming(cards.assembly);
    if (!framing.tension && framing.poles.length === 0) {
      console.log(`${n} ⚠️  ${s.slug}: no tension/poles found — skip`); skipped++; continue;
    }
    const question = cards.question_en || s.original_issue || '';

    try {
      const response = await callClaude(buildPanelSummaryPrompt(question, framing));
      const summary = parsePanelSummary(response, framing);
      if (!summary) throw new Error('parse/validate failed');

      console.log(`${n} ✓ ${s.slug}`);
      console.log(`     tension: ${summary.tension}`);
      summary.poles.forEach((p) => console.log(`     • ${p.label} (${p.names.join(', ')})`));
      (summary.members || []).forEach((m) => console.log(`     – ${m.name}: ${m.stance}`));
      console.log('');

      if (!DRY_RUN) {
        const newCards = { ...cards, panel_summary: summary };
        const { error: upErr } = await supabase.from('sessions').update({ cards: newCards }).eq('id', s.id);
        if (upErr) throw new Error(`Update failed: ${upErr.message}`);
      }
      ok++;
    } catch (e) {
      console.log(`${n} ✗ ${s.slug}: ${e.message}\n`);
      failed++;
    }
  }

  console.log(`\nDone. ${ok} written, ${skipped} skipped, ${failed} failed.`);
}

main().catch((e) => { console.error(e); process.exit(1); });
