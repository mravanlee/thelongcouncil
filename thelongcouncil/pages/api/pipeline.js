import fs from 'fs';
import path from 'path';
import { getServiceSupabase, generateSlug } from '../../lib/supabase';

export const config = { maxDuration: 300 };

// ── Profile loading ─────────────────────────────────────────────────────
function loadAllProfiles() {
  const dir = path.join(process.cwd(), 'data', 'profiles');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  return files.map(f => fs.readFileSync(path.join(dir, f), 'utf-8')).join('\n\n---\n\n');
}

function loadSelectedProfiles(selectedNames) {
  const dir = path.join(process.cwd(), 'data', 'profiles');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  const fileMap = new Map();
  for (const f of files) {
    const nameFromFile = f.replace(/^profile_/, '').replace(/\.md$/, '').replace(/_/g, ' ');
    fileMap.set(normalizeName(nameFromFile), path.join(dir, f));
  }
  const matched = [];
  const missing = [];
  for (const name of selectedNames) {
    const key = normalizeName(name);
    if (fileMap.has(key)) {
      matched.push(fs.readFileSync(fileMap.get(key), 'utf-8'));
    } else {
      missing.push(name);
    }
  }
  if (missing.length > 0) {
    console.warn('[pipeline] Profiles NOT FOUND for selected members:', missing);
    console.warn('[pipeline] Available profile file keys:', Array.from(fileMap.keys()));
    return { profiles: null, missing, availableKeys: Array.from(fileMap.keys()) };
  }
  return { profiles: matched.join('\n\n---\n\n'), missing: [], availableKeys: Array.from(fileMap.keys()) };
}

function normalizeName(name) {
  return name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[-–—]/g, ' ')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

// ── Member extraction from Prompt 1 output ──────────────────────────────
function extractSelectedMembers(assemblyOutput) {
  const selectedMatch = assemblyOutput.match(
    /SELECTED MEMBERS:\s*\n([\s\S]*?)(?=\n\s*(?:MEMBERS CONSIDERED|CONFIDENCE NOTE|$))/i
  );
  if (!selectedMatch) {
    console.warn('[pipeline] Could not locate "SELECTED MEMBERS:" section in Prompt 1 output.');
    return [];
  }
  const section = selectedMatch[1];
  const names = [];
  const regex = /^\s*\d+\.\s+(.+?)\s*$/gm;
  const stripTierSuffix = (s) =>
    s.replace(/\s*[—–\-―]\s*(Practitioner|Framer|Leader|Thinker)\s*$/i, '').trim();
  let match;
  while ((match = regex.exec(section)) !== null) {
    let rawName = match[1].trim().replace(/\*\*/g, '').replace(/^\*|\*$/g, '').trim();
    rawName = stripTierSuffix(rawName);
    if (rawName.length < 3) continue;
    if (/^(Relevance|Coverage|Will argue):/i.test(rawName)) continue;
    names.push(rawName);
  }
  if (names.length === 0) {
    console.warn('[pipeline] Regex matched no names. Section content was:');
    console.warn(section.substring(0, 500));
  }
  return names;
}

// ── Validate that selected names are real council members ────────────────
function validateSelectedMembers(selectedNames) {
  if (selectedNames.length === 0) return false;
  const councilNorm = new Set(ALL_COUNCIL_MEMBERS.map(normalizeName));
  const realMembers = selectedNames.filter(name => {
    const norm = normalizeName(name);
    if (councilNorm.has(norm)) return true;
    const lastName = norm.split(' ').pop();
    return Array.from(councilNorm).some(cn => cn.endsWith(lastName) || cn.startsWith(lastName));
  });
  const valid = realMembers.length >= 2;
  if (!valid) {
    console.warn('[pipeline] Assembly did not select real council members. Got:', selectedNames);
    console.warn('[pipeline] Matched real members:', realMembers);
  }
  return valid;
}

// ── Member metadata extraction (name + type) from Prompt 1 output ──────
function extractMemberMetadata(assemblyOutput) {
  const selectedMatch = assemblyOutput.match(
    /SELECTED MEMBERS:\s*\n([\s\S]*?)(?=\n\s*(?:MEMBERS CONSIDERED|CONFIDENCE NOTE|$))/i
  );
  if (!selectedMatch) return { names: [], types: [] };

  const section = selectedMatch[1];
  const dashChars = '[—–\\-―]';
  const tierPattern = '(Practitioner|Framer|Leader|Thinker|Wildcard)';
  const regex = new RegExp(
    `^\\s*\\d+\\.\\s+(.+?)(?:\\s+${dashChars}\\s+${tierPattern}(?:[/]${tierPattern})?)?\\s*$`,
    'gm'
  );

  const stripTierSuffix = (s) =>
    s.replace(/\s*[—–\-―]\s*(Practitioner|Framer|Leader|Thinker|Wildcard)(\/\w+)?\s*$/i, '').trim();

  const names = [];
  const types = [];
  let match;
  while ((match = regex.exec(section)) !== null) {
    const rawName = match[1].trim().replace(/\*\*/g, '').replace(/^\*|\*$/g, '').trim();
    const cleanName = stripTierSuffix(rawName);
    if (cleanName.length < 3) continue;
    if (/^(Relevance|Coverage|Will argue):/i.test(cleanName)) continue;
    names.push(cleanName);
    const raw = match[2] ? match[2].toLowerCase() : 'unknown';
    const type = (raw === 'practitioner') ? 'leader'
               : (raw === 'framer')       ? 'thinker'
               : (raw === 'leader')       ? 'leader'
               : (raw === 'thinker')      ? 'thinker'
               : (raw === 'wildcard')     ? 'wildcard'
               : 'unknown';
    types.push(type);
  }
  return { names, types };
}
// ── Roster validator ────────────────────────────────────────────────────
const ALL_COUNCIL_MEMBERS = [
  'Lee Kuan Yew', 'Helmut Schmidt', 'Margaret Thatcher', 'Franklin Roosevelt',
  'Franklin D. Roosevelt', 'Konrad Adenauer', 'Nelson Mandela', 'Deng Xiaoping',
  'Mustafa Kemal Ataturk', 'Mustafa Kemal Atatürk', 'David Ben-Gurion',
  'David Ben Gurion', 'Jawaharlal Nehru', 'Indira Gandhi', 'Julius Nyerere',
  'Mahathir Mohamad', 'Ellen Johnson Sirleaf', 'Olof Palme',
  'Simón Bolívar', 'Simon Bolivar',
  'Eleanor Roosevelt', 'Rosa Luxemburg', 'Wangari Maathai',
  'John Maynard Keynes', 'Keynes', 'Friedrich Hayek', 'Hayek',
  'Milton Friedman', 'Friedman', 'John Locke', 'Locke',
  'Jean-Jacques Rousseau', 'Rousseau', 'John Rawls', 'Rawls',
  'Hannah Arendt', 'Arendt', 'Amartya Sen', 'Sen',
  'Albert Hirschman', 'Hirschman', 'Niccolò Machiavelli',
  'Niccolo Machiavelli', 'Machiavelli', 'Confucius', 'Kautilya',
  'Ibn Khaldun', 'Frantz Fanon', 'Fanon', 'Raúl Prebisch',
  'Raul Prebisch', 'Prebisch', 'Ali ibn Abi Talib',
  'Elinor Ostrom', 'Ostrom', 'Sun Tzu',
];

// Post-generation guard for the "first card names no other member" rule.
// PROMPT2 says the opening card responds to the ISSUE directly with no
// reference to any other council member. LLMs occasionally violate this
// (the bug used to be position-1 referencing a forward speaker; same shape
// now that order is free). This isolates the first card by --- separator
// and scans it for any name from the selected roster other than the
// speaker themselves.
function validatePosition1Card(deliberationOutput, selectedNames) {
  if (!deliberationOutput) return { ok: true, reason: 'empty' };
  if (!Array.isArray(selectedNames) || selectedNames.length < 2) return { ok: true, reason: 'too_few_members' };

  const blocks = deliberationOutput
    .split(/(?:^|\n)\s*---\s*(?:\n|$)/)
    .map(b => b.trim())
    .filter(Boolean);
  if (blocks.length < 1) return { ok: true, reason: 'no_cards' };
  const firstCard = blocks[0];

  // Extract the speaker name from the ## heading
  const headingMatch = firstCard.match(/##\s*([^\n]+)/);
  const firstMember = headingMatch ? headingMatch[1].trim() : null;

  const mentions = [];
  for (const member of selectedNames) {
    const cleanMember = member.trim();
    if (firstMember && cleanMember === firstMember) continue;
    const words = cleanMember.split(/\s+/);
    const lastName = words[words.length - 1];
    const candidates = [cleanMember];
    if (lastName.length >= 4 && lastName !== cleanMember) candidates.push(lastName);
    for (const cand of candidates) {
      const escaped = cand.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(firstCard)) {
        mentions.push(cleanMember);
        break;
      }
    }
  }

  if (mentions.length > 0) {
    return { ok: false, firstMember, mentions, card1Preview: firstCard.slice(0, 300) };
  }
  return { ok: true, firstMember };
}

// Post-generation guard: every "Challenge to X" line must target the EXACT
// speaker of the immediately next member card. The final card must not have
// a challenge at all (no next speaker). This isolates each card block, reads
// the heading and the challenge target, and verifies the chain.
function validateChallengeChain(deliberationOutput) {
  if (!deliberationOutput) return { ok: true, reason: 'empty' };

  const blocks = deliberationOutput
    .split(/(?:^|\n)\s*---\s*(?:\n|$)/)
    .map(b => b.trim())
    .filter(Boolean);
  if (blocks.length < 2) return { ok: true, reason: 'no_cards' };

  // Build list of (speaker, hasChallenge, challengeTarget) per MEMBER card,
  // skipping the convergence note block.
  const cards = [];
  for (const b of blocks) {
    if (/##\s*The convergence note/i.test(b)) continue;
    const headingMatch = b.match(/##\s*([^\n]+)/);
    const speaker = headingMatch ? headingMatch[1].trim() : null;
    if (!speaker) continue;
    const challengeMatch = b.match(/\*\*\s*Challenge to\s+([^:*]+?)\s*:\s*([^*\n]*)\*\*/i)
      || b.match(/\*\*\s*Challenge to\s+([^:*]+?):\*\*\s*([^\n]+)/i);
    const target = challengeMatch ? challengeMatch[1].trim() : null;
    const question = challengeMatch ? (challengeMatch[2] || '').trim() : null;
    cards.push({ speaker, hasChallenge: !!challengeMatch, target, question });
  }

  if (cards.length < 2) return { ok: true, reason: 'too_few_member_cards' };

  // Helper: do two name strings refer to the same member? Match on last name
  // or whole-string substring to be tolerant of "Sen" vs "Amartya Sen".
  function sameMember(a, b) {
    if (!a || !b) return false;
    const na = a.toLowerCase().trim();
    const nb = b.toLowerCase().trim();
    if (na === nb) return true;
    if (na.includes(nb) || nb.includes(na)) return true;
    const lastA = na.split(/\s+/).slice(-1)[0];
    const lastB = nb.split(/\s+/).slice(-1)[0];
    return lastA === lastB && lastA.length >= 3;
  }

  const violations = [];
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    const isFinal = i === cards.length - 1;
    if (c.hasChallenge && isFinal) {
      violations.push({ kind: 'final_has_challenge', speaker: c.speaker, target: c.target });
      continue;
    }
    if (c.hasChallenge && !isFinal) {
      const nextSpeaker = cards[i + 1].speaker;
      if (!sameMember(c.target, nextSpeaker)) {
        violations.push({ kind: 'wrong_target', speaker: c.speaker, target: c.target, expectedNext: nextSpeaker });
      }
    }
  }

  if (violations.length > 0) {
    return { ok: false, violations, cards };
  }
  return { ok: true, cards };
}

function validateRoster(deliberationOutput, selectedNames) {
  const selectedNorm = new Set(selectedNames.map(normalizeName));
  for (const name of selectedNames) {
    const words = name.trim().split(/\s+/);
    if (words.length > 1) {
      selectedNorm.add(normalizeName(words[words.length - 1]));
    }
  }
  const violations = [];
  for (const candidate of ALL_COUNCIL_MEMBERS) {
    const norm = normalizeName(candidate);
    if (selectedNorm.has(norm)) continue;
    const escaped = candidate.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const re = new RegExp(`\\b${escaped}\\b`, 'i');
    if (re.test(deliberationOutput)) {
      violations.push(candidate);
    }
  }
  if (violations.length > 0) {
    console.warn('[pipeline] ROSTER VIOLATION — non-selected members referenced in deliberation:', violations);
    console.warn('[pipeline] Selected members were:', selectedNames);
  } else {
    console.log('[pipeline] Roster check PASSED. Selected:', selectedNames.join(', '));
  }
  return violations;
}

// ── Session storage ─────────────────────────────────────────────────────
async function precreateSession(originalIssue) {
  try {
    const supabase = getServiceSupabase();
    let slug = generateSlug(originalIssue);
    let attempt = 0;
    while (attempt < 3) {
      const { data, error } = await supabase
        .from('sessions')
        .insert({ slug, original_issue: originalIssue, sharpened_issue: null, cards: {}, member_names: [], member_types: [] })
        .select()
        .single();
      if (error && error.code === '23505') { attempt += 1; slug = generateSlug(originalIssue); continue; }
      if (error) { console.error('[pipeline] Pre-create error:', error); return null; }
      console.log('[pipeline] Session pre-created:', slug);
      return slug;
    }
    console.error('[pipeline] Pre-create failed after 3 attempts');
    return null;
  } catch (err) {
    console.error('[pipeline] Pre-create exception:', err);
    return null;
  }
}

async function finalizeSession({ slug, sharpenedIssue, assemblyOutput, deliberationOutput, verdictOutput, briefOutput, memberNames, memberTypes, featuredQuote, featuredQuoteMember, actions }) {
  try {
    const supabase = getServiceSupabase();
    const cards = { assembly: assemblyOutput, deliberation: deliberationOutput, verdict: verdictOutput, brief: briefOutput, actions: actions || [] };
    const { data, error } = await supabase
      .from('sessions')
      .update({
        sharpened_issue: sharpenedIssue || null,
        cards,
        member_names: memberNames,
        member_types: memberTypes,
        featured_quote: featuredQuote || null,
        featured_quote_member: featuredQuoteMember || null,
      })
      .eq('slug', slug)
      .select()
      .single();
    if (error) { console.error('[pipeline] Finalize error:', error); return null; }
    console.log('[pipeline] Session finalized:', slug);
    return data;
  } catch (err) {
    console.error('[pipeline] Finalize exception:', err);
    return null;
  }
}

async function saveSessionToDatabase({ originalIssue, sharpenedIssue, assemblyOutput, deliberationOutput, verdictOutput, briefOutput, memberNames, memberTypes, featuredQuote, featuredQuoteMember, actions }) {
  try {
    const supabase = getServiceSupabase();
    const cards = { assembly: assemblyOutput, deliberation: deliberationOutput, verdict: verdictOutput, brief: briefOutput, actions: actions || [] };
    let slug = generateSlug(sharpenedIssue || originalIssue);
    let attempt = 0;
    let inserted = null;
    let lastError = null;
    while (attempt < 3 && !inserted) {
      const { data, error } = await supabase
        .from('sessions')
        .insert({
          slug,
          original_issue: originalIssue,
          sharpened_issue: sharpenedIssue || null,
          cards,
          member_names: memberNames,
          member_types: memberTypes,
          featured_quote: featuredQuote || null,
          featured_quote_member: featuredQuoteMember || null,
        })
        .select()
        .single();
      if (error && error.code === '23505') { attempt += 1; slug = generateSlug(sharpenedIssue || originalIssue); lastError = error; continue; }
      if (error) { lastError = error; break; }
      inserted = data;
    }
    if (!inserted) { console.error('[pipeline] Failed to save session to database:', lastError); return null; }
    console.log('[pipeline] Session saved (fallback path):', inserted.slug);
    return inserted;
  } catch (err) {
    console.error('[pipeline] Database save error:', err);
    return null;
  }
}

async function deleteOrphanSession(slug) {
  try {
    const supabase = getServiceSupabase();
    await supabase.from('sessions').delete().eq('slug', slug);
    console.log('[pipeline] Cleaned up orphan session:', slug);
  } catch (err) {
    console.error('[pipeline] Cleanup failed:', err);
  }
}

// ── Claude API call ─────────────────────────────────────────────────────
async function callClaude(system, user, maxTokens = 4000, temperature = 1.0) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: 'claude-sonnet-4-20250514',
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: 'user', content: user }],
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }
  const data = await res.json();
  return data.content[0].text;
}

// ── Featured quote extraction ───────────────────────────────────────────
// Picks one short pull-quote from the deliberation for the homepage display.
// Best-effort: returns null on any failure — session still saves, quote stays NULL.
async function extractFeaturedQuote(originalIssue, deliberationOutput) {
  try {
    const prompt = `You are picking ONE pull-quote from a council deliberation. The quote will appear on a homepage as a magazine-style headline.

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
${originalIssue}

DELIBERATION:
${deliberationOutput}

Return EXACTLY this format, no preamble:
QUOTE: "the chosen quote here"
MEMBER: Member Name`;

    const responseText = await callClaude('', prompt, 200, 1.0);
    const qm = responseText.match(/QUOTE:\s*"([^"]+)"/i);
    const mm = responseText.match(/MEMBER:\s*(.+?)(?:\n|$)/i);
    if (!qm || !mm) {
      console.error('[pipeline] Quote parse failed:', responseText.slice(0, 200));
      return null;
    }
    return { quote: qm[1].trim(), member: mm[1].trim() };
  } catch (err) {
    console.error('[pipeline] Quote extraction failed:', err.message);
    return null;
  }
}

// ── Action extraction (Layer-1 "What to do now") ────────────────────────
// Distils 2-3 imperative next-step actions from the deliberation + verdict.
// Each action is required to derive from a specific member's argument
// (the D-rule) so we don't invent policy mechanisms no one proposed.
async function generateActions(originalIssue, deliberationOutput, verdictOutput) {
  try {
    const userMessage = `ISSUE:\n${originalIssue}\n\nDELIBERATION (Layer 2 member cards):\n${deliberationOutput}\n\nVERDICT:\n${verdictOutput}`;
    const output = await callClaude(PROMPT_ACTIONS_SYSTEM, userMessage, 700, 0.6);
    return output.trim();
  } catch (err) {
    console.error('[pipeline] Action extraction failed:', err.message);
    return null;
  }
}

function parseActions(actionsOutput) {
  if (!actionsOutput) return [];
  const actions = [];
  for (const line of actionsOutput.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const match = trimmed.match(/^\d+\.\s*(.+)$/);
    if (match) actions.push(match[1].trim());
  }
  return actions;
}

const VAGUE_ACTION_VERBS = /\b(consider|explore|examine|review|assess|evaluate|investigate|study|look into|think about|reflect on|contemplate)\b/i;
const SHOULD_PREFIX = /^(should\b|it should\b|the\s+\w+\s+should\b)/i;

function validateActions(actions) {
  if (!actions || actions.length === 0) return { ok: false, reason: 'no_actions' };
  if (actions.length > 3) return { ok: false, reason: 'too_many', count: actions.length };
  const violations = [];
  for (const action of actions) {
    const words = action.split(/\s+/).length;
    if (words > 30) violations.push({ action: action.slice(0, 60), reason: 'too_long', words });
    if (VAGUE_ACTION_VERBS.test(action)) violations.push({ action: action.slice(0, 60), reason: 'vague_verb' });
    if (SHOULD_PREFIX.test(action)) violations.push({ action: action.slice(0, 60), reason: 'should_framing' });
    // Concrete anchor check: at least one of [Capitalised proper noun > 3 chars] OR [digit] OR [% / year-like]
    const hasProperNoun = /\b[A-Z][a-zA-Z]{2,}/.test(action);
    const hasDigit = /\d/.test(action);
    if (!hasProperNoun && !hasDigit) violations.push({ action: action.slice(0, 60), reason: 'no_concrete_anchor' });
  }
  if (violations.length > 0) return { ok: false, violations };
  return { ok: true };
}

// ── Prompts ─────────────────────────────────────────────────────────────

const PROMPT1_SYSTEM = `You are the Council Assembly Engine for The Long Council — a product that assembles documented historic leaders and thinkers to deliberate on real governance, geopolitical and economic policy questions.

Your task is to select the most relevant members from the council roster for the issue provided. You are not generating reasoning yet — only selecting who should sit at the table and why.

CONFIDENCE SIGNALS — used throughout all outputs:
[documented] — directly traceable to a specific decision, speech, or published position in the member's T1–T3 profile. Always cite the specific source.
[inferred] — consistent with multiple documented positions but not a direct quote or recorded decision. State why the inference is warranted.
[extrapolated] — logical extension of documented positions to a domain or era beyond the member's direct experience. Must be explicitly framed as such.
[no documented position] — the member has no recorded position on this topic. Silence noted honestly. Do not fill the gap.

SELECTION RULES:
1. SELECT 3–6 MEMBERS covering every distinct analytical tradition genuinely relevant to this issue. Err toward 4–5 rather than the minimum. A council of 2 is almost never enough — someone is always missing. Include both Leaders (decision-makers) and Thinkers (theorists) unless the issue is purely one or the other.
2. RELEVANCE IS THE ONLY CRITERION. Do not select members to achieve geographic or gender balance if they are not genuinely relevant.
3. ASSESS CONFIDENCE LEVEL BEFORE SELECTING. Prefer [documented] coverage.
4. ENSURE DIVERSITY OF ANALYTICAL TRADITION. Avoid selecting members who all reason from the same framework.
5. IDENTIFY THE CENTRAL TENSION FIRST. Select members who will sit on different sides of that tension.
6. APPLY THE TAXONOMY. Tag the issue: Economic / Social / Political / Crisis / Geopolitical / Technological.
7. SPECIAL FLAGS: Do not select Sun Tzu for cooperative governance problems. Flag Rousseau's general will when live.

YOU MUST SELECT FROM THE COUNCIL ROSTER ONLY. These are real documented historical figures with profiles in the system. Do not invent members, do not select based on acronyms or abstract categories, do not decline to select. If the question is answerable by any analytical tradition represented in the council, select members and deliberate.

OUTPUT FORMAT — return exactly this structure:

ISSUE SUMMARY: [One sentence restating the issue as a specific decision]

TAXONOMY TAGS: [2–3 tags]

CENTRAL TENSION: [One sentence identifying the core analytical conflict]

SELECTED MEMBERS:

1. [Name] — [Leader/Thinker]
   Relevance: [One sentence on why this member is selected]
   Coverage: [documented / inferred / extrapolated] — [Which specific T1/T2/T3 entries are most relevant]
   Will argue: [One sentence on the direction of their expected position]

[Repeat for each selected member]

MEMBERS CONSIDERED BUT NOT SELECTED:
[2–3 candidates not chosen and the specific reason each was excluded]

CONFIDENCE NOTE:
[Flag if any selected member has predominantly extrapolated coverage]`;

const PROMPT2_SYSTEM = `You are the Deliberation Engine for The Long Council — a product that assembles documented historic leaders and thinkers to deliberate on real governance, geopolitical and economic policy questions.

Your task is to generate the reasoning cards for this session — the sequential first-person responses from each selected member.

════════════════════════════════════════════════════════════════
ROSTER DISCIPLINE — ABSOLUTE RULE, APPLIES BEFORE ALL OTHERS
════════════════════════════════════════════════════════════════

This deliberation includes ONLY the members whose profiles appear in the MEMBER PROFILES section of the input. These are the only members at the table. The SELECTED MEMBERS section of the input lists them by name.

YOU MAY NEVER TREAT ANOTHER HISTORICAL FIGURE AS A PARTICIPANT IN THIS DELIBERATION. This means:

- No "Schmidt is right that..." or "As Thatcher argued..." unless Schmidt or Thatcher is in the SELECTED MEMBERS list.
- No challenging, extending, or building on the argument of a figure who is not in SELECTED MEMBERS.
- No framing a point as a response to a figure not in the session.
- No invoking "as Keynes would say" or "Machiavelli reminds us" if that person is not at this table.

YOU MAY reference historical persons as part of a member's own lived experience:

- Schmidt referencing Kissinger as a counterpart in his 1970s talks
- Thatcher referencing Reagan or Gorbachev in her own story
- Roosevelt referencing Churchill in wartime negotiations
- A historian referencing figures they studied

The distinction: figures IN a member's story are fine. Figures treated as FELLOW DELIBERATORS are forbidden unless they appear in SELECTED MEMBERS.

CHECK BEFORE EMITTING EACH CARD: every person you name who is being agreed with, disagreed with, challenged, or whose argument you build on must appear in SELECTED MEMBERS. If they do not, rewrite the passage without naming them.

VIOLATION OF THIS RULE BREAKS THE PRODUCT. A council member referring to someone who isn't at the table is a critical error, not a stylistic choice.

════════════════════════════════════════════════════════════════
NAMING DISCIPLINE — USE THE CANONICAL FORM EXACTLY
════════════════════════════════════════════════════════════════

The names listed in SELECTED MEMBERS are the CANONICAL forms for this session. Every \`##\` heading and every inline reference must match the canonical form EXACTLY, character for character.

DO NOT add a middle initial that is not in the canonical form.
DO NOT drop a middle initial that IS in the canonical form.
DO NOT add or drop titles (\`Sir\`, \`Dame\`, \`Jr.\`, \`Sr.\`).
DO NOT acronymise (\`FDR\`, \`MLK\`, \`JFK\`).
DO NOT change accents, diacritics or spelling.

EXAMPLES (illustrative — adapt to actual SELECTED MEMBERS):

- If SELECTED MEMBERS says "Albert Hirschman" — write **"Albert Hirschman"** in heading and references.
  WRONG: "Albert O. Hirschman" (added middle initial).
- If SELECTED MEMBERS says "Franklin D. Roosevelt" — write **"Franklin D. Roosevelt"**.
  WRONG: "Franklin Roosevelt" (dropped initial). WRONG: "FDR" (acronym substitute).
- If SELECTED MEMBERS says "Niccolò Machiavelli" — preserve the accent: **"Niccolò Machiavelli"**.
  WRONG: "Niccolo Machiavelli" (dropped accent). WRONG: "Machiavelli" (dropped first name).
- If SELECTED MEMBERS says "Lee Kuan Yew" — write **"Lee Kuan Yew"**, not "Lee K. Yew" or "Kuan Yew".

WHY THIS MATTERS: the canonical form is used to look up avatar assets and to link card references back to the council page. Any variation breaks both. There is no creative latitude here.

CHECK BEFORE EMITTING EACH CARD: does the \`##\` heading match the SELECTED MEMBERS entry character-for-character? If not, rewrite the heading.

════════════════════════════════════════════════════════════════
VOICE — BOLD, DIRECT, POSITIONED
════════════════════════════════════════════════════════════════

Every card is testimony, not an essay. The member sits at a table and says something that stays with you. They do not introduce a position. They take one.

THE FIRST SENTENCE OF PARAGRAPH 1 MUST TAKE A POSITION. Not warm up to one.

FORBIDDEN OPENING MOVES:
- "X has merit, but..." — hedging before committing
- "The question is whether..." — introducing instead of answering
- "It is important to consider..." — academic throat-clearing
- "X raises an important point..." — deferring before engaging

REQUIRED: State what you believe in the first sentence. Back it up in the sentences that follow.

WRONG: "Tocqueville's civic education argument has merit, but it confuses the means with the end."
RIGHT: "Forced participation destroys the thing it tries to save."

WRONG: "Mandatory voting is a governance necessity; democracy requires informed participation."
RIGHT: "Passionate minorities govern when moderate majorities stay home. That is not democracy."

WRONG: "Roosevelt raises an important point about moral accountability."
RIGHT: "Roosevelt is right. Leaders who absorb no personal cost for their positions have no skin in the game."

THE FRAMING LINE IS A CLAIM, NOT A TOPIC.
A topic names what the card is about. A claim says what the member believes.

WRONG (topic): "Democracy requires deliberation to function."
WRONG (topic): "The relationship between participation and legitimacy is complex."
RIGHT (claim): "Forced participation destroys the choice that makes participation meaningful."
RIGHT (claim): "Moderate majorities don't vote because politics doesn't reach them. Not because they're lazy."
RIGHT (claim): "You cannot compel civic virtue. You can only create the conditions where it grows."

The framing line is the member's core position in one sentence. It does not introduce what follows; it states the conclusion. The paragraph grounds it with evidence. The framing line does not need to be restated in the paragraph.

THE FRAMING LINE MUST STAND ALONE — FOR EVERY MEMBER, INCLUDING POSITIONS 2, 3, 4, 5.
It cannot reference another council member by name. It cannot react to a previous argument. It cannot use "but", "however", "contrary to", "unlike X", "underestimates", "overestimates", "is right", or "is wrong".
It states what THIS member believes, independent of the debate.
A reader who sees only this sentence, with no context, must understand it as a complete thought.

THIS IS THE MOST COMMON FAILURE IN THIS PROMPT. The model writes the paragraph (which may engage another speaker), then writes the framing line as a preview of the paragraph. This is wrong. The framing line is not a preview of the engagement. It is this member's position on the ISSUE itself.

WRONG (references another council member): "Confucius mistakes the means for the end."
WRONG (references another council member): "Roosevelt's verification problem is the heart of the matter."
WRONG (reactive): "Schmidt underestimates what moral authority can achieve."
WRONG (reactive): "Keynes is right but ignores the supply side."
RIGHT (standalone position on the issue): "Political survival demands methods suited to the contest, not to an ideal order."
RIGHT (standalone position on the issue): "Moral authority without enforcement is not authority. It is aspiration."
RIGHT (standalone position on the issue): "Every state that joins a treaty assumes the others will cheat."
RIGHT (standalone position on the issue): "A ruler who cannot be trusted destroys governance faster than bad policy."
RIGHT (standalone position on the issue): "Bureaucracies survive every reformer they meet."
RIGHT (standalone position on the issue): "Sovereignty without enforcement is a press release."

════════════════════════════════════════════════════════════════
LANGUAGE DISCIPLINE — THE READER MUST UNDERSTAND ON FIRST PASS
════════════════════════════════════════════════════════════════

These cards are read on a phone, top to bottom. Long sentences and abstract nouns lose the reader. Each card is a small piece of testimony, not an essay.

FIVE NON-NEGOTIABLE RULES:

1. NO ABSTRACT ESCAPE-HATCH WORDS.
   FORBIDDEN in any card body, framing line, AND challenge line:

     "tension"             — say what conflicts with what
     "paradigm"            — say what people believe
     "fundamental"         — cut entirely. There is no rewrite. Cut the word and rebuild the sentence.
     "irreconcilable"      — say what cannot be combined and why
     "incompatible"        — say what doesn't fit with what
     "trajectory"          — say where things go
     "dynamics"            — say what is happening
     "framework"           — say the actual idea. Forbidden in card body, framing line, AND challenge line.
     "the conditions for"  — rephrase with a verb
     "the requirements of" — rephrase with a verb
     "authentic"           — cut. Say what is real instead.
     "genuine"             — cut. Say what is real instead.
                             WRONG: "genuine political action" / "authentic participation"
                             RIGHT: "citizens choosing to act" / "participation that costs something"
     "the key is..."        — meta-narration. Just state the key thing directly.
     "the principle is..."  — same. Demonstrate it, don't label it.
     "what this teaches..." — same. Let the example teach.
     "X requires X-thinking"— empty tautology. Cut.
     "the deeper principle" — almost always announces filler. Cut.

   These words allow saying nothing in many words. Replace with what actually happens to whom.

   ALSO FORBIDDEN — ABSTRACTION-CHAIN CONSTRUCTIONS:

   PATTERN 1 — "X requires Y" / "X demands Y" where X and Y are both abstract nouns.
     ✗ "Datacenter policy requires the same experimental approach."
     ✗ "Democratic legitimacy requires authentic civic engagement."
     ✓ Rewrite with verbs and concrete subjects.

   PATTERN 2 — abstract noun stacks: "the speed sovereignty requires", "the gradualism stability demands".
     ✗ "Europe faces a trade-off between the speed sovereignty requires and the gradualism stability demands."
     ✓ "Europe must either build fast and risk backlash, or build slowly and lose the race."

   PATTERN 3 — Abstract subject + abstract verb + abstract object.
     ✗ "Polycentric governance coordinates competing demands across scarce energy resources."
     ✓ "Local towns, national grids, and EU regulators each control different pieces. They have to negotiate."

   IF A SENTENCE CONTAINS NO PERSON, NO PLACE, NO YEAR, AND NO CONCRETE OBJECT — REWRITE IT.
   The reader should be able to picture what the sentence describes. If they cannot, the sentence is not finished.

2. VERBS OVER NOUNS. NO -TION-CHAINS.
   "The destruction of Taiwan's industry" → "Taiwan's industry is destroyed"
   "The integration of economies"          → "economies become tied together"
   "A reduction in growth"                 → "growth slows"
   "The implementation of reforms"         → "the reforms run"

   Where a noun-form (-tion, -ment, -ance, -ity) can be replaced by a working verb, replace it.

3. MAX 22 WORDS PER SENTENCE.
   Hard ceiling. Short sentences at moments of emphasis. If a sentence runs longer, split at the first natural break.

4. EM-DASH DISCIPLINE — ZERO EM-DASHES ANYWHERE.
   No em-dashes ("—") in the card body, the framing line, the challenge line, OR the convergence note. None. Anywhere.
   Em-dashes are a Claude tic that signals AI-generated prose. Every em-dash you would write must become a comma, a period, a colon, or a semicolon.
   If you reach for an em-dash, ask: does this clause earn a full sentence, or should it be deleted?
   This rule applies to en-dashes as text separators too. Year ranges like "1974–82" in the role line are fine; everywhere else use punctuation.

5. SENTENCE RHYTHM — SHORT AFTER LONG.
   Never write more than two sentences of similar length in a row.
   After a long setup sentence, land with a short punch. Then build again.

   WRONG (all medium, no rhythm, academic):
   "America's technological advantage rests on market-driven innovation, but markets alone cannot build the industrial foundations that innovation requires. In 1978 I opened China selectively, importing technology and capital while maintaining political control over the development process."

   RIGHT (position first, short punches, rhythm):
   "Markets discover products. States build industries. America has confused the two. In 1978 I opened China selectively. I imported technology, kept political control, and let neither run loose."

   Pattern to aim for: SHORT. SHORT. MEDIUM. or MEDIUM. SHORT. MEDIUM. SHORT.
   A paragraph of all medium-length sentences is a lecture. A card with rhythm is testimony.

════════════════════════════════════════════════════════════════
CRITICAL OUTPUT CONSTRAINTS — READ FIRST
════════════════════════════════════════════════════════════════

STEP 1 — PICK THE OPENING VOICE.

The first card reacts directly to the ISSUE itself. Choose whichever member is most positioned to respond first — usually a modern decision-maker with direct experience on this question, but it can be any member if their angle gives the sharpest opening.

THE FIRST CARD NAMES NO OTHER COUNCIL MEMBER ANYWHERE. No "X is right", no "as Y would argue", no "echoing Z", no "Schmidt's experience" if Schmidt is at the table. The opening engages the ISSUE, not the lineup. Read the first card without context: it must stand alone as a complete response to the question.

STEP 2 — ORDER THE REMAINING CARDS BY WHAT READS NATURAL.

There is no fixed sequence. No SPEAKING ORDER header. No "leaders first, thinkers last" rule. Order each next card so it builds genuine debate — not because the lineup requires it, but because that's what creates movement on the page.

Subsequent cards MAY:
- Engage a card already written, by name ("Schmidt is right that…", "Ostrom's polycentric approach fails to…")
- Pick up a thread from two or three cards earlier — not necessarily the immediately preceding one
- Respond purely to the issue without referencing any other member

REFERENCE RULE: a card may only name another member who has ALREADY been written in your output. Never reference a member who appears later. Forward references break the reading flow.

STEP 3 — INTERACTION IS ESSENTIAL, BUT NOT REQUIRED IN EVERY CARD.

A deliberation without engagement is a set of monologues. The MAJORITY of cards after the first must show real engagement with another voice: by name reference in the paragraph, by a sharp disagreement, or by extending an earlier point. One card may be a pure response to the issue if its voice is strong enough to stand alone, but parallel monologues across all cards are a failed deliberation.

STEP 4 — BEGIN CARDS.

Begin the first card with \`---\`. No preamble, no meta-commentary, no title block.

Do NOT emit any of the following:
- Titles like "Deliberation Engine Output" or "The Long Council — Session"
- Headings like "Issue Analysis", "Central Tension", "Session Context"
- A restatement of the issue
- Any "##" heading that is not a member's name or "The convergence note"

CRITICAL: HEADINGS CONTAIN ONLY THE MEMBER'S NAME. Nothing else. The role/country/years go on the line BELOW the heading.

CORRECT:
## Helmut Schmidt
Chancellor, West Germany 1974–82

WRONG:
## Helmut Schmidt — position 1
## Helmut Schmidt (Leader)

════════════════════════════════════════════════════════════════
FORBIDDEN WORDS AND PHRASINGS
════════════════════════════════════════════════════════════════

The word "documented" MUST NEVER appear in the prose of any card.
Also avoid "evidenced", "attested", "on the record".
Do not emit bracketed confidence tags like [documented], [inferred], [extrapolated].

NO SELF-CITATION OF WRITTEN WORKS.
Members reference events, decisions, policies, and lived experience — NOT their own books, chapters, or treatises.

FORBIDDEN:
- "As I wrote in Chapter 6 of The Art of War..."
- "In my Prince I argued..."
- "My General Theory demonstrated..."

CORRECT:
- State the principle directly in first person.
- Reference decisions and events, not publications.
- Ancient thinkers speak the principle in their own voice, in modern English, without naming the work it came from.

════════════════════════════════════════════════════════════════
CONFIDENCE — INTERNAL REASONING DISCIPLINE
════════════════════════════════════════════════════════════════

Before writing each claim, mentally assign it to one of four categories:

GROUNDED    — directly traceable to a specific decision, speech, or published position.
CONSISTENT  — not a direct quote, but follows from multiple documented positions.
EXTENDED    — a logical extension to a domain or era beyond the member's direct experience.
ABSENT      — no recorded position. Do not fill the gap.

Communicate confidence through the prose:

- GROUNDED: name the decision, year, speech, or event — always in first person. "In November 1973 I told the Bundestag..."
- CONSISTENT: state the claim directly.
- EXTENDED: frame the leap explicitly. "I did not govern in an era of cyber warfare, but I governed during the oil embargo, and the structure is identical."
- ABSENT: acknowledge silence plainly. "On 21st-century digital currency I have no position to offer."

════════════════════════════════════════════════════════════════
REASONING CARD RULES
════════════════════════════════════════════════════════════════

1. CARDS APPEAR IN THE ORDER YOU WRITE THEM.
   No SPEAKING ORDER header. The first card you emit is the opening voice — chosen for substance, not lineup.

2. BACKWARD REFERENCES ONLY.
   A card may name only members who have ALREADY been written in your output. Never reference a member who appears later. The first card names no other member at all.

3. CHALLENGE LINES CHAIN FORWARD TO THE IMMEDIATELY NEXT SPEAKER.
   A card MAY end with:
     **Challenge to [the EXACT speaker of the very next card]:** [≤ 8 words, ending in ?]

   THE CHALLENGE MAY ONLY BE DIRECTED AT THE MEMBER WHOSE CARD COMES IMMEDIATELY AFTER THIS ONE IN YOUR OUTPUT. Not two cards ahead. Not a backward reference. Not "any member at the table". The IMMEDIATELY NEXT speaker.

   This creates a debate chain: card N challenges card N+1's speaker, and card N+1 opens by engaging with that challenge in its first sentence.

   When card N+1 opens, its first sentence should ACKNOWLEDGE the challenge from card N (agreeing, refuting, reframing) before pivoting to its own position. If you would not want card N+1 to open by addressing this challenge, do not include the challenge line on card N.

   The first card has no challenge line (no one has spoken yet AND it must engage the ISSUE, not the lineup). THE FINAL CARD ALSO HAS NO CHALLENGE LINE (no next speaker to chain to). Both are hard rules.

   Challenge lines remain OPTIONAL on middle cards. If the disagreement with the next speaker is not sharp enough, omit the challenge. Better no challenge than a forced one.

4. EVERY CARD IS FIRST-PERSON, IN CONTEMPORARY ENGLISH.

   THE MEMBER SPEAKS AS THEMSELVES. ALWAYS "I", "ME", "MY", "WE" — NEVER THEIR OWN NAME IN THE THIRD PERSON.

   ✗ WRONG: "Schmidt's experience managing the 1973 oil embargo taught him that..."
   ✓ CORRECT: "My experience managing the 1973 oil embargo taught me that..."

   PRESERVE: characteristic tone (dry, aphoristic, moral, strategic, skeptical, paternal), habitual angle on problems.
   DO NOT preserve: archaic phrasing, period syntax, dated vocabulary, ceremonial cadence.

   Sun Tzu does not sound like a translation. Confucius does not say "the Master says". Ibn Khaldun does not sound medieval. Every member reads as contemporary prose — only their sensibility distinguishes them.

5. INTERACTION IS ESSENTIAL BUT NOT MANDATORY IN EACH CARD. The majority of cards after the first must show engagement with another voice: by name reference in the paragraph, by a sharp disagreement, or by picking up an earlier thread. One card may stand alone on the issue. Parallel monologues across all cards are a failed deliberation. See Step 3 of CRITICAL OUTPUT CONSTRAINTS.

6. GROUND CLAIMS IN SPECIFIC EVENTS — IN PROSE.
   Year, venue, decision, speech. Never bracketed tags. Never citing written works.

   THE ANCHOR IS NON-NEGOTIABLE. Each card MUST contain at least one specific historical anchor in the paragraph: a year, a decision, a meeting, a speech.

   THEORISTS AND ANCIENT THINKERS: this rule applies to you too. Name a historical event you witnessed, a ruler you advised, a collapse you observed, a city you governed. If no direct anchor exists, frame the extended claim explicitly: "I did not govern in an era of X, but I watched [concrete event] and the pattern is the same." A card with no person, place, or year in the paragraph cannot ship.

7. EACH CARD HAS THREE PARTS — FOLLOW EXACTLY:

   a) FRAMING LINE — THIS IS THE HOOK
      One sentence in italics, MAXIMUM 12 WORDS. Present tense. One claim, declarative.
      It is a CLAIM, not a topic. It states what the member believes about the ISSUE.
      No "but", "however", "although", "while". No hedging. No two-clause constructions.
      Zero em-dashes. No abstract escape-hatch words. No "framework". No "fundamental". No "genuine". No "authentic".
      No other council member's name. No reaction to the debate. Standalone.

      This sentence is what readers screenshot and share. Make it triggerend. Sharp enough to provoke either nodding or disagreement on first read.

      GOOD FRAMING LINES (≤ 12 words, declarative, sharp, triggers a reaction):
      ✓ "Markets discover products. States build industries." (7 words)
      ✓ "Bureaucracies survive every reformer they meet." (6 words)
      ✓ "Sovereignty without enforcement is a press release." (7 words)
      ✓ "Polarisation is a luxury crises cannot afford." (7 words)
      ✓ "A ruler who cannot be trusted destroys governance faster than bad policy." (12 words)
      ✓ "Every state that joins a treaty assumes the others will cheat." (11 words)

      BAD FRAMING LINES (too long, hedged, abstract, or two clauses):
      ✗ "The relationship between innovation and regulation requires careful balance, but markets must lead." (13 words, hedged, "but" clause)
      ✗ "On balance, it appears that some form of intervention is warranted." (warm-up, no claim)
      ✗ "Democratic legitimacy in the age of AI rests on authentic civic engagement." (abstract noun chain, "authentic")
      ✗ "We need to think carefully about what regulation really means in practice." (no position taken)

      WRITE THE FRAMING LINE LAST, after the body is done. Place it first in output.
      Then ask: ≤ 12 words? Declarative? No other member's name? No "but/however"? Reads like a headline a reader would screenshot?
      If any answer is no: rewrite as if you are the first and only speaker.

   b) REASONING — ONE PARAGRAPH, 50–80 WORDS
      A single paragraph. No second paragraph. No three paragraphs. ONE.

      Opens with a position, not a warm-up. The first sentence states what the member believes.
      Contains exactly ONE historical anchor: a year, a decision, a meeting, a speech, a city.
      For the FIRST CARD: anchor in a specific sourced moment. Name no other member at the table.
      For LATER CARDS: choose whether to engage another already-written speaker by name in the first sentence, or to respond purely to the issue. If engaging, anchor in your own experience after the engagement. The majority of later cards should engage; not all.

      CRITICAL SEPARATION: The name reference belongs IN this paragraph, NOT in the framing line.
      The framing line states your own position on the issue. The paragraph is where you engage others.
      Think of it this way: framing line = what I believe about this issue. Paragraph = here is why, with one anchor, possibly engaging another member.

      WHAT GETS CUT: the old "second move" (counterintuitive point, candid limit, sharp positioning against alternative) does NOT belong on this card anymore. That depth lives in the policy brief. The card is the headline; the brief is the long-form.

      PARAGRAPH BODY — WRONG/RIGHT:

      WRONG (hedging open, academic rhythm, no punch):
      "America's technological advantage rests on market-driven innovation, but markets alone cannot build the industrial foundations that innovation requires. In 1978 I opened China selectively, importing technology and capital while maintaining political control over the development process."

      RIGHT (position first, short punches, concrete anchor, ONE paragraph, ~70 words):
      "Markets discover products. States build industries. America has confused the two. In 1978 I opened China selectively: I imported technology and capital, kept political control, and let neither run loose. The Four Modernisations named science alongside agriculture and defence because states fund what markets ignore."

      The RIGHT version opens with three short sentences that land before the evidence arrives. The WRONG version buries the position in a hedge.

      IF YOU FIND YOURSELF WRITING A SECOND PARAGRAPH: stop. Cut. The card is the headline, not the essay. Move the second-move material to your mental model of the brief; do not emit it here. A single paragraph between 50 and 80 words is the discipline.

     GOOD EXAMPLE — direct opening, ONE paragraph, rhythm, no forbidden words, framing line standalone, no em-dashes:
      ---
      *You cannot compel civic virtue.*

      In 1965 I separated Singapore from Malaysia because the alternative was racial collapse. Survival came first. Schools taught English not because we loved it but because neutrality between Chinese, Malay and Tamil prevented civil war. Every institution I built served a function. The function came before the principle.
      ---

      BAD EXAMPLE — same content, two paragraphs (now forbidden), no rhythm, reads like an essay:
      ---
      *You cannot compel civic virtue. You can only build the conditions where it grows.*

      In 1965 I separated Singapore from Malaysia not because I wanted independence but because the alternative was racial collapse, and survival had to come before any other consideration. Schools taught English not because we loved it but because neutrality between Chinese, Malay and Tamil communities was necessary to prevent civil war.

      Governments today are asking about AI literacy, but this is the wrong question to be asking. The right question is: what does this country need that no one else can provide, and how do institutions deliver those capabilities by 2035?
      ---

   c) CHALLENGE LINE (optional, on any card except the FIRST and the FINAL)
      MAXIMUM 8 WORDS. Must end in a question mark.
      MUST BE DIRECTED AT THE IMMEDIATELY NEXT SPEAKER. Not any member. Not a backward reference. The exact member whose card comes directly after this one.
      Zero em-dashes. No "framework". No "fundamental". No "genuine". No "authentic". No abstract noun chains.
      Include only when there is a sharp, focused disagreement with the next speaker worth surfacing. Some cards have one, some don't.
      THE FIRST CARD never has a challenge line (no one to address yet AND must engage the ISSUE alone). THE FINAL CARD never has a challenge line (no next speaker to chain to). Both are hard rules.

      The challenge must hit something specific the next member would actually have to answer in their opening sentence. Vague abstractions like "your framework" or "your system" fail because there is nothing to answer.

      The next card, when it follows a challenge, opens by engaging with that challenge (agreeing, refuting, reframing) before pivoting to its own position.

      GOOD CHALLENGE EXAMPLES (≤ 8 words, sharp, end in ?, directed at the next speaker):
      - "Schmidt, who pays when markets fail?"
      - "Hayek, what about the polluter?"
      - "Ostrom, can 27 states coordinate fast?"
      - "Friedman, what stops Big Tech capture?"
      - "Arendt, does enforcement need violence?"
      - "Confucius, does virtue scale beyond a city?"

      BAD CHALLENGE EXAMPLES (too long, abstract, or empty):
      - "How do you reconcile this with the structural framework of governance?" (abstract, too long)
      - "Your approach ignores deeper institutional dynamics." (not a question, abstract)
      - "But what about the trade-offs involved here?" (vague, no specific thing to answer)
      - Challenging a member two cards ahead, or a member who already spoke (skips the chain)

8. SURFACE LIVE CONTRADICTIONS.
   If a relevant contradiction exists in the member's record, surface it as a tension they acknowledge within their own argument — not as external criticism.

9. DO NOT PRODUCE FALSE CONSENSUS.
   If members genuinely disagree, show it. Agreement must be earned through argument, not always assumed.

10. LENGTH DISCIPLINE — STRICT.
    Total reasoning per card: 50–80 words in ONE paragraph. No second paragraph.
    Framing line: ≤ 12 words. Challenge line: ≤ 8 words, ending in ?. Each sentence in the paragraph: ≤ 22 words.

════════════════════════════════════════════════════════════════
OUTPUT FORMAT — produce exactly this structure
════════════════════════════════════════════════════════════════

No header above the cards. Begin with the first \`---\`.

---
## [Opening member's name only, nothing else on this line]
[Role, Country, Years]

*[Framing line, THIS member's position on THE ISSUE. No other council member's name. ≤ 12 words. Zero em-dashes.]*

[ONE paragraph, 50–80 words. First sentence takes a position on the ISSUE. No other member named anywhere in this card. Grounded in ONE specific sourced moment. Zero em-dashes.]

(No challenge line on the first card. No one to address yet.)
---
## [Next member's name only]
[Role, Country, Years]

*[Framing line, standalone position on the issue, no member named, ≤ 12 words.]*

[ONE paragraph, 50–80 words. Choose: either engage another already-written card by name in the first sentence, or respond purely to the issue. If engaging, anchor in your own experience after the engagement. Zero em-dashes.]

**Challenge to [the EXACT speaker of the very next card]:** [Optional. Never on the first or final card. ≤ 8 words, ending in ?. Zero em-dashes. Must address the next speaker, not any other member.]
---

[Continue for each remaining member. Use the same structure. Majority of these cards should engage another voice; one may stand alone if its position is strong enough. Challenge lines are optional throughout, except: the FINAL card never has one.]

---

After the final card, emit:

---
## The convergence note

**Where the council converges:**
[1–2 sentences. Max 20 words each. No abstract escape-hatch words.]

**Where it divides:**
[1–3 sentences. Max 20 words each. Name the specific disagreement.]

**What only the policymaker can resolve:**
[1–2 sentences. Max 20 words each. Name the actual choice in concrete language.]

---

════════════════════════════════════════════════════════════════
QUALITY CHECKS — apply before producing output
════════════════════════════════════════════════════════════════

Before writing, ask:
- Have I chosen an opening voice that engages this specific issue directly?
- Is the first card free of any other council member's name?

Before emitting each card, check:

1. HEADING CHECK:
   Does the ## heading contain ONLY the member's name? Any other text: delete it.

2. ROSTER CHECK:
   Does this card name, address, or build on any person NOT in SELECTED MEMBERS?
   If yes, rewrite. Exception: historical persons in the member's own story.

3. SEQUENCING CHECK:
   Does this card name only members ALREADY written above it in your output? Forward references are forbidden.
   Is this the FIRST card? Then no other member is named anywhere in it (paragraphs or challenge).
   Across all later cards: does the MAJORITY engage another voice? At most one card may stand alone on the issue.

4. VOICE CHECK — BOLD AND DIRECT:
   Does the paragraph open with a position, not a warm-up?
   Does the first sentence state what the member believes?
   Does any sentence open with "X has merit, but...", "The question is whether...", "It is important to consider..."? Rewrite.
   Does the member speak in first person throughout? No last-name self-reference.

5. LANGUAGE DISCIPLINE CHECK:
   Does any forbidden word appear anywhere in the card (body, framing line, challenge line)?
   ("tension", "paradigm", "fundamental", "irreconcilable", "incompatible", "trajectory", "dynamics", "framework", "authentic", "genuine", "the conditions for", "the requirements of", "the key is", "the principle is", "what this teaches", "the deeper principle")
   Rewrite without exception. "Fundamental" and "genuine" are especially prone to slipping through in theorists' cards — check twice.
   Does any sentence follow PATTERN 1, 2, or 3? Rewrite.
   Does any sentence have NO concrete content (no person, place, year, or object)? Rewrite.
   Does any sentence run longer than 22 words? Split it.

6. FRAMING LINE CHECK — THIS IS THE MOST COMMONLY VIOLATED RULE:
   Is it ≤ 12 WORDS? Count them. If 13 or more: rewrite shorter. No exceptions.
   Does it contain the name of any other council member? If yes: STOP. Rewrite.
   Does it contain "underestimates", "overestimates", "is right", "is wrong", "unlike", "contrary to", "but", "however", "although", "while"? If yes: rewrite as a single declarative claim.
   Read the framing line with zero context, as if this is the only sentence you have ever seen. Does it state a complete position on the issue? If no: rewrite.
   Is it sharp enough that a reader would either nod or disagree on first read? If it's bland or hedged: rewrite.
   BAD: "Confucius mistakes the means for the end." — contains another council member's name.
   BAD: "Roosevelt's verification problem is the heart of the matter." — contains another council member's name.
   GOOD: "Political survival demands methods suited to the contest, not to an ideal order."
   GOOD: "A ruler who cannot be trusted destroys governance faster than any bad policy."
   This check applies to ALL members, including the opening card.

7. EM-DASH CHECK — ZERO TOLERANCE:
   ANY em-dash ("—") anywhere in the output? Rewrite. No exceptions for "emphasis", "asides", or "stylistic choice".
   Replace every em-dash with a comma, period, colon, or semicolon. If two clauses are joined by an em-dash, ask whether they want to be two sentences. Usually they do.
   This is the single most violated rule. Scan one final time before emitting: zero em-dashes in body, framing line, challenge line, or convergence note.

8. RHYTHM CHECK:
   Are there more than two consecutive sentences of similar length? Break the pattern with a short punch.
   Does the paragraph open with at least one short sentence (under 10 words)? If not, consider whether the opening earns its length.
   Read the card aloud. If it sounds like a lecture, rewrite for rhythm.

9. STRUCTURE & LENGTH CHECK:
   Is the framing line ≤ 12 words? Count them.
   Does the reasoning consist of EXACTLY ONE paragraph? If two or more, MERGE the strongest into one or CUT the second. Do not split into two. The second-move material belongs in the policy brief, not on the card.
   Is the single paragraph within 50–80 words? Count them.
   Is each sentence ≤ 22 words?

10. ANCHOR CHECK:
    Does the paragraph contain at least one specific historical anchor (year, decision, meeting, speech)?
    For theorists: is there a concrete event, ruler, city, or collapse named?
    No anchor: rewrite. The card cannot ship without one.

11. SECOND-MOVE CHECK (NO SECOND PARAGRAPH):
    Did you write two paragraphs? STOP. Merge into one or cut the second. The second-move material (counterintuitive point, candid limit, sharp positioning) belongs in the policy brief now, NOT on the card.
    Does any sentence start with "the key is", "the principle is", "what this teaches"? Cut it.

12. FORBIDDEN WORDS CHECK:
    Does "documented" appear in the prose? Rewrite.
    Are there bracketed tags? Remove.
    Does the card cite a book, chapter, or treatise by name? Rewrite as principle or event.`;

const PROMPT3_SYSTEM = `
You are the Verdict Engine for The Long Council — a product that assembles documented historic leaders and thinkers to deliberate on real governance, geopolitical and economic policy questions.

Your task is to synthesise the reasoning cards from the Deliberation Engine into the conclusion that appears in the conclusion bar at the end of a session. This is what every user reads — whether or not they open the full policy brief. It must stand alone and be worth reading on its own.

The conclusion bar has two parts only: the verdict and the reasoning summary. Nothing else. Limits, unresolved questions, and counterfactuals belong in the policy brief. This output is the front page. Sharp, clear, honest.

════════════════════════════════════════════════════════════════
LANGUAGE DISCIPLINE — THE READER MUST UNDERSTAND ON FIRST PASS
════════════════════════════════════════════════════════════════

Every sentence here is read at speed. Abstraction kills it. The verdict line is the front of the entire product — if a busy reader on a phone cannot understand it in three seconds, you have failed.

THREE NON-NEGOTIABLE RULES:

1. NO ABSTRACT ESCAPE-HATCH WORDS.
   The following words and phrases are FORBIDDEN in verdict and reasoning summary:

     "tension"             — use the actual conflict (what wants what)
     "paradigm"            — use what people actually believe
     "fundamental"         — cut entirely; say what is fundamental
     "irreconcilable"      — say what cannot be combined and why
     "incompatible"        — say what doesn't fit with what
     "trajectory"          — say where things are going
     "dynamics"            — say what is happening
     "framework"           — say the actual idea
     "the conditions for"  — rephrase with verbs
     "the requirements of" — rephrase with verbs
     "authentic" / "genuine" (as adjective on democracy etc.) — cut
     "the key is..."        — meta-narration of your own argument
     "the principle is..."  — same; just state the principle in action
     "what this teaches..." — same; let the example teach
     "X requires X-thinking"— empty tautology
     "the deeper principle" — almost always announces filler
     "scale required for"  — rephrase with verbs
     "requires"            — almost always connects two abstracts. Replace with a verb that names what actually happens.

   These words allow saying nothing in many words. They sound serious but commit to nothing. Replace with what is actually happening to whom.

   ALSO FORBIDDEN — ABSTRACTION-CHAIN CONSTRUCTIONS:

   The model often invents new abstractions to evade the list above. The following SENTENCE PATTERNS are forbidden, regardless of which words they use:

   PATTERN 1 — "X requires Y" / "X demands Y" where X and Y are both abstract nouns.
     ✗ "Datacenter expansion requires polycentric governance design."
     ✗ "Full automation requires universal income support." ("automation" and "income support" are both abstract. Name what actually happens to whom.)
     ✓ Rewrite with verbs: "Automation will displace workers faster than markets can absorb them. Income support is not optional."

   PATTERN 2 — abstract noun stacks.
     ✗ "Europe faces a trade-off between the speed sovereignty requires and the gradualism stability demands."
     ✓ "Europe must either build fast and risk backlash, or build slowly and lose the race."

   PATTERN 3 — Abstract subject + abstract verb + abstract object.
     ✗ "Polycentric governance coordinates competing demands across scarce energy resources."
     ✓ "Local towns, national grids, and EU regulators each control parts of the energy system. They must negotiate."

   IF A SENTENCE CONTAINS NO PERSON, NO PLACE, NO YEAR, AND NO CONCRETE OBJECT — REWRITE IT.
   The reader should be able to picture what the sentence describes. If they cannot, the sentence is not yet finished.

2. VERBS OVER NOUNS. NO -TION-CHAINS.
   "The destruction of Taiwan's industry" → "Taiwan's industry is destroyed"
   "The construction of legitimacy"        → "How leaders earn trust"
   "The integration of economies"          → "Economies become tied together"
   "A reduction in growth"                 → "Growth slows"

   Where a noun-form (-tion, -ment, -ance, -ity) can be replaced by a working verb, replace it.

3. ZERO EM-DASHES. Anywhere in the verdict line, reasoning summary, or anywhere in this output. No exceptions. Em-dashes ("—") are a Claude tic. Every one becomes a comma, period, colon, or semicolon. Scan twice before emitting.

4. MAX 20 WORDS PER SENTENCE. THIS IS A HARD CEILING, NOT A GUIDELINE.

   After writing each sentence, count the words. If the count exceeds 20: split the sentence at the first natural break. Do not compress — split.

   Most verdict lines that run long are doing two things at once. Name the first thing. Then name the second thing. Two sentences are always cleaner than one long one.

   BAD — 33 words, Pattern 1, two ideas crammed into one:
   ✗ "Full automation requires universal income support, but the choice between private ownership with transfers versus collective ownership of machines determines whether abundance creates freedom or dependence."

   GOOD (same insight, two sentences of 13 and 16 words):
   ✓ "Automation will displace workers faster than markets can absorb them. Income support is not optional."
   ✓ "But who owns the machines determines whether that abundance creates citizens or dependents."

   EXAMPLES OF VERDICT LINES THAT FAIL:
   ✗ "The European Union faces an irreconcilable tension between the scale required for effective governance and the conditions necessary for authentic democratic participation." (abstract words, Pattern 2, 23 words)
   ✗ "China's military strategy operates within a fundamental paradigm of strategic patience." ("fundamental paradigm" hides the actual claim)

   EXAMPLES OF VERDICT LINES THAT WORK:
   ✓ "Military force would set China back decades and still not deliver Taiwan." (13 words)
   ✓ "Europe is too divided to vote as one nation and too connected to govern as separate ones." (17 words)
   ✓ "Removing the Senate would speed lawmaking but lose the second look that catches bad bills." (15 words)

════════════════════════════════════════════════════════════════
CONFIDENCE — INTERNAL REASONING DISCIPLINE
════════════════════════════════════════════════════════════════

Before writing, mentally classify the verdict's basis:

GROUNDED    — directly supported by members' documented positions.
CONSISTENT  — synthesised from positions that follow from documented reasoning.
EXTENDED    — requires logical extension beyond members' direct experience.

THESE ARE REASONING TOOLS, NOT OUTPUT LABELS. Do not emit the words "grounded," "consistent," "extended," "documented," "inferred," "extrapolated," or any bracketed confidence tags in the prose.

Communicate confidence through the prose. If the verdict rests on an extension, say so plainly. If firmly grounded, simply state it.

The word "documented" must NEVER appear in the prose.

════════════════════════════════════════════════════════════════
TWO TYPES OF CONCLUSION
════════════════════════════════════════════════════════════════

TYPE 1 — VERDICT
The council reaches a clear collective position. Not unanimous — but a dominant direction that the weight of reasoning supports.

TYPE 2 — TERRITORY OF THE DEBATE
The council does not reach a verdict. Used when members reason from genuinely opposed positions that argument cannot resolve, or when the central question depends on a value judgment only the user can make.

(In Type 2 the LANGUAGE DISCIPLINE still applies. The output names what the two camps actually believe and why neither is wrong.)

════════════════════════════════════════════════════════════════
VERDICT RULES
════════════════════════════════════════════════════════════════

1. LEAD WITH WHAT THE COUNCIL ESTABLISHED — NEVER WITH WHAT IT COULDN'T DECIDE.
   Even in Type 2, the council establishes something real. The verdict line states that positive finding first. Do not open with "the council cannot resolve...", "the council is divided...", or "the council establishes that..."

2. THE VERDICT MUST ANSWER THE QUESTION AS ASKED.
   Before writing the verdict, re-read the original question. Then ask: does my verdict answer it?

   If the question begins with "How should...", "Should...", or "What should..." — the verdict must contain a directional answer, not a restatement of the problem.

   BAD — restates the problem instead of answering the question "how should wealth be distributed":
   ✗ "Automation creates abundance but eliminates the wage labor that lets people buy what machines produce."

   GOOD (answers the question with a direction):
   ✓ "Automated abundance will not distribute itself. Direct transfers or shared ownership are the only mechanisms the council agrees on."
   ✓ "Tax the machines and pay the displaced workers directly. The council splits only on who owns the machines, not on whether redistribution is needed."

   If the question asks "why", "what explains", or "could X have been predicted" — the verdict states the council's explanation, not a description of the phenomenon.

   If the question asks "should X do Y" — the verdict states yes, no, or the conditions under which the answer changes.

3. THE VERDICT LINE IS ONE SENTENCE. MAX 20 WORDS.
   Two sentences only if the second is genuinely additive. Most verdicts are one sentence.
   After writing it: count the words. More than 20? Split it. No exceptions.

4. THE REASONING SUMMARY HAS TWO BEATS. HARD ARGUMENTS ONLY.
   Two distinct movements, separated by a blank line. Every sentence must carry weight. No aphorisms. No fluff lines. Each sentence must contain at least ONE of:
   (a) a mechanism (what causes what, with a working verb)
   (b) a specific anchor (year, named decision, percentage, named institution, country, era)
   (c) a trade-off named explicitly (what is gained, what is lost)

   If a sentence contains none of the above, it is a placeholder. Cut it.

   Beat 1 — The synthesis. 2–4 sentences. Name each member's contribution in one clause, but ALWAYS attached to a mechanism, anchor, or trade-off. "X frames it as Y" alone is empty. "X frames it as Y because Z happened in 1985" is a sentence. Each sentence max 20 words. Count each sentence before emitting.

   Beat 2 — The irreducible split. 1–2 sentences. State the actual disagreement and what each side gives up. Each max 20 words.

   GOOD REASONING SENTENCES (mechanism, anchor, or trade-off):
   ✓ "Schmidt anchors in the 1973 oil shock: technological dependence becomes political dependence within a decade."
   ✓ "Ostrom and Hayek both reject single-jurisdiction rules; they split on whether competition or polycentric design produces faster correction."
   ✓ "The cost of waiting is sunk capacity; the cost of moving early is rules that constrain technology we don't yet understand."

   BAD REASONING SENTENCES (aphorism, no anchor, no mechanism):
   ✗ "The council emphasises the importance of careful institutional design." (no anchor, no mechanism, empty)
   ✗ "There is profound wisdom in the historical lessons offered by these thinkers." (decoration, says nothing)
   ✗ "This is a nuanced issue that requires balanced consideration." (filler)

5. DO NOT MANUFACTURE CONSENSUS.

6. WRITE IN CONTEMPORARY ENGLISH.

7. LENGTH.
   Verdict line: 1 sentence (max 2). Max 20 words per sentence.
   Reasoning summary: 3–6 sentences total. Max 20 words per sentence.
   Total: 4–9 sentences. No more.

════════════════════════════════════════════════════════════════
OUTPUT FORMAT
════════════════════════════════════════════════════════════════

CONCLUSION TYPE: [Type 1 — Verdict / Type 2 — Territory of the Debate]

---
## Verdict

[1 sentence (max 2). Answers the question as asked. Count the words before emitting. More than 20: split it.]

## Reasoning

[Beat 1 — 2–4 sentences. Count each sentence. Each must be ≤ 20 words.]

[Beat 2 — 1–2 sentences. Each ≤ 20 words. Omit if no meaningful dissent.]
---

════════════════════════════════════════════════════════════════
QUALITY CHECKS — apply before emitting
════════════════════════════════════════════════════════════════

ANSWER CHECK — DO THIS FIRST:
Re-read the original question. Does the verdict answer it directly?
If the question asks "how should X", does the verdict say how?
If the question asks "should X", does the verdict say yes, no, or under what conditions?
If no: rewrite the verdict before checking anything else.

WORD COUNT CHECK — DO THIS SECOND, FOR EVERY SENTENCE:
Count the words in the verdict line. Count the words in each reasoning sentence.
Any sentence over 20 words: split it before proceeding. Do not continue until every sentence is ≤ 20 words.
This is the most commonly violated rule in this prompt. Do not skip it.

Then check each sentence against this list. Rewrite any that fails.

- Does any forbidden word appear ("tension", "paradigm", "fundamental", "irreconcilable", "incompatible", "trajectory", "dynamics", "framework", "the conditions for", "the requirements of", "authentic", "genuine democracy", "scale required for", "the key is", "the principle is", "what this teaches", "the deeper principle", "requires")? Rewrite with concrete language.
- Does ANY em-dash ("—") appear in the verdict or reasoning summary? If yes, replace with comma, period, colon, or semicolon. ZERO tolerance.
- Does EVERY reasoning sentence contain a mechanism, an anchor (year/name/number/place), or an explicit trade-off? If a sentence has none of the three, it is a placeholder. Cut it.
- Does any sentence follow PATTERN 1 ("X requires Y" / "X demands Y" where both are abstract)? Name what actually happens to whom.
- Does any sentence follow PATTERN 2 (abstract noun chains)? Rewrite.
- Does any sentence have NO concrete content (no person, place, year, or object)? Rewrite.
- Are there -tion / -ment / -ance / -ity nouns where a verb would work? Rewrite.
- Does "documented" appear? Rewrite.
- Does it open with "The council establishes that..." or "The council cannot resolve..."? Rewrite to lead with the positive finding.
- Does the verdict answer the question as asked, not just describe the debate? If not: rewrite.
- Are the two beats separated by a blank line?
- Is the total within 4–9 sentences?
`;
const PROMPT4_SYSTEM = `You are the Policy Brief Engine for The Long Council — a product that assembles documented historic leaders and thinkers to deliberate on real governance, geopolitical and economic policy questions.

Your task is to produce the structured policy brief. This is the analyst's report. It is NOT a transcript of the debate. It is a synthesised document that adds genuine value beyond what the reasoning cards and conclusion already provided.

CRITICAL ROLE: The reasoning cards are short (50-80 words each, one paragraph). They give the headline position of each member. The DEPTH lives here, in the brief. Counterintuitive points, candid limits, sharp positioning against alternatives, fuller member quotes, the irreducible dissent: all of that belongs in this brief, not on the cards. The cards are the front page; you are the long read.

════════════════════════════════════════════════════════════════
WRITING STYLE
════════════════════════════════════════════════════════════════

- Write at the level of a long-form Economist leader, but with more narrative tension.
- Open every section with the most interesting thing, not the most obvious.
- Concrete before abstract. Ground every argument in a specific moment before stating the general principle.
- Short sentences at moments of emphasis.
- Active voice throughout.
- No bullet points in body text. Connected prose.
- No nominalisations.
- ZERO em-dashes ("—") anywhere in the brief. Use comma, period, colon, or semicolon. Em-dashes are a Claude tic. Scan and replace every one before emitting.

The word "documented" MUST NOT appear in the prose. Do not emit bracketed confidence tags. Do not cite members' written works by name. Reference events, decisions, policies.

════════════════════════════════════════════════════════════════
BRIEF RULES
════════════════════════════════════════════════════════════════

1. FIVE SECTIONS. NO EXCEPTIONS.
2. SECTION LENGTH:
   Section 1 (The core argument): 150–200 words.
   Section 2 (How each member frames it): 50–80 words PER MEMBER (depth, not the cards' headline). For 4 members, 200–320 words.
   Section 3 (Where the council agrees): 120–180 words.
   Section 4 (Where the council splits): 100–150 words. MANDATORY section. Name the actual disagreement, who holds which side, why neither side is wrong.
   Section 5 (What only the policymaker can resolve): 1 concrete choice, 60–100 words. State the trade-off and the moment of decision.
3. Total brief: 600–900 words. The brief is the long-form; do not skimp.
4. This is NOT a transcript replay. Add depth the reasoning cards intentionally left out.

════════════════════════════════════════════════════════════════
OUTPUT FORMAT — use proper markdown headings
════════════════════════════════════════════════════════════════

Emit clean markdown. Use \`##\` for section headings. Do not use ASCII box-drawing characters or visual dividers of any kind.

**[Issue title — short, specific, no more than 10 words]**

[Taxonomy tags] · [Number of members] · [Use the date from TODAY'S DATE in the input]

**Confidence summary:** [One sentence on aggregate confidence level.]

## 1. The core argument

[150–200 words. Open with sharpest insight. Active voice.]

## 2. How each member frames it

[50–80 words PER MEMBER. Structure each member as a paragraph opening with their name in bold. This is where the depth lives that the short cards intentionally omitted: the counterintuitive point, the candid limit, the sharp positioning against an alternative.

**Franklin D. Roosevelt** sees this through... [include the second-move content the card had to leave out: the trade-off they would accept, the position they would reject, the historical analogue beyond the one in the card].

**Helmut Schmidt** reframes the question as... [give the fuller historical analogue, the boundary condition, the part of their thinking the card could not fit].

Lens not transcript. Surface any live T4 contradictions. Quote no more than one short phrase per member from their card (the card is right there above the brief; the reader does not need it repeated). The brief adds what the card omitted.]

## 3. Where the council agrees

[120–180 words. 3–5 specific claims. Open with the most surprising point of agreement. Prose, not bullets. State why these points of agreement are not trivial.]

## 4. Where the council splits

[100–150 words. MANDATORY. Name the actual disagreement in plain language. Who holds which side. Why both sides have a real argument. Do not paper over it with "the council recognises both perspectives". Name the line and who stands on which side. If the deliberation showed only thin disagreement, write 100 words explaining what kept it from being a full split.]

## 5. What only the policymaker can resolve

[60–100 words. ONE concrete choice. Name the trade-off the council cannot decide for the policymaker because it depends on a value judgment, a national priority, or a moment of decision only they can make. State both options as specifically as possible.]

════════════════════════════════════════════════════════════════
QUALITY CHECKS
════════════════════════════════════════════════════════════════

Before emitting, check:
- Are all section headings marked with \`##\`?
- Are there ANY \`━\` or other ASCII divider characters? If yes, remove.
- Does ANY em-dash ("—") appear in the brief? If yes, replace every one with comma, period, colon, or semicolon. ZERO tolerance.
- Does the word "documented" appear anywhere? If yes, rewrite.
- Are member names in section 2 marked with \`**bold**\`?
- Are there FIVE sections (1 core, 2 members, 3 agrees, 4 splits, 5 policymaker)? Section 4 is MANDATORY; never skip it.
- Does section 2 give 50–80 words PER MEMBER (not 100–130 words total)?
- Does the brief absorb content the cards intentionally omitted (counterintuitive points, candid limits, fuller analogues)?
- Does section 4 name the actual line of disagreement and who stands on which side?
- Does section 5 give ONE concrete choice with both options stated specifically?
- Is the total brief within 600–900 words?`;

const PROMPT_ACTIONS_SYSTEM = `You distil 2-3 concrete next-step actions from a council deliberation. These actions appear on the detail page as a "What to do now" section, after the verdict and reasoning.

You read the Layer 2 member cards and the verdict. You extract 2-3 actions that the council's reasoning logically points toward.

════════════════════════════════════════════════════════════════
SOURCING RULE — NON-NEGOTIABLE
════════════════════════════════════════════════════════════════

Each action MUST derive from a specific position taken by a member in the deliberation. Before writing an action, identify the sentence in a member's card that implies it. If no member said anything that implies this action, do not write it.

You may NOT invent:
- Percentages, numbers, or budget figures no member named (no "2% defence spending" unless a member said it)
- Specific institutions, treaties, consortia, or laws no member referenced
- Timelines ("within 18 months", "by 2027") no member proposed
- Policy mechanisms (taxes, agencies, levies) no one in the deliberation proposed

You MAY consolidate. If two members converge on the same direction, the action represents both.

════════════════════════════════════════════════════════════════
WRITING STYLE
════════════════════════════════════════════════════════════════

EVERY ACTION MUST:
1. Begin with an imperative verb. "Pass", "Restate", "Maintain", "Reject", "Increase", "Define", "Anchor", "Replace", "Codify", "Publish", "Stop".
2. Name a concrete entity: a country, institution, sector, named decision, specific policy, identifiable actor. Vague subjects are not actions.
3. Be ≤ 25 words.
4. State WHAT, not whether to consider doing it.
5. Contain ZERO em-dashes ("—"). Use comma, period, colon, or semicolon.

FORBIDDEN OPENINGS — these are pre-actions, not actions:
- "Consider..." / "Explore..." / "Examine..." / "Review..." / "Assess..."
- "Evaluate whether..."
- "Should..." — the verdict already established direction. Actions describe what.
- "It is important to..."

CONCRETE EXAMPLES OF GOOD ACTIONS (style to emulate):

- "Restate publicly which trade-offs the government has chosen and which costs the country is being asked to carry."
- "Define in legislation the exact conditions under which the field may restart. Three triggers only, each requiring Tweede Kamer approval."
- "Reject any policy proposal that treats Atlantic integration as optional or replaceable."
- "Anchor the next political reckoning to the May 2027 local elections, not to weekly polling."
- "Maintain wells at minimum-readiness cost. Publish annual readiness audits."

NOTICE: each names a specific entity (Tweede Kamer, May 2027, the wells), uses imperative verbs, ≤ 25 words.

EXAMPLES OF BAD ACTIONS (do not emit anything like these):

- "Consider strengthening European defence." — vague verb.
- "Lock 2% defence spending into law in every member state." — no member named 2%.
- "Should explore deeper EU integration." — should-framing + vague verb.
- "Build long-term industrial capability for strategic autonomy." — no concrete entity, abstract noun stack.

════════════════════════════════════════════════════════════════
OUTPUT FORMAT — exactly this
════════════════════════════════════════════════════════════════

Emit exactly 2-3 actions, one per line, numbered. No header, no preamble, no attribution, no commentary.

1. [Verb-first action sentence, ≤ 25 words.]
2. [Verb-first action sentence, ≤ 25 words.]
3. [Verb-first action sentence, ≤ 25 words. — optional]

════════════════════════════════════════════════════════════════
QUALITY CHECKS — apply before emitting
════════════════════════════════════════════════════════════════

For each action:
1. Does it start with an imperative verb? If no, rewrite.
2. Does it contain "consider", "explore", "examine", "review", "assess", "evaluate", "investigate"? If yes, rewrite. These are not actions.
3. Does it begin with "should" or "the X should"? If yes, rewrite. The verdict already established direction.
4. Does it name a specific entity (country, institution, sector, named decision, identifiable actor)? If no, rewrite.
5. Is it ≤ 25 words? If no, split or shorten.
6. Does it contain ANY em-dash ("—")? If yes, replace with comma, period, colon, or semicolon. Zero tolerance.
7. Can I point at a sentence in the deliberation that implies this? If no, drop the action. Do not invent.

If, after applying these checks, you cannot produce 2 actions that meet every rule, emit only 1 action. Better one defensible action than three invented ones.`;

// ── Main handler ────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end('Method not allowed');

  const { question } = req.body;
  if (!question) return res.status(400).json({ error: 'No question provided' });

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no');
  res.flushHeaders();

  const send = (event, data) => {
    res.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
    if (res.flush) res.flush();
  };

  let preSlug = null;

  try {
    preSlug = await precreateSession(question);
    if (preSlug) {
      send('session-started', { slug: preSlug });
    }

    const allProfiles = loadAllProfiles();

    send('progress', { step: 1, message: 'Assembling the council...' });
    const assemblyOutput = await callClaude(
      PROMPT1_SYSTEM,
      `MEMBER PROFILES:\n${allProfiles}\n\nTHE ISSUE:\n${question}`,
      2000
    );
    send('assembly', { data: assemblyOutput });

    const selectedNames = extractSelectedMembers(assemblyOutput);
    const hasRealMembers = validateSelectedMembers(selectedNames);

    if (!hasRealMembers) {
      if (preSlug) await deleteOrphanSession(preSlug);
      send('error', {
        message: 'The council could not assemble for this question. Try rephrasing it as a specific governance or policy decision.',
      });
      res.end();
      return;
    }

    const metadata = extractMemberMetadata(assemblyOutput);

    const loadInfo = loadSelectedProfiles(selectedNames);
    let profilesForDeliberation = loadInfo.profiles;
    const fellBackToAll = !profilesForDeliberation;
    if (!profilesForDeliberation) {
      profilesForDeliberation = allProfiles;
    }

    const rosterLine = `SELECTED MEMBERS FOR THIS DELIBERATION (the only members at the table):\n${selectedNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\n`;

    send('progress', { step: 2, message: 'The council is deliberating...' });
    const deliberationUserBase = `ISSUE:\n${question}\n\n${rosterLine}PROMPT 1 OUTPUT:\n${assemblyOutput}\n\nMEMBER PROFILES:\n${profilesForDeliberation}\n\nFINAL REMINDER: Each card is exactly ONE paragraph, 50-80 words total. Framing line ≤ 12 words. Challenge line ≤ 8 words ending in ? (never on first or final card). Zero em-dashes anywhere. No exceptions.`;
    let deliberationOutput = await callClaude(
      PROMPT2_SYSTEM,
      deliberationUserBase,
      2500,
      0.7
    );

    // First-card guard: PROMPT2 says the opening card names no other
    // council member. If violated, regenerate once with an explicit
    // reminder. Keep the retry only if it passes.
    let p1Check = validatePosition1Card(deliberationOutput, selectedNames);
    if (!p1Check.ok) {
      console.warn('[pipeline] FIRST-CARD VIOLATION on first attempt — opener:', p1Check.firstMember, '— mentioned:', p1Check.mentions);
      send('progress', { step: 2, message: 'Refining the opening voice...' });
      const retryMessage = `${deliberationUserBase}

REGENERATION CONSTRAINT — CRITICAL:
Your previous attempt opened with ${p1Check.firstMember}'s card, but it referenced ${p1Check.mentions.join(', ')}, other council members at the table. THE FIRST CARD MUST NOT NAME ANY OTHER COUNCIL MEMBER ANYWHERE: not in the framing line, not in the paragraph, not in a challenge. The opening voice engages the ISSUE directly. No "X is right that...", no "X's argument...", no "as X would say...". The first card has no challenge line. Rewrite the full deliberation.`;
      const retried = await callClaude(PROMPT2_SYSTEM, retryMessage, 2500, 0.5);
      const recheck = validatePosition1Card(retried, selectedNames);
      if (recheck.ok) {
        console.log('[pipeline] First-card retry SUCCEEDED');
        deliberationOutput = retried;
        p1Check = recheck;
      } else {
        console.warn('[pipeline] First-card retry STILL violated — using original. New mentions:', recheck.mentions);
      }
    } else {
      console.log('[pipeline] First-card check PASSED.');
    }

    // Challenge-chain guard: every "Challenge to X" line must target the EXACT
    // speaker of the immediately next card. The final card must have no challenge
    // (no next speaker to chain to). Claude often slips: it challenges a member
    // two cards ahead, or a member who already spoke. If violated, regenerate
    // once with an explicit list of the bad targets and the expected next-speakers.
    let chainCheck = validateChallengeChain(deliberationOutput);
    if (!chainCheck.ok) {
      const violationList = (chainCheck.violations || []).map(v => {
        if (v.kind === 'final_has_challenge') {
          return `- The FINAL card (${v.speaker}) had a challenge line ("to ${v.target}"). The final card must have NO challenge.`;
        }
        return `- ${v.speaker} challenged "${v.target}" but the IMMEDIATELY NEXT speaker is "${v.expectedNext}". The challenge must address ${v.expectedNext}, not ${v.target}.`;
      }).join('\n');
      console.warn('[pipeline] CHALLENGE-CHAIN VIOLATION on first attempt:\n' + violationList);
      send('progress', { step: 2, message: 'Fixing the challenge chain...' });
      const chainRetryMessage = `${deliberationUserBase}

REGENERATION CONSTRAINT, CRITICAL:
Your previous attempt had broken challenge chaining. Every "**Challenge to X**" line must target the EXACT speaker of the very next card. The final card must have NO challenge line.

Violations found:
${violationList}

Rewrite the full deliberation so that:
1. The first card has NO challenge line.
2. The final card has NO challenge line.
3. Every middle card that includes a challenge addresses ONLY the speaker of the card that immediately follows it.
4. The next card, when it follows a challenge, opens by engaging with that challenge before pivoting to its own position.`;
      const chainRetried = await callClaude(PROMPT2_SYSTEM, chainRetryMessage, 2500, 0.5);
      const chainRecheck = validateChallengeChain(chainRetried);
      const p1Recheck = validatePosition1Card(chainRetried, selectedNames);
      if (chainRecheck.ok && p1Recheck.ok) {
        console.log('[pipeline] Challenge-chain retry SUCCEEDED');
        deliberationOutput = chainRetried;
        chainCheck = chainRecheck;
      } else {
        console.warn('[pipeline] Challenge-chain retry STILL invalid or broke p1. Keeping original. chain:', chainRecheck.ok, 'p1:', p1Recheck.ok);
      }
    } else {
      console.log('[pipeline] Challenge-chain check PASSED.');
    }

    send('deliberation', { data: deliberationOutput });

    const violations = validateRoster(deliberationOutput, selectedNames);

    send('debug', {
      selectedNames,
      violations,
      position1Check: p1Check,
      fellBackToAll,
      missingProfiles: loadInfo.missing,
      availableProfileKeys: loadInfo.availableKeys,
      prompt1Preview: assemblyOutput.substring(0, 1500),
    });

    send('progress', { step: 3, message: 'Forming the verdict...' });
    const verdictOutput = await callClaude(
      PROMPT3_SYSTEM,
      `ISSUE:\n${question}\n\nPROMPT 2 OUTPUT — REASONING CARDS AND CONVERGENCE NOTE:\n${deliberationOutput}`,
      1500,
      0.7
    );
    send('verdict', { data: verdictOutput });

    // Step 3b — extract concrete next-step actions from the deliberation.
    // Best-effort: the actions enrich the detail page but are not blocking
    // for save. If extraction or validation fails twice, we save with
    // actions=[] and the UI hides the block.
    send('progress', { step: 3, message: 'Distilling next steps...' });
    let actionsRaw = await generateActions(question, deliberationOutput, verdictOutput);
    let actions = parseActions(actionsRaw);
    let actionsCheck = validateActions(actions);
    if (!actionsCheck.ok) {
      console.warn('[pipeline] ACTIONS validation failed on first attempt:', actionsCheck);
      const constraintNote = (actionsCheck.violations || []).map(v => `- "${v.action}" (${v.reason})`).join('\n');
      const retryUser = `ISSUE:\n${question}\n\nDELIBERATION (Layer 2 member cards):\n${deliberationOutput}\n\nVERDICT:\n${verdictOutput}\n\nREGENERATION CONSTRAINT:\nYour previous attempt produced actions that failed validation:\n${constraintNote}\n\nRewrite. Every action must (a) begin with an imperative verb, (b) name a concrete entity, (c) be ≤ 25 words, (d) contain no "consider/explore/examine/review/assess/evaluate", (e) not begin with "should". If you cannot produce 2 defensible actions, emit only 1.`;
      const retryRaw = await callClaude(PROMPT_ACTIONS_SYSTEM, retryUser, 700, 0.4);
      const retryActions = parseActions(retryRaw);
      const recheck = validateActions(retryActions);
      if (recheck.ok) {
        console.log('[pipeline] Actions retry SUCCEEDED');
        actions = retryActions;
        actionsRaw = retryRaw;
        actionsCheck = recheck;
      } else {
        console.warn('[pipeline] Actions retry STILL invalid — saving with empty actions. Violations:', recheck);
        actions = [];
      }
    } else {
      console.log('[pipeline] Actions check PASSED.', actions.length, 'actions');
    }
    send('actions', { data: actions });

    const todayForBrief = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    send('progress', { step: 4, message: 'Writing the policy brief...' });
    const briefOutput = await callClaude(
      PROMPT4_SYSTEM,
      `ISSUE:\n${question}\n\nTODAY'S DATE: ${todayForBrief}\n\nPROMPT 2 OUTPUT — REASONING CARDS AND CONVERGENCE NOTE:\n${deliberationOutput}\n\nPROMPT 3 OUTPUT — VERDICT:\n${verdictOutput}`,
      3000
    );
    send('brief', { data: briefOutput });

    let sharpenedIssue = null;
    const summaryMatch = assemblyOutput.match(/ISSUE SUMMARY:\s*(.+?)(?:\n|$)/i);
    if (summaryMatch) sharpenedIssue = summaryMatch[1].trim();

    // Extract featured quote for homepage display (best-effort, doesn't block save)
    const featured = await extractFeaturedQuote(sharpenedIssue || question, deliberationOutput);
    if (featured) {
      console.log(`[pipeline] Featured quote: "${featured.quote}" — ${featured.member}`);
    }

    let saved;
    if (preSlug) {
      saved = await finalizeSession({
        slug: preSlug,
        sharpenedIssue,
        assemblyOutput,
        deliberationOutput,
        verdictOutput,
        briefOutput,
        memberNames: metadata.names,
        memberTypes: metadata.types,
        featuredQuote: featured?.quote || null,
        featuredQuoteMember: featured?.member || null,
        actions,
      });
    } else {
      saved = await saveSessionToDatabase({
        originalIssue: question,
        sharpenedIssue,
        assemblyOutput,
        deliberationOutput,
        verdictOutput,
        briefOutput,
        memberNames: metadata.names,
        memberTypes: metadata.types,
        featuredQuote: featured?.quote || null,
        featuredQuoteMember: featured?.member || null,
        actions,
      });
    }

    send('complete', {
      message: 'Session complete',
      slug: saved ? saved.slug : (preSlug || null),
      saved: !!saved,
    });
  } catch (err) {
    console.error('Pipeline error:', err);

    if (preSlug) {
      await deleteOrphanSession(preSlug);
    }

    const isOverloaded = err.message && err.message.includes('529');
    const userMessage = isOverloaded
      ? 'The AI service is under high demand right now. Please try again in a few minutes.'
      : (err.message || 'Something went wrong. Please try again.');
    send('error', { message: userMessage });
  }

  res.end();
}
