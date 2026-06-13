#!/usr/bin/env node
// One-off script — backfill featured_quote + featured_quote_member for sessions.
// Reads .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY).
// Run from project root: node scripts/backfill-featured-quotes.mjs [--limit N] [--dry-run]

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

// ── Load .env.local ────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
const env = {};
try {
  readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq < 0) return;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
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
const limitIdx = args.indexOf('--limit');
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : null;
const DRY_RUN = args.includes('--dry-run');

// ── Supabase client ────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ── Prompt for quote extraction ────────────────────────────────────────
function buildPrompt(question, deliberation) {
  return `You are picking ONE pull-quote from a council deliberation. The quote will appear on a homepage as a magazine-style headline.

CRITERIA — strict, in this order:
1. PREFER SHORT. 6-12 words is ideal. 15 words is the absolute maximum.
2. CONCRETE. No abstract jargon: avoid "tension", "paradigm", "framework", "fundamental", "trajectory", "dynamics", "the conditions for".
3. SHARP. Must have a clear opinion or stance — not a hedge.
4. MEMORABLE. Stands alone, would work as a poster headline.
5. From a single member's card text (not a verdict summary).

Examples of GREAT pull-quotes (style to emulate):
- "There is no such thing as society." (6 words)
- "Energy dependence is sovereignty dependence." (5 words)
- "It always seems impossible until it's done." (7 words)
- "Inflation is always and everywhere a monetary phenomenon." (8 words)

ORIGINAL QUESTION:
${question}

DELIBERATION:
${deliberation}

Return EXACTLY this format, no preamble:
QUOTE: "the chosen quote here"
MEMBER: Member Name`;
}

// ── Call Anthropic ─────────────────────────────────────────────────────
async function callClaude(prompt, retries = 2) {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'x-api-key': ANTHROPIC_KEY,
          'anthropic-version': '2023-06-01',
          'content-type': 'application/json'
        },
        body: JSON.stringify({
          model: 'claude-sonnet-4-20250514',
          max_tokens: 200,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await r.json();
      if (data.error) {
        if (data.error.type === 'overloaded_error' && attempt < retries) {
          console.log(`   ⏳ overloaded, retry in 5s...`);
          await new Promise(rs => setTimeout(rs, 5000));
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

// ── Parse Claude's response ────────────────────────────────────────────
function parseQuote(text) {
  const qm = text.match(/QUOTE:\s*"([^"]+)"/i);
  const mm = text.match(/MEMBER:\s*(.+?)(?:\n|$)/i);
  if (!qm || !mm) throw new Error(`Parse failed: ${text.slice(0, 200)}`);
  return { quote: qm[1].trim(), member: mm[1].trim() };
}

// ── Main loop ──────────────────────────────────────────────────────────
async function main() {
  let query = supabase
    .from('sessions')
    .select('id, slug, original_issue, cards, member_names')
    .is('featured_quote', null)
    .order('created_at', { ascending: false });
  if (LIMIT) query = query.limit(LIMIT);

  const { data: sessions, error } = await query;
  if (error) { console.error('Query failed:', error); process.exit(1); }
  if (!sessions || sessions.length === 0) {
    console.log('No sessions need quotes.');
    return;
  }

  console.log(`Processing ${sessions.length} session${sessions.length > 1 ? 's' : ''}${DRY_RUN ? ' (DRY RUN — no DB writes)' : ''}\n`);

  let ok = 0, skipped = 0, failed = 0;
  for (const [i, s] of sessions.entries()) {
    const n = `[${i + 1}/${sessions.length}]`;
    if (!s.cards?.deliberation) {
      console.log(`${n} ⚠️  ${s.slug}: no deliberation — skip`);
      skipped++;
      continue;
    }
    try {
      const response = await callClaude(buildPrompt(s.original_issue, s.cards.deliberation));
      const { quote, member } = parseQuote(response);
      const wc = quote.split(/\s+/).length;
      const tooLong = wc > 15;
      const flag = tooLong ? ' ⚠️ too long' : '';
      console.log(`${n} ✓ ${s.slug}`);
      console.log(`     (${wc}w${flag}) "${quote}"`);
      console.log(`     — ${member}\n`);

      if (!DRY_RUN) {
        const { error: upErr } = await supabase
          .from('sessions')
          .update({ featured_quote: quote, featured_quote_member: member })
          .eq('id', s.id);
        if (upErr) throw new Error(`Update failed: ${upErr.message}`);
      }
      ok++;
    } catch (e) {
      console.error(`${n} ✗ ${s.slug}: ${e.message}\n`);
      failed++;
    }
    // tiny pace between calls
    await new Promise(r => setTimeout(r, 400));
  }

  console.log(`\n────────────────────────────────────────`);
  console.log(`Done. ${ok} ok, ${skipped} skipped, ${failed} failed${DRY_RUN ? ' (DRY RUN)' : ''}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
