// One-off / idempotent backfill: generate per-member "What X would do" actions
// for sessions whose cards.member_actions is missing or empty, mirroring the
// pipeline's generateMemberActions step exactly. Best-effort, read-only on the
// rest of the session. Run from thelongcouncil/:
//   node scripts/backfill-member-actions.mjs [--slug <slug>] [--limit N] [--dry-run]
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env.local', 'utf8').split('\n').filter((l) => l.includes('='))
    .map((l) => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim().replace(/^["']|["']$/g, '')]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY);

const args = process.argv.slice(2);
const getArg = (k) => { const i = args.indexOf(k); return i >= 0 ? args[i + 1] : null; };
const slugArg = getArg('--slug');
const limit = parseInt(getArg('--limit') || '50', 10);
const dryRun = args.includes('--dry-run');

const VAGUE = /\b(consider|explore|examine|review|assess|evaluate|investigate|study|look into|think about|reflect on|contemplate)\b/i;
const SHOULD = /^(should\b|it should\b|the\s+\w+\s+should\b)/i;
const stripEmDashes = (s) => s.replace(/\s*[—–―]\s*/g, ', ');

const PROMPT_MEMBER_ACTIONS_SYSTEM = `You distil, for EACH member at a council deliberation, 2-3 concrete next-step actions that THAT member — and that member alone — would take, given the position in their card. These appear on the detail page under each member in the policy brief, as "What <member> would do".

You read the Layer 2 member cards and the verdict. For each member, you extract 2-3 actions that follow from THEIR specific reasoning.

════════════════════════════════════════════════════════════════
WHAT MAKES THESE DIFFERENT FROM THE COUNCIL ACTIONS
════════════════════════════════════════════════════════════════

These are NOT the council's consensus. They are each member's OWN moves, in their own direction. Members disagree, so their actions will too: one member's actions may directly contradict another's. That is correct and wanted. Do NOT soften them toward agreement, and do NOT make every member say a version of the same thing. Each member's set must be recognisably theirs — a reader who likes that member should see what that specific person would concretely do.

════════════════════════════════════════════════════════════════
SOURCING RULE — NON-NEGOTIABLE
════════════════════════════════════════════════════════════════

Each action MUST derive from a specific position in THAT member's card. Before writing it, identify the sentence in their card that implies it. If their card does not imply a concrete action, give that member only one action, or skip them — better fewer than invented.

You may NOT invent percentages, institutions, treaties, timelines, or policy mechanisms that the member did not reference in their card.

════════════════════════════════════════════════════════════════
WRITING STYLE — same bar as the council actions
════════════════════════════════════════════════════════════════

EVERY ACTION MUST:
1. Begin with an imperative verb (Cut, Fund, Replace, Maintain, Tax, Guarantee, Abolish, Tie, Build, Protect).
2. Name a concrete entity or mechanism the member actually pointed to.
3. Be ≤ 22 words.
4. State WHAT to do, not whether to consider it.
5. Contain ZERO em-dashes. Use comma, period, colon, or semicolon.

FORBIDDEN OPENINGS: "Consider…", "Explore…", "Examine…", "Review…", "Assess…", "Evaluate whether…", "Should…", "It is important to…".

════════════════════════════════════════════════════════════════
OUTPUT FORMAT — exactly this, nothing else
════════════════════════════════════════════════════════════════

For each member, a heading with their EXACT name as given in the input, then 2-3 actions as bullets. No preamble, no commentary, no per-action attribution, no closing summary.

## <Member Name>
- <Verb-first action, ≤ 22 words.>
- <Verb-first action, ≤ 22 words.>

## <Next Member Name>
- <...>

Use the members' names EXACTLY as listed in MEMBERS AT THE TABLE. Produce one block per member, in that order. If a member's card genuinely implies no concrete action, emit their heading with a single best action rather than inventing a second.

QUALITY CHECK before emitting, for every action: imperative verb start? concrete? ≤ 22 words? no "consider/explore/should"? no em-dash? traceable to that member's card? If any fails, rewrite or drop it.`;

async function callClaude(system, user, maxTokens, temperature, model = 'claude-sonnet-4-20250514') {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify({ model, max_tokens: maxTokens, temperature, system, messages: [{ role: 'user', content: user }] }),
  });
  if (!res.ok) throw new Error(`Anthropic ${res.status}: ${await res.text()}`);
  return (await res.json()).content[0].text;
}

function matchMemberName(heading, memberNames) {
  const h = (heading || '').toLowerCase().replace(/[^a-z]/g, '');
  if (!h) return null;
  for (const name of memberNames) {
    const full = name.toLowerCase().replace(/[^a-z]/g, '');
    const last = name.trim().split(/\s+/).pop().toLowerCase().replace(/[^a-z]/g, '');
    if (full && (h.includes(full) || full.includes(h))) return name;
    if (last && last.length >= 3 && (h.includes(last) || last.includes(h))) return name;
  }
  return null;
}

function parseMemberActions(output, memberNames) {
  if (!output || !Array.isArray(memberNames) || memberNames.length === 0) return {};
  const result = {};
  for (const block of output.split(/\n(?=##\s)/)) {
    const m = block.match(/^\s*##\s*([^\n]+)/);
    if (!m) continue;
    const name = matchMemberName(m[1], memberNames);
    if (!name || result[name]) continue;
    const actions = [];
    for (const line of block.split('\n')) {
      const lm = line.trim().match(/^(?:[-*]|\d+\.)\s+(.+)$/);
      if (!lm) continue;
      const a = stripEmDashes(lm[1].trim().replace(/\s+/g, ' '));
      if (!a) continue;
      const words = a.split(/\s+/).length;
      if (words < 3 || words > 30) continue;
      if (VAGUE.test(a)) continue;
      if (SHOULD.test(a)) continue;
      actions.push(a);
      if (actions.length >= 3) break;
    }
    if (actions.length > 0) result[name] = actions;
  }
  return result;
}

let q = sb.from('sessions').select('id, slug, original_issue, sharpened_issue, member_names, cards').order('created_at', { ascending: false });
if (slugArg) q = q.eq('slug', slugArg); else q = q.limit(limit);
const { data: sessions, error } = await q;
if (error) { console.error('fetch error', error); process.exit(1); }

let done = 0, skipped = 0;
for (const s of sessions) {
  const cards = s.cards || {};
  const existing = cards.member_actions && Object.keys(cards.member_actions).length > 0;
  if (existing && !slugArg) { skipped++; continue; }
  const names = Array.isArray(s.member_names) ? s.member_names : [];
  if (!cards.deliberation || !cards.verdict || names.length === 0) { console.log('skip (missing data):', s.slug); skipped++; continue; }

  const issue = s.sharpened_issue || s.original_issue;
  const roster = names.map((n, i) => `${i + 1}. ${n}`).join('\n');
  const userMessage = `ISSUE:\n${issue}\n\nMEMBERS AT THE TABLE (use these EXACT names as ## headings, one block each):\n${roster}\n\nDELIBERATION (Layer 2 member cards):\n${cards.deliberation}\n\nVERDICT:\n${cards.verdict}`;
  let parsed = {};
  try {
    const out = await callClaude(PROMPT_MEMBER_ACTIONS_SYSTEM, userMessage, 1500, 0.6);
    parsed = parseMemberActions(out, names);
  } catch (e) { console.error('generate failed', s.slug, e.message); skipped++; continue; }

  const count = Object.keys(parsed).length;
  console.log(`\n${s.slug} — ${count} member(s):`);
  for (const [name, acts] of Object.entries(parsed)) { console.log(`  ${name}:`); acts.forEach((a) => console.log(`    - ${a}`)); }
  if (count === 0) { skipped++; continue; }

  if (dryRun) { done++; continue; }
  const newCards = { ...cards, member_actions: parsed };
  const { error: upErr } = await sb.from('sessions').update({ cards: newCards }).eq('id', s.id);
  if (upErr) { console.error('update failed', s.slug, upErr.message); skipped++; continue; }
  done++;
}
console.log(`\nDONE. updated=${done} skipped=${skipped} ${dryRun ? '(dry-run, nothing written)' : ''}`);
