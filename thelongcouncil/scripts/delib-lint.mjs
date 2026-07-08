#!/usr/bin/env node
// Language lint for deliberation output. Measures the PROMPT2 language rules
// that the model is known to violate, so prompt changes can be verified with
// numbers instead of vibes:
//   - sentences over the 22-word cap (and the >30w heavy tail)
//   - forbidden abstraction words ("framework", "genuine", ...)
//   - em-dashes (should be zero)
//   - comma-stuffed asides (aside dropped between bare commas, the em-dash
//     replacement artifact; proxied as sentences with 4+ commas)
//   - card length vs the 60-100 word discipline
//   - framing line over 12 words
//
// Usage:
//   node scripts/delib-lint.mjs                 # lint last 10 debates from Supabase
//   node scripts/delib-lint.mjs --limit 25
//   node scripts/delib-lint.mjs --slug <slug>
// or import { lintDeliberation } from './delib-lint.mjs'

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const FORBIDDEN_WORDS = [
  'tension', 'paradigm', 'fundamental', 'irreconcilable', 'incompatible',
  'trajectory', 'dynamics', 'framework', 'authentic', 'genuine',
];
const FORBIDDEN_PHRASES = [
  'the conditions for', 'the requirements of', 'the key is', 'the principle is',
  'what this teaches', 'the deeper principle',
];

const wordCount = (s) => s.split(/\s+/).filter(Boolean).length;

function splitSentences(text) {
  return text
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => wordCount(s) > 2);
}

// Parse the deliberation into cards: { name, role, framing, body }.
function parseCards(deliberation) {
  const cards = [];
  const blocks = deliberation.split(/^##\s+/m).slice(1);
  for (const block of blocks) {
    const lines = block.split('\n');
    const name = (lines[0] || '').trim();
    if (/^the convergence note/i.test(name)) continue;
    const rest = lines.slice(1).join('\n');
    const framing = (rest.match(/^\s*\*([^*\n]+)\*\s*$/m) || [])[1] || '';
    const body = rest
      .replace(/^\s*\*[^*\n]+\*\s*$/m, '')            // framing line
      .replace(/^\*\*Challenge to[^\n]*$/gm, '')       // challenge line
      .replace(/^---\s*$/gm, '')
      .replace(/^[A-Z][^\n]{0,80}$/m, (l, off) =>      // role line = first short non-md line
        off < 5 ? '' : l)
      .trim();
    // Role line: first plain line before the framing line.
    const roleLine = (rest.trim().split('\n')[0] || '').trim();
    const bodyText = body.replace(roleLine, '').trim();
    cards.push({ name, role: roleLine, framing: framing.trim(), body: bodyText });
  }
  return cards;
}

export function lintDeliberation(deliberation) {
  const prose = deliberation
    .replace(/^##.*$/gm, '')
    .replace(/^\*\*Challenge.*$/gm, '')
    .replace(/^\*\*Where.*$/gm, '')
    .replace(/^\*\*For a policymaker.*$/gm, '');

  const sentences = splitSentences(prose);
  const over22 = sentences.filter((s) => wordCount(s) > 22);
  const over30 = sentences.filter((s) => wordCount(s) > 30);
  const stuffed = sentences.filter((s) => (s.match(/,/g) || []).length >= 4);
  const emDashes = (deliberation.match(/—/g) || []).length;
  // Self-citation of own works ("In the Muqaddimah I documented...", "In A
  // Theory of Justice I argued..."). Title-cased words + a writing verb keeps
  // event anchors ("In November 1973 I told...") out.
  const selfCitations = (prose.match(/\bIn (?:my |the )?(?:[A-Z][\w'’]+[ ,]+){1,7}(?:written in \d{3,4},? )?I (?:argued|wrote|documented|recorded|showed|described|demonstrated)\b/g) || []).length;

  const lowerProse = prose.toLowerCase();
  const forbidden = [];
  for (const w of FORBIDDEN_WORDS) {
    const hits = (lowerProse.match(new RegExp(`\\b${w}`, 'g')) || []).length;
    if (hits) forbidden.push({ term: w, count: hits });
  }
  for (const p of FORBIDDEN_PHRASES) {
    const hits = lowerProse.split(p).length - 1;
    if (hits) forbidden.push({ term: p, count: hits });
  }

  const cards = parseCards(deliberation).map((c) => ({
    name: c.name,
    bodyWords: wordCount(c.body),
    framingWords: wordCount(c.framing),
  }));
  const cardsOverLength = cards.filter((c) => c.bodyWords > 110);
  const framingOverLength = cards.filter((c) => c.framingWords > 12);

  return {
    sentences: sentences.length,
    avgSentenceWords: +(sentences.reduce((a, s) => a + wordCount(s), 0) / (sentences.length || 1)).toFixed(1),
    over22: over22.length,
    over22Pct: Math.round((100 * over22.length) / (sentences.length || 1)),
    over30: over30.length,
    stuffedCommas: stuffed.length,
    emDashes,
    selfCitations,
    forbidden,
    cards,
    cardsOverLength: cardsOverLength.map((c) => `${c.name}:${c.bodyWords}w`),
    framingOverLength: framingOverLength.map((c) => `${c.name}:${c.framingWords}w`),
    worstSentences: [...sentences].sort((a, b) => wordCount(b) - wordCount(a)).slice(0, 3),
  };
}

export function formatLintLine(slugOrLabel, r) {
  const forb = r.forbidden.map((f) => `${f.term}:${f.count}`).join(' ') || '-';
  return `${slugOrLabel.padEnd(48)} zin>22w: ${String(r.over22).padStart(2)}/${r.sentences} (${String(r.over22Pct).padStart(2)}%)  >30w: ${r.over30}  4+commas: ${r.stuffedCommas}  emdash: ${r.emDashes}  zelfcit: ${r.selfCitations}  kaart>110w: ${r.cardsOverLength.length}  verboden: ${forb}`;
}

// ── CLI mode ────────────────────────────────────────────────────────────
const isCli = process.argv[1] && process.argv[1].endsWith('delib-lint.mjs');
if (isCli) {
  const __dirname = dirname(fileURLToPath(import.meta.url));
  const env = {};
  readFileSync(join(__dirname, '..', '.env.local'), 'utf-8').split('\n').forEach((line) => {
    const t = line.trim(); if (!t || t.startsWith('#')) return;
    const eq = t.indexOf('='); if (eq < 0) return;
    env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
  });
  const args = process.argv.slice(2);
  const argVal = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
  const limit = Number(argVal('--limit', 10));
  const slug = argVal('--slug', null);

  const url = `${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/sessions?select=slug,created_at,cards` +
    (slug ? `&slug=eq.${slug}` : `&order=created_at.desc&limit=${limit}`);
  const rows = await (await fetch(url, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  })).json();

  let totals = { sentences: 0, over22: 0, over30: 0, stuffed: 0, emd: 0 };
  for (const row of rows) {
    const d = row.cards && row.cards.deliberation;
    if (!d) continue;
    const r = lintDeliberation(d);
    console.log(formatLintLine(`${row.created_at.slice(0, 10)} ${row.slug.slice(0, 37)}`, r));
    totals.sentences += r.sentences; totals.over22 += r.over22; totals.over30 += r.over30;
    totals.stuffed += r.stuffedCommas; totals.emd += r.emDashes;
    if (slug) {
      console.log('\nLangste zinnen:');
      r.worstSentences.forEach((s) => console.log(`  [${wordCount(s)}w] ${s}`));
    }
  }
  console.log(`\nTOTAAL: ${totals.over22}/${totals.sentences} zinnen >22w (${Math.round(100 * totals.over22 / (totals.sentences || 1))}%), ${totals.over30} >30w, ${totals.stuffed} met 4+ commas, ${totals.emd} em-dashes`);
}
