// Standalone test: run PROMPT1 (assembly) and factual anchors on 4.6 vs Sonnet 5,
// then parse the assembly with the EXACT pipeline parser and check every selected
// name resolves to a real profile file (the phantom-member / parser-break risk).
// No DB writes. Run from the thelongcouncil/ dir: node scripts/ab-prompt1-anchors.mjs
import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const env = {};
readFileSync(join(ROOT, '.env.local'), 'utf-8').split('\n').forEach((l) => {
  const t = l.trim(); if (!t || t.startsWith('#')) return;
  const i = t.indexOf('='); if (i < 0) return; env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
});

const src = readFileSync(join(ROOT, 'pages', 'api', 'pipeline.js'), 'utf-8');
const grab = (name) => {
  const m = src.match(new RegExp('const ' + name + ' = `([\\s\\S]*?)`;', ''));
  if (!m) throw new Error('kon ' + name + ' niet vinden'); return m[1];
};
const PROMPT1 = grab('PROMPT1_SYSTEM');
const ANCHORS = grab('PROMPT_FACTUAL_ANCHORS_SYSTEM');

// ── pipeline parser (gekopieerd, 1:1) ───────────────────────────────────
const normalizeName = (name) => name.toLowerCase().normalize('NFD')
  .replace(/[̀-ͯ]/g, '').replace(/[-–—]/g, ' ')
  .replace(/[^a-z0-9\s]/g, '').trim().replace(/\s+/g, ' ');
function extractSelectedMembers(a) {
  const m = a.match(/SELECTED MEMBERS:\s*\n([\s\S]*?)(?=\n\s*(?:MEMBERS CONSIDERED|CONFIDENCE NOTE)|$)/i);
  if (!m) return { names: [], note: 'GEEN "SELECTED MEMBERS:" sectie' };
  const section = m[1]; const names = []; const seen = new Set();
  const regex = /^\s*(?:\*\*)?\s*\d+\.\s+(.+?)\s*$/gm;
  const strip = (s) => s.replace(/\s*[—–\-―]\s*(Practitioner|Framer|Leader|Thinker)\s*$/i, '').trim();
  let mm;
  while ((mm = regex.exec(section)) !== null) {
    if ((mm[1].match(/\*\*[^*]+\*\*/g) || []).length > 1) continue;
    let r = mm[1].trim().replace(/\*\*/g, '').replace(/^\*|\*$/g, '').trim();
    r = r.replace(/\s*[[(].*$/, '').trim(); r = strip(r);
    if (r.length < 3) continue;
    if (/^(Relevance|Coverage|Will argue):/i.test(r)) continue;
    if (/;/.test(r) || r.split(/\s+/).length > 6) continue;
    const k = normalizeName(r); if (seen.has(k)) continue; seen.add(k); names.push(r);
  }
  return { names, note: null };
}
// profiel-bestandssleutels (zoals loadSelectedProfiles)
const dir = join(ROOT, 'data', 'profiles');
const fileKeys = new Set(readdirSync(dir).filter((f) => f.endsWith('.md'))
  .map((f) => normalizeName(f.replace(/^profile_/, '').replace(/\.md$/, '').replace(/_/g, ' '))));
const resolves = (name) => {
  const k = normalizeName(name); if (fileKeys.has(k)) return true;
  const last = k.split(' ').pop();
  return [...fileKeys].some((fk) => fk.endsWith(last) || fk.startsWith(last));
};
const allProfiles = readdirSync(dir).filter((f) => f.endsWith('.md'))
  .map((f) => readFileSync(join(dir, f), 'utf-8')).join('\n\n---\n\n');

const FIVE = /^claude-(sonnet|opus|fable)-5/;
async function call(system, user, maxTokens, model) {
  const body = { model, max_tokens: maxTokens, system, messages: [{ role: 'user', content: user }] };
  if (FIVE.test(model)) body.thinking = { type: 'disabled' }; else body.temperature = 0.7;
  const t0 = Date.now();
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST', headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const j = await res.json();
  if (j.error) throw new Error(j.error.message);
  const text = (j.content || []).filter((c) => c.type === 'text').map((c) => c.text).join('');
  return { text, secs: ((Date.now() - t0) / 1000).toFixed(1), out: j.usage.output_tokens };
}

const QUESTIONS = [
  'Is AI going to kill us all?',
  'What shape should the ideal distribution of wealth and income in a society take?',
  'How can democracies govern for the long term instead of the next election?',
];
const MODELS = [['4.6', 'claude-sonnet-4-6'], ['S5', 'claude-sonnet-5']];

console.log('=== PROMPT1 (assembly) → parser-check ===\n');
for (const q of QUESTIONS) {
  console.log('Q: ' + q);
  for (const [label, model] of MODELS) {
    try {
      const r = await call(PROMPT1, `MEMBER PROFILES:\n${allProfiles}\n\nTHE ISSUE:\n${q}`, 4000, model);
      const { names, note } = extractSelectedMembers(r.text);
      const unresolved = names.filter((n) => !resolves(n));
      const ok = !note && names.length >= 2 && unresolved.length === 0;
      console.log(`  ${label} ${r.secs}s ${r.out}tok  → ${names.length} leden [${names.join(', ')}]`
        + (note ? `  PARSEFOUT: ${note}` : '')
        + (unresolved.length ? `  ⚠ lost niet op: ${unresolved.join(', ')}` : '')
        + (ok ? '  ✓' : '  ✗'));
    } catch (e) { console.log(`  ${label} FAILED: ${e.message.slice(0, 100)}`); }
  }
  console.log();
}

console.log('=== FACTUAL ANCHORS (grounding-determinisme) ===\n');
for (const q of QUESTIONS) {
  console.log('Q: ' + q);
  for (const [label, model] of MODELS) {
    try {
      const r = await call(ANCHORS, `SHARPENED QUESTION:\n${q}`, 400, model);
      console.log(`  --- ${label} (${r.secs}s) ---\n${r.text.split('\n').map((l) => '    ' + l).join('\n')}`);
    } catch (e) { console.log(`  ${label} FAILED: ${e.message.slice(0, 100)}`); }
  }
  console.log();
}
