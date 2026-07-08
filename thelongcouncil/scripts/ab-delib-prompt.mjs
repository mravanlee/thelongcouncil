#!/usr/bin/env node
// Offline A/B test for PROMPT2 (deliberation): current prompt (A) vs the
// consolidated draft in scripts/prompt2-consolidated.txt (B).
//
// For each test session it rebuilds the exact deliberation user message the
// pipeline would send (stored assembly + factual anchors + member profiles +
// the same FINAL REMINDER), calls claude-sonnet-4-6 once per variant with the
// pipeline's own parameters (maxTokens 2500, temp 0.7), and compares the two
// outputs with the language lint plus structural checks. Nothing is saved to
// Supabase; raw outputs land in --outdir for manual reading.
//
// Run from thelongcouncil/:
//   node scripts/ab-delib-prompt.mjs --prompt-b draft.txt --slugs slug1,slug2 [--outdir DIR] [--variant a|b]
//   node scripts/ab-delib-prompt.mjs --prompt-b draft.txt --limit 4   # last N debates
// Variant A is always the live PROMPT2_SYSTEM extracted from pipeline.js;
// variant B is the draft file you pass via --prompt-b (omit it, together with
// --variant a, to baseline the live prompt only).

import { readFileSync, writeFileSync, mkdirSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { lintDeliberation, formatLintLine } from './delib-lint.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const env = {};
readFileSync(join(ROOT, '.env.local'), 'utf-8').split('\n').forEach((line) => {
  const t = line.trim(); if (!t || t.startsWith('#')) return;
  const eq = t.indexOf('='); if (eq < 0) return;
  env[t.slice(0, eq).trim()] = t.slice(eq + 1).trim();
});

const args = process.argv.slice(2);
const argVal = (n, d) => { const i = args.indexOf(n); return i >= 0 ? args[i + 1] : d; };
const OUTDIR = argVal('--outdir', join(ROOT, '..', '.ab-delib-out'));
const SLUGS = argVal('--slugs', null);
const LIMIT = Number(argVal('--limit', 4));
const ONLY_VARIANT = argVal('--variant', null); // 'a' or 'b' to run one side

// ── Prompts ─────────────────────────────────────────────────────────────
function extractCurrentPrompt2() {
  const src = readFileSync(join(ROOT, 'pages', 'api', 'pipeline.js'), 'utf-8');
  const m = src.match(/const PROMPT2_SYSTEM = `([\s\S]*?)`;\s*\nconst PROMPT3_SYSTEM/);
  if (!m) throw new Error('Could not extract PROMPT2_SYSTEM from pipeline.js');
  return m[1].replace(/\\`/g, '`').replace(/\\\$/g, '$');
}
const PROMPT_A = extractCurrentPrompt2();
const promptBPath = argVal('--prompt-b', null);
if (!promptBPath && (ONLY_VARIANT || '').toLowerCase() !== 'a') {
  console.error('Pass --prompt-b <file> with the draft prompt to test, or --variant a to baseline the live prompt.');
  process.exit(1);
}
const PROMPT_B = promptBPath ? readFileSync(promptBPath, 'utf-8') : null;

// ── Pipeline user-message reconstruction (mirrors pages/api/pipeline.js) ─
const normalizeName = (name) => name.toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[-–—]/g, ' ')
  .replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, ' ');

function extractSelectedMembers(assemblyOutput) {
  const m = assemblyOutput.match(/SELECTED MEMBERS:\s*\n([\s\S]*?)(?=\n\s*(?:MEMBERS CONSIDERED|CONFIDENCE NOTE)|$)/i);
  if (!m) return [];
  const names = []; const seen = new Set();
  const regex = /^\s*(?:\*\*)?\s*\d+\.\s+(.+?)\s*$/gm;
  let match;
  while ((match = regex.exec(m[1])) !== null) {
    let raw = match[1].trim().replace(/\*\*/g, '').replace(/^\*|\*$/g, '').trim();
    raw = raw.replace(/\s*[[(].*$/, '').trim();
    const name = raw.replace(/\s*[—–\-―]\s*(Practitioner|Framer|Leader|Thinker|Wildcard)(\s*\/\s*\w+)?\s*$/i, '').trim();
    if (name && !seen.has(normalizeName(name))) { seen.add(normalizeName(name)); names.push(name); }
  }
  return names;
}

function loadProfiles(selectedNames) {
  const dir = join(ROOT, 'data', 'profiles');
  const files = readdirSync(dir).filter((f) => f.endsWith('.md'));
  const fileMap = new Map();
  for (const f of files) {
    fileMap.set(normalizeName(f.replace(/^profile_/, '').replace(/\.md$/, '').replace(/_/g, ' ')), join(dir, f));
  }
  const matched = []; const missing = [];
  for (const name of selectedNames) {
    const key = normalizeName(name);
    let p = fileMap.get(key);
    if (!p) {
      // Last-name fallback (e.g. DB says "Albert O. Hirschman", file says
      // "albert hirschman") so the test doesn't balloon to all 37 profiles.
      const last = key.split(' ').pop();
      const hit = [...fileMap.keys()].filter((k) => k.split(' ').pop() === last);
      if (hit.length === 1) p = fileMap.get(hit[0]);
    }
    if (p) matched.push(readFileSync(p, 'utf-8')); else missing.push(name);
  }
  return { profiles: matched.join('\n\n---\n\n'), missing };
}

function buildContextBlock(factualAnchors) {
  if (!factualAnchors || !factualAnchors.trim() || /^NO ANCHORS/i.test(factualAnchors.trim())) return '';
  return `CURRENT CONTEXT (May 2026): background facts the council is aware of. Reason in light of them so no member argues from an outdated or purely abstract version of the issue. But treat them as context, not as the subject: reference an anchor only where it genuinely bears on your argument, and never let a single recent event, deal or company become the focus of the debate. The question, not the anchor, is what the council answers.\n\n${factualAnchors}\n\n`;
}

function buildUserMessage(session) {
  const question = (session.cards && session.cards.question_en) || session.original_issue;
  const assembly = session.cards.assembly;
  const selectedNames = extractSelectedMembers(assembly);
  if (!selectedNames.length) throw new Error(`No SELECTED MEMBERS parsed for ${session.slug}`);
  const { profiles, missing } = loadProfiles(selectedNames);
  if (missing.length) throw new Error(`Missing profiles for ${session.slug}: ${missing.join(', ')}`);
  const contextBlock = buildContextBlock(session.cards.factual_anchors);
  const rosterLine = `SELECTED MEMBERS FOR THIS DELIBERATION (the only members at the table):\n${selectedNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\n`;
  // FINAL REMINDER identical to the pipeline's, and identical for both
  // variants, so the system prompt is the only variable.
  const user = `${contextBlock}ISSUE:\n${question}\n\n${rosterLine}PROMPT 1 OUTPUT:\n${assembly}\n\nMEMBER PROFILES:\n${profiles}\n\nFINAL REMINDER: Each card is exactly ONE paragraph, 60-100 words total. Framing line ≤ 12 words AND must answer THIS specific issue (not generic philosophy). Challenge line ≤ 8 words ending in ? (chain forward to next speaker; never on the final card). Zero em-dashes anywhere. No exceptions.`;
  return { user, selectedNames, question };
}

// ── Anthropic call (pipeline params: 2500 tokens, temp 0.7) ─────────────
async function callClaude(system, user) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify({
      model: 'claude-sonnet-4-6', max_tokens: 2500, temperature: 0.7,
      system, messages: [{ role: 'user', content: user }],
    }),
  });
  const j = await res.json();
  if (j.error) throw new Error(`API: ${j.error.message}`);
  return { text: j.content.map((c) => c.text || '').join(''), usage: j.usage };
}

// ── Structural checks (mirror the three pipeline guards, light version) ─
function structuralCheck(output, selectedNames) {
  const issues = [];
  const headings = [...output.matchAll(/^##\s+(.+)$/gm)].map((m) => m[1].trim());
  const memberHeadings = headings.filter((h) => !/^the convergence note/i.test(h));
  if (memberHeadings.length !== selectedNames.length) issues.push(`kaarten: ${memberHeadings.length}/${selectedNames.length}`);
  const wrongNames = memberHeadings.filter((h) => !selectedNames.includes(h));
  if (wrongNames.length) issues.push(`naam wijkt af: ${wrongNames.join('; ')}`);
  if (!headings.some((h) => /^the convergence note/i.test(h))) issues.push('convergence note ontbreekt');
  // First card body must name no other member (guard 1).
  const firstBlock = output.split(/^##\s+/m)[1] || '';
  const firstName = (firstBlock.split('\n')[0] || '').trim();
  const firstBody = firstBlock.replace(/\*\*Challenge to[^\n]*/g, '');
  const namedInFirst = selectedNames.filter((n) => n !== firstName && firstBody.includes(n.split(' ').pop()));
  if (namedInFirst.length) issues.push(`eerste kaart noemt: ${namedInFirst.join(', ')}`);
  // Challenge chain: each challenge targets the immediately next heading (guard 2).
  const blocks = output.split(/^##\s+/m).slice(1).filter((b) => !/^the convergence note/i.test(b));
  blocks.forEach((b, i) => {
    const ch = b.match(/\*\*Challenge to ([^:*]+)[:*]/);
    if (!ch) return;
    if (i === blocks.length - 1) { issues.push('challenge op laatste kaart'); return; }
    const next = (blocks[i + 1].split('\n')[0] || '').trim();
    if (ch[1].trim() !== next) issues.push(`challenge kaart ${i + 1} → "${ch[1].trim()}" maar volgende is "${next}"`);
  });
  return issues;
}

// ── Main ────────────────────────────────────────────────────────────────
async function main() {
  mkdirSync(OUTDIR, { recursive: true });
  const sb = (q) => fetch(`${env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/sessions?${q}`, {
    headers: { apikey: env.SUPABASE_SERVICE_ROLE_KEY, Authorization: `Bearer ${env.SUPABASE_SERVICE_ROLE_KEY}` },
  }).then((r) => r.json());

  const select = 'select=slug,created_at,original_issue,cards';
  const sessions = SLUGS
    ? await sb(`${select}&slug=in.(${SLUGS.split(',').map((s) => `"${s.trim()}"`).join(',')})`)
    : await sb(`${select}&order=created_at.desc&limit=${LIMIT}`);
  console.log(`Prompt A (huidig): ~${Math.round(PROMPT_A.length / 4)} tokens · Prompt B (geconsolideerd): ~${Math.round(PROMPT_B.length / 4)} tokens`);
  console.log(`Sessies: ${sessions.length} · output → ${OUTDIR}\n`);

  const summary = [];
  for (const session of sessions) {
    const { user, selectedNames } = buildUserMessage(session);
    const short = session.slug.slice(0, 34);
    for (const [variant, system] of [['A', PROMPT_A], ['B', PROMPT_B]]) {
      if (ONLY_VARIANT && variant.toLowerCase() !== ONLY_VARIANT.toLowerCase()) continue;
      process.stdout.write(`${short} ${variant}... `);
      try {
        const { text, usage } = await callClaude(system, user);
        writeFileSync(join(OUTDIR, `${session.slug}.${variant}.md`), text);
        const lint = lintDeliberation(text);
        const struct = structuralCheck(text, selectedNames);
        summary.push({ slug: short, variant, lint, struct, usage });
        console.log(`ok (${usage.input_tokens}in/${usage.output_tokens}out)${struct.length ? '  ⚠ ' + struct.join(' | ') : ''}`);
      } catch (e) { console.log(`FAILED: ${e.message.slice(0, 120)}`); }
    }
  }

  console.log('\n═══ LINT-VERGELIJKING ═══');
  for (const row of summary) console.log(formatLintLine(`${row.slug} [${row.variant}]`, row.lint));
  for (const v of ['A', 'B']) {
    const rows = summary.filter((r) => r.variant === v);
    if (!rows.length) continue;
    const t = rows.reduce((a, r) => ({ s: a.s + r.lint.sentences, o: a.o + r.lint.over22, o30: a.o30 + r.lint.over30, c: a.c + r.lint.stuffedCommas, f: a.f + r.lint.forbidden.reduce((x, y) => x + y.count, 0), structs: a.structs + r.struct.length }), { s: 0, o: 0, o30: 0, c: 0, f: 0, structs: 0 });
    console.log(`\nVARIANT ${v}: ${t.o}/${t.s} zinnen >22w (${Math.round(100 * t.o / (t.s || 1))}%) · ${t.o30} >30w · ${t.c} met 4+ commas · ${t.f} verboden woorden · ${t.structs} structuurissues`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
