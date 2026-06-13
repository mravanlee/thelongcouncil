#!/usr/bin/env node
// One-off script — backfill cards.brief_quotes for existing sessions.
// For each session it picks 1-2 of each participating member's REAL documented
// quotes (lib/memberQuotes.js) that fit the topic + that member's card text,
// exactly like the live pipeline's selectBriefQuotes step. Read-only on the
// answer — only writes the cards.brief_quotes display field.
//
// Reads .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY).
// Bundled-run because lib/memberQuotes.js uses Next-style extensionless imports:
//   npx esbuild scripts/backfill-brief-quotes.mjs --bundle --platform=node \
//     --format=esm --packages=external --outfile=scripts/.bbq.run.mjs
//   node scripts/.bbq.run.mjs [--limit N] [--dry-run]

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { getMemberQuotes } from '../lib/memberQuotes.js';

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
const LIMIT = limitIdx >= 0 ? parseInt(args[limitIdx + 1], 10) : 5;
const DRY_RUN = args.includes('--dry-run');
const slugIdx = args.indexOf('--slug');
const SLUG = slugIdx >= 0 ? args[slugIdx + 1] : null;

// ── Supabase client ────────────────────────────────────────────────────
const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// ── Anthropic call (Sonnet, mirrors the pipeline selection step) ───────
async function callSelector(prompt, retries = 2) {
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
          max_tokens: 30,
          temperature: 0.2,
          messages: [{ role: 'user', content: prompt }]
        })
      });
      const data = await r.json();
      if (data.error) {
        if (data.error.type === 'overloaded_error' && attempt < retries) {
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

// ── Selection logic (ported verbatim from pipeline.js) ─────────────────
function findMemberCardText(deliberationOutput, name) {
  if (!deliberationOutput || !name) return '';
  const wanted = name.toLowerCase().replace(/[^a-z]/g, '');
  const lastToken = name.trim().split(/\s+/).pop().toLowerCase().replace(/[^a-z]/g, '');
  const blocks = deliberationOutput.split(/\n(?=##\s)/);
  for (const block of blocks) {
    const m = block.match(/^\s*##\s*([^\n]+)/);
    if (!m) continue;
    const heading = m[1].toLowerCase().replace(/[^a-z]/g, '');
    if (heading && lastToken && (heading.includes(lastToken) || wanted.includes(heading))) return block;
  }
  return '';
}

async function pickQuotesForMember(question, name, cardText, quotes) {
  const numbered = quotes.map((q, i) => `${i + 1}. "${q.text}"`).join('\n');
  const prompt = `You are choosing which — if any — of a historical figure's REAL documented quotes deserves to sit beside a specific policy debate, as a small sidebar of authentic quotations. Think like an editor: the quote must illuminate THIS question, not merely come from this figure.

FIGURE: ${name}

THE DEBATE QUESTION:
${question}

${name}'S STANCE HERE (context only — do NOT match quotes to its wording):
${cardText || '(no card text available)'}

${name}'S REAL QUOTES:
${numbered}

How to judge:
- First settle the UNDERLYING SUBJECT the question turns on — the principle in contention, not its surface nouns. (A question about banning a harmful product is really about state authority over personal consumption, not about that product.)
- A quote qualifies ONLY if its CLAIM is about that same subject. Merely sharing a noun with the debate ("food", "freedom", "market", "health") is NOT a match. Echoing a word or example from the stance above is NOT a match.
- Showing nothing is the norm: NONE is the right answer most of the time. A loosely-related or generic line that could sit beside almost any debate is worse than an empty sidebar.
- Return at most ONE quote — only one you would defend as unmistakably on-subject. Return a second only in the rare case it is equally on-subject AND makes a genuinely different point.

Answer with ONLY the quote number(s), comma-separated (at most two), or the single word NONE. No other text.`;
  const responseText = await callSelector(prompt);
  if (/\bnone\b/i.test(responseText)) return [];
  const nums = (responseText.match(/\d+/g) || []).map(n => parseInt(n, 10)).filter(n => n >= 1 && n <= quotes.length);
  const seen = new Set();
  const picks = [];
  for (const n of nums) {
    if (seen.has(n)) continue;
    seen.add(n);
    picks.push(quotes[n - 1]);
    if (picks.length >= 2) break;
  }
  return picks;
}

async function selectBriefQuotes(question, deliberationOutput, memberNames) {
  const names = Array.isArray(memberNames) ? memberNames : [];
  const result = {};
  for (const name of names) {
    const entry = getMemberQuotes(name);
    if (!entry || !Array.isArray(entry.quotes) || entry.quotes.length === 0) continue;
    const cardText = findMemberCardText(deliberationOutput, name);
    try {
      const picks = await pickQuotesForMember(question, name, cardText, entry.quotes);
      if (picks.length > 0) result[name] = { pronoun: entry.pronoun || 'his', quotes: picks };
    } catch (e) {
      console.log(`     · ${name}: pick failed (${e.message})`);
    }
  }
  return result;
}

// ── Main loop ──────────────────────────────────────────────────────────
async function main() {
  let query = supabase
    .from('sessions')
    .select('id, slug, original_issue, sharpened_issue, cards, member_names')
    .order('created_at', { ascending: false });
  query = SLUG ? query.eq('slug', SLUG) : query.limit(LIMIT);
  const { data: sessions, error } = await query;

  if (error) { console.error('Query failed:', error); process.exit(1); }
  if (!sessions || sessions.length === 0) { console.log('No sessions found.'); return; }

  console.log(`Processing ${sessions.length} session(s)${DRY_RUN ? ' (DRY RUN — no DB writes)' : ''}\n`);

  let ok = 0, empty = 0, skipped = 0, failed = 0;
  for (const [i, s] of sessions.entries()) {
    const n = `[${i + 1}/${sessions.length}]`;
    if (!s.cards?.deliberation) {
      console.log(`${n} ⚠️  ${s.slug}: no deliberation — skip`);
      skipped++;
      continue;
    }
    const question = s.sharpened_issue || s.cards?.question_en || s.original_issue;
    try {
      const briefQuotes = await selectBriefQuotes(question, s.cards.deliberation, s.member_names);
      const memberCount = Object.keys(briefQuotes).length;
      const quoteCount = Object.values(briefQuotes).reduce((a, m) => a + m.quotes.length, 0);
      console.log(`${n} ${memberCount > 0 ? '✓' : '·'} ${s.slug} — ${memberCount} member(s), ${quoteCount} quote(s)`);
      for (const [name, info] of Object.entries(briefQuotes)) {
        for (const q of info.quotes) console.log(`     ${name}: "${q.text}"`);
      }

      if (!DRY_RUN) {
        const newCards = { ...s.cards, brief_quotes: briefQuotes };
        const { error: upErr } = await supabase.from('sessions').update({ cards: newCards }).eq('id', s.id);
        if (upErr) throw new Error(`Update failed: ${upErr.message}`);
      }
      if (memberCount > 0) ok++; else empty++;
    } catch (e) {
      console.error(`${n} ✗ ${s.slug}: ${e.message}`);
      failed++;
    }
    console.log('');
    await new Promise(r => setTimeout(r, 300));
  }

  console.log('────────────────────────────────────────');
  console.log(`Done. ${ok} with quotes, ${empty} no-match, ${skipped} skipped, ${failed} failed${DRY_RUN ? ' (DRY RUN)' : ''}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
