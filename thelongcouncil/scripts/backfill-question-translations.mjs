#!/usr/bin/env node
// One-off script — backfill cards.question_en + cards.question_lang for sessions
// whose question was asked in a language other than English. English-first site:
// the English translation is shown by default, the original behind a toggle.
// Reads .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, ANTHROPIC_API_KEY).
// Idempotent: skips sessions already checked (question_en OR question_lang set).
// Run from project root: node scripts/backfill-question-translations.mjs [--limit N] [--dry-run] [--force]

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
const FORCE = args.includes('--force');

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

// Mirror of PROMPT_TRANSLATE_QUESTION_SYSTEM in pages/api/pipeline.js — keep in sync.
const SYSTEM = `You translate a single deliberation question into English for an English-first publication.

You receive one question. It may be in any language.

1. If the question is already written in English, respond with EXACTLY this and nothing else:
ALREADY ENGLISH

2. If it is in another language, translate it into clear, natural English that preserves the exact meaning. Keep all named people, places, institutions and quoted phrases intact. Keep it as a single question. Do not add or drop information. Do not explain or comment.
Respond with EXACTLY this format and nothing else:
LANGUAGE: <source language name in English, e.g. Turkish, Dutch, Spanish>
ENGLISH: <the English translation>

Hard rules:
- Never use em-dashes. Use commas or rephrase.
- Output only the tag(s) above. No preamble, no notes, no quotation marks around the whole line.`;

// Same em-dash strip as the pipeline (U+2014 only; en-dashes left intact).
function stripEmDashes(text) {
  if (!text) return text;
  return text.replace(/\s*—\s*/g, ', ').replace(/,\s*,/g, ',').replace(/ {2,}/g, ' ');
}

async function callClaude(question, retries = 2) {
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
          model: 'claude-haiku-4-5-20251001',
          max_tokens: 500,
          temperature: 0.2,
          system: SYSTEM,
          messages: [{ role: 'user', content: `QUESTION:\n${question}` }]
        })
      });
      const data = await r.json();
      if (data.error) {
        if (data.error.type === 'overloaded_error' && attempt < retries) {
          console.log('   ⏳ overloaded, retry in 5s...');
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

function parseTranslation(text) {
  const t = (text || '').trim();
  if (!t || /^ALREADY ENGLISH\b/i.test(t)) return { english: null, lang: 'English' };
  const langMatch = t.match(/LANGUAGE:\s*(.+?)(?:\n|$)/i);
  const enMatch = t.match(/ENGLISH:\s*([\s\S]+)$/i);
  if (!langMatch || !enMatch) throw new Error(`Parse failed: ${t.slice(0, 200)}`);
  const english = stripEmDashes(enMatch[1].trim());
  const lang = langMatch[1].trim();
  if (!english || /^english$/i.test(lang)) return { english: null, lang: 'English' };
  return { english, lang };
}

async function main() {
  let query = supabase
    .from('sessions')
    .select('id, slug, original_issue, cards')
    .order('created_at', { ascending: false });
  if (LIMIT) query = query.limit(LIMIT);

  const { data: sessions, error } = await query;
  if (error) { console.error('Query failed:', error); process.exit(1); }
  if (!sessions || sessions.length === 0) { console.log('No sessions found.'); return; }

  console.log(`Scanning ${sessions.length} session${sessions.length > 1 ? 's' : ''}${DRY_RUN ? ' (DRY RUN — no DB writes)' : ''}${FORCE ? ' (FORCE — re-check all)' : ''}\n`);

  let translated = 0, english = 0, alreadyDone = 0, failed = 0;
  for (const [i, s] of sessions.entries()) {
    const n = `[${i + 1}/${sessions.length}]`;
    const checked = s.cards?.question_en != null || s.cards?.question_lang != null;
    if (checked && !FORCE) { alreadyDone++; continue; }
    if (!s.original_issue) { console.log(`${n} ⚠️  ${s.slug}: no question — skip`); continue; }

    try {
      const { english: en, lang } = parseTranslation(await callClaude(s.original_issue));
      if (en) {
        console.log(`${n} ✓ ${s.slug}  [${lang}]`);
        console.log(`     EN: "${en}"\n`);
        translated++;
      } else {
        console.log(`${n} · ${s.slug}: already English\n`);
        english++;
      }
      if (!DRY_RUN) {
        const newCards = { ...(s.cards || {}), question_en: en, question_lang: lang };
        const { error: upErr } = await supabase.from('sessions').update({ cards: newCards }).eq('id', s.id);
        if (upErr) throw new Error(`Update failed: ${upErr.message}`);
      }
    } catch (e) {
      console.error(`${n} ✗ ${s.slug}: ${e.message}\n`);
      failed++;
    }
    await new Promise(r => setTimeout(r, 400));
  }

  console.log('\n────────────────────────────────────────');
  console.log(`Done. ${translated} translated, ${english} English, ${alreadyDone} already checked, ${failed} failed${DRY_RUN ? ' (DRY RUN)' : ''}`);
}

main().catch(e => { console.error('Fatal:', e); process.exit(1); });
