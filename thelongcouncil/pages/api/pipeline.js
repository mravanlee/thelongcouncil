import fs from 'fs';
import path from 'path';
import { getServiceSupabase, generateSlug } from '../../lib/supabase';
import { getMemberQuotes } from '../../lib/memberQuotes';
import { storeOgCards } from '../../lib/ogCards.mjs';
import { refreshRelated } from '../../lib/related.mjs';

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
    /SELECTED MEMBERS:\s*\n([\s\S]*?)(?=\n\s*(?:MEMBERS CONSIDERED|CONFIDENCE NOTE)|$)/i
  );
  if (!selectedMatch) {
    console.warn('[pipeline] Could not locate "SELECTED MEMBERS:" section in Prompt 1 output.');
    return [];
  }
  const section = selectedMatch[1];
  const names = [];
  const seen = new Set();
  // Tolerate the whole header line being bold, e.g. "**1. Milton Friedman — Thinker**"
  // (claude-sonnet-4-6 formats it this way) as well as the bare "1. Name" form.
  const regex = /^\s*(?:\*\*)?\s*\d+\.\s+(.+?)\s*$/gm;
  const stripTierSuffix = (s) =>
    s.replace(/\s*[—–\-―]\s*(Practitioner|Framer|Leader|Thinker)\s*$/i, '').trim();
  let match;
  while ((match = regex.exec(section)) !== null) {
    let rawName = match[1].trim().replace(/\*\*/g, '').replace(/^\*|\*$/g, '').trim();
    // Drop trailing parenthetical/bracketed notes the model sometimes appends,
    // e.g. "Hannah Arendt [already selected — see above]" → "Hannah Arendt".
    rawName = rawName.replace(/\s*[[(].*$/, '').trim();
    rawName = stripTierSuffix(rawName);
    if (rawName.length < 3) continue;
    if (/^(Relevance|Coverage|Will argue):/i.test(rawName)) continue;
    const key = normalizeName(rawName);
    if (seen.has(key)) continue; // model occasionally re-lists a member; keep it once
    seen.add(key);
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
    /SELECTED MEMBERS:\s*\n([\s\S]*?)(?=\n\s*(?:MEMBERS CONSIDERED|CONFIDENCE NOTE)|$)/i
  );
  if (!selectedMatch) return { names: [], types: [] };

  const section = selectedMatch[1];
  const dashChars = '[—–\\-―]';
  const tierPattern = '(Practitioner|Framer|Leader|Thinker|Wildcard)';
  // Tolerate the header line being fully bold, e.g. "**1. Milton Friedman — Thinker**"
  // (claude-sonnet-4-6 sometimes does this): allow an optional leading and trailing
  // ** so the name AND the tier are still captured.
  const regex = new RegExp(
    `^\\s*(?:\\*\\*)?\\s*\\d+\\.\\s+(.+?)(?:\\s+${dashChars}\\s+${tierPattern}(?:[/]${tierPattern})?)?\\s*(?:\\*\\*)?\\s*$`,
    'gm'
  );

  const stripTierSuffix = (s) =>
    s.replace(/\s*[—–\-―]\s*(Practitioner|Framer|Leader|Thinker|Wildcard)(\/\w+)?\s*$/i, '').trim();

  const names = [];
  const types = [];
  const seen = new Set();
  let match;
  while ((match = regex.exec(section)) !== null) {
    const rawName = match[1].trim().replace(/\*\*/g, '').replace(/^\*|\*$/g, '').trim();
    // Strip trailing parenthetical/bracketed notes (e.g. "[already selected — see above]")
    // so a model aside never becomes a phantom member; then dedupe on the name.
    const cleanName = stripTierSuffix(rawName.replace(/\s*[[(].*$/, '').trim());
    if (cleanName.length < 3) continue;
    if (/^(Relevance|Coverage|Will argue):/i.test(cleanName)) continue;
    const key = normalizeName(cleanName);
    if (seen.has(key)) continue;
    seen.add(key);
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

  // Strip the challenge line before scanning. The first card MAY contain a
  // challenge to the card-2 speaker, but its body (framing line + paragraph)
  // must not name any other member. Removing the challenge prevents a
  // false-positive violation when the legitimate handoff names card-2's speaker.
  const firstCardBody = firstCard.replace(/\*\*\s*Challenge to\b[\s\S]*$/i, '').trim();

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
      if (new RegExp(`\\b${escaped}\\b`, 'i').test(firstCardBody)) {
        mentions.push(cleanMember);
        break;
      }
    }
  }

  if (mentions.length > 0) {
    return { ok: false, firstMember, mentions, card1Preview: firstCardBody.slice(0, 300) };
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

// Build name -> canonical title map from the selected members' profiles.
// Profile line 3 has the form "<Tier> · <Title> · <affiliation> ...".
// The card title is the role segment (index 1, after the tier). Used to
// overwrite titles the deliberation engine sometimes invents wrong, e.g.
// "First President of Israel" for Ben-Gurion who was Prime Minister.
function loadProfileTitles(selectedNames) {
  const dir = path.join(process.cwd(), 'data', 'profiles');
  const files = fs.readdirSync(dir).filter(f => f.endsWith('.md'));
  const fileMap = new Map();
  for (const f of files) {
    const nameFromFile = f.replace(/^profile_/, '').replace(/\.md$/, '').replace(/_/g, ' ');
    fileMap.set(normalizeName(nameFromFile), path.join(dir, f));
  }
  const titles = new Map();
  for (const name of selectedNames) {
    const key = normalizeName(name);
    if (!fileMap.has(key)) continue;
    let content;
    try { content = fs.readFileSync(fileMap.get(key), 'utf-8'); } catch { continue; }
    const lines = content.split('\n').slice(0, 8);
    for (const line of lines) {
      if (/Knowledge Document/i.test(line)) continue; // skip the T1-T5 banner
      if (!line.includes('·')) continue;
      const segments = line.split('·').map(s => s.trim()).filter(Boolean);
      if (segments.length >= 2) { titles.set(key, segments[1]); break; }
    }
  }
  return titles;
}

// Overwrite each card's title line with the canonical profile title.
function applyCanonicalTitles(deliberationOutput, titleMap) {
  if (!deliberationOutput || !titleMap || titleMap.size === 0) return deliberationOutput;
  let corrections = 0;
  const fixed = deliberationOutput.replace(
    /(##[ \t]*([^\n]+)\n)([^\n]+)/g,
    (match, header, name, titleLine) => {
      const canonical = titleMap.get(normalizeName(name.trim()));
      if (!canonical) return match;                 // not a member card (e.g. convergence note)
      if (titleLine.trim() === canonical) return match;
      corrections++;
      return `${header}${canonical}`;
    }
  );
  if (corrections > 0) console.log(`[pipeline] Corrected ${corrections} card title line(s) to canonical profile titles.`);
  return fixed;
}

// Detect a card that names its OWN speaker in third person anywhere in the
// body (e.g. Arendt opening "Arendt misunderstands..." or FDR mid-card with
// "Roosevelt's approach includes..."). In first-person cards a member never
// names themselves; this is almost always a name-swap where a rebuttal should
// have targeted another speaker. Scans the whole body, not just the opening,
// so mid-paragraph slips are caught too.
function validateSelfReference(deliberationOutput) {
  if (!deliberationOutput) return { ok: true };
  const blocks = deliberationOutput
    .split(/(?:^|\n)\s*---\s*(?:\n|$)/)
    .map(b => b.trim())
    .filter(Boolean);
  const violations = [];
  for (const b of blocks) {
    if (/##\s*The convergence note/i.test(b)) continue;
    const headingMatch = b.match(/##\s*([^\n]+)/);
    const speaker = headingMatch ? headingMatch[1].trim() : null;
    if (!speaker) continue;
    const body = b
      .replace(/##\s*[^\n]+\n?/, '')           // heading
      .replace(/^[^\n]*\n?/, '')                // title line
      .replace(/^\s*\*[^\n]*\*\s*\n?/m, '')     // italic framing line
      .replace(/\*\*\s*Challenge to[\s\S]*$/i, '')
      .trim();
    if (!body) continue;
    const last = speaker.split(/\s+/).slice(-1)[0];
    const escFull = speaker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const escLast = last.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Word boundaries exclude adjectival forms ("Lockean", "Keynesian"); the
    // (?!-) lookahead excludes hyphenated named theories ("Prebisch-Singer
    // hypothesis") where the speaker correctly uses first person around it.
    const m = body.match(new RegExp(`\\b(${escFull}|${escLast})\\b(?!-)`, 'i'));
    if (m) {
      const idx = body.indexOf(m[0]);
      violations.push({ speaker, opening: body.slice(Math.max(0, idx - 25), idx + 40).trim() });
    }
  }
  return violations.length ? { ok: false, violations } : { ok: true };
}

// Replace em-dashes (U+2014) with a comma. En-dashes (U+2013, used in date
// ranges like 1948–53) are a different character and left untouched.
function stripEmDashes(text) {
  if (!text) return text;
  return text
    .replace(/\s*—\s*/g, ', ')
    .replace(/,\s*,/g, ',')
    .replace(/ {2,}/g, ' ');
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

async function finalizeSession({ slug, sharpenedIssue, assemblyOutput, deliberationOutput, verdictOutput, briefOutput, memberNames, memberTypes, featuredQuote, featuredQuoteMember, briefQuotes, memberActions, actions, factualAnchors, questionEnglish, questionLang }) {
  try {
    const supabase = getServiceSupabase();
    const cards = { assembly: assemblyOutput, deliberation: deliberationOutput, verdict: verdictOutput, brief: briefOutput, actions: actions || [], brief_quotes: briefQuotes || {}, member_actions: memberActions || {}, factual_anchors: factualAnchors || '', question_en: questionEnglish || null, question_lang: questionLang || null };
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

async function saveSessionToDatabase({ originalIssue, sharpenedIssue, assemblyOutput, deliberationOutput, verdictOutput, briefOutput, memberNames, memberTypes, featuredQuote, featuredQuoteMember, briefQuotes, memberActions, actions, factualAnchors, questionEnglish, questionLang }) {
  try {
    const supabase = getServiceSupabase();
    const cards = { assembly: assemblyOutput, deliberation: deliberationOutput, verdict: verdictOutput, brief: briefOutput, actions: actions || [], brief_quotes: briefQuotes || {}, member_actions: memberActions || {}, factual_anchors: factualAnchors || '', question_en: questionEnglish || null, question_lang: questionLang || null };
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
async function callClaude(system, user, maxTokens = 4000, temperature = 1.0, model = 'claude-sonnet-4-6') {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
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

// Streaming variant: same call but with `stream: true`, invoking onDelta(textChunk)
// for each text delta as it arrives, and returning the full accumulated text at the
// end. Used for the deliberation so the client can render speakers live. On any
// network/parse hiccup it still returns whatever text accumulated; the caller runs
// the same validation it would on a non-streamed result.
async function callClaudeStream(system, user, maxTokens, temperature, model = 'claude-sonnet-4-6', onDelta = null) {
  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': process.env.ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model,
      max_tokens: maxTokens,
      temperature,
      system,
      messages: [{ role: 'user', content: user }],
      stream: true,
    }),
  });
  if (!res.ok) {
    const err = await res.text();
    throw new Error(`Anthropic API error ${res.status}: ${err}`);
  }
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let full = '';
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split('\n');
    buffer = lines.pop(); // keep the last, possibly-incomplete line
    for (const line of lines) {
      const t = line.trim();
      if (!t.startsWith('data:')) continue;
      const payload = t.slice(5).trim();
      if (!payload || payload === '[DONE]') continue;
      try {
        const evt = JSON.parse(payload);
        if (evt.type === 'content_block_delta' && evt.delta && evt.delta.type === 'text_delta') {
          const chunk = evt.delta.text || '';
          if (chunk) {
            full += chunk;
            if (onDelta) onDelta(chunk);
          }
        }
      } catch { /* ignore keep-alive / non-JSON lines */ }
    }
  }
  return full;
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

// ── Brief quote selection ───────────────────────────────────────────────
// Picks 1-2 of a member's REAL documented quotes (from lib/memberQuotes.js)
// that best fit this session, for the policy-brief "in his/her own words" block.
// Best-effort and READ-ONLY on the answer: it runs AFTER the deliberation is
// generated and NEVER feeds back into it — the corpus cannot influence the AI
// answer. Returns {} on any failure; members without a corpus are skipped.
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
  try {
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
    const responseText = await callClaude('', prompt, 30, 0.2, 'claude-sonnet-4-6');
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
  } catch (err) {
    console.error(`[pipeline] Brief quote pick failed for ${name}:`, err.message);
    return [];
  }
}

async function selectBriefQuotes(question, deliberationOutput, memberNames) {
  try {
    const names = Array.isArray(memberNames) ? memberNames : [];
    const result = {};
    await Promise.all(names.map(async (name) => {
      const entry = getMemberQuotes(name);
      if (!entry || !Array.isArray(entry.quotes) || entry.quotes.length === 0) return;
      const cardText = findMemberCardText(deliberationOutput, name);
      const picks = await pickQuotesForMember(question, name, cardText, entry.quotes);
      if (picks.length > 0) result[name] = { pronoun: entry.pronoun || 'his', quotes: picks };
    }));
    return result;
  } catch (err) {
    console.error('[pipeline] selectBriefQuotes failed:', err.message);
    return {};
  }
}

// ── Action extraction (Layer-1 "What to do now") ────────────────────────
// Distils 2-3 imperative next-step actions from the deliberation + verdict.
// Each action is required to derive from a specific member's argument
// (the D-rule) so we don't invent policy mechanisms no one proposed.
// IndexNow active submission. The matching keyfile lives at
// /public/244f321a88504f727ee835b30b86531d.txt and proves ownership to
// Bing/Yandex/Naver. This ping notifies them within seconds of a new
// session URL so the archive page can appear in those indexes (and in
// ChatGPT search, which queries Bing) without waiting for a crawl.
const INDEXNOW_KEY = '244f321a88504f727ee835b30b86531d';
const INDEXNOW_HOST = 'www.thelongcouncil.com';

async function notifyIndexNow(slug) {
  if (!slug) return;
  if (process.env.VERCEL_ENV && process.env.VERCEL_ENV !== 'production') {
    console.log('[indexnow] skipped (non-production env)');
    return;
  }
  try {
    const sessionUrl = `https://${INDEXNOW_HOST}/archive/${slug}`;
    const body = {
      host: INDEXNOW_HOST,
      key: INDEXNOW_KEY,
      keyLocation: `https://${INDEXNOW_HOST}/${INDEXNOW_KEY}.txt`,
      urlList: [sessionUrl],
    };
    const res = await fetch('https://api.indexnow.org/IndexNow', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json; charset=utf-8' },
      body: JSON.stringify(body),
    });
    if (res.ok || res.status === 202) {
      console.log(`[indexnow] submitted ${sessionUrl} (HTTP ${res.status})`);
    } else {
      const txt = await res.text().catch(() => '');
      console.warn(`[indexnow] non-ok HTTP ${res.status}: ${txt.slice(0, 200)}`);
    }
  } catch (err) {
    console.warn('[indexnow] ping failed:', err.message);
  }
}

// Pre-warm the OG share image so the FIRST social-media crawl gets a cached,
// fast response instead of a cold ~2.5s render. Cold renders exceed some
// crawlers' timeout (X/Twitter, etc.), which makes them cache an imageless
// card for ~7 days. One GET here primes Vercel's CDN (the image is immutable,
// 1y cache) before anyone shares the link, so cards reliably show the image.
async function generateFactualAnchors(question) {
  try {
    const output = await callClaude(PROMPT_FACTUAL_ANCHORS_SYSTEM, `SHARPENED QUESTION:\n${question}`, 400, 0.3);
    const trimmed = (output || '').trim();
    if (!trimmed || /^NO ANCHORS\b/i.test(trimmed)) return '';
    return trimmed;
  } catch (err) {
    console.warn('[pipeline] factual-anchors generation failed:', err.message);
    return '';
  }
}

function buildContextBlock(factualAnchors) {
  if (!factualAnchors) return '';
  return `CURRENT CONTEXT (May 2026): background facts the council is aware of. Reason in light of them so no member argues from an outdated or purely abstract version of the issue. But treat them as context, not as the subject: reference an anchor only where it genuinely bears on your argument, and never let a single recent event, deal or company become the focus of the debate. The question, not the anchor, is what the council answers.\n\n${factualAnchors}\n\n`;
}

// The Long Council is English-first. When a question is asked in another
// language we store an English translation (shown by default) plus the
// source language name, so the detail page can offer an X-style
// "Show original" toggle. Best-effort: any failure returns nulls and the
// UI simply shows the original question with no toggle.
async function translateQuestion(question) {
  try {
    const output = await callClaude(
      PROMPT_TRANSLATE_QUESTION_SYSTEM,
      `QUESTION:\n${question}`,
      500,
      0.2,
      'claude-haiku-4-5-20251001'
    );
    const text = (output || '').trim();
    if (!text || /^ALREADY ENGLISH\b/i.test(text)) return { english: null, lang: null };
    const langMatch = text.match(/LANGUAGE:\s*(.+?)(?:\n|$)/i);
    const enMatch = text.match(/ENGLISH:\s*([\s\S]+)$/i);
    if (!langMatch || !enMatch) {
      console.warn('[pipeline] translate parse failed:', text.slice(0, 200));
      return { english: null, lang: null };
    }
    const english = stripEmDashes(enMatch[1].trim());
    const lang = langMatch[1].trim();
    if (!english || /^english$/i.test(lang)) return { english: null, lang: null };
    // Guard: an English question that merely contains foreign names or quoted
    // phrases can be misdetected as foreign and "translated" into near-identical
    // text. If the translation matches the original, there is nothing to toggle.
    const norm = (s) => stripEmDashes(s).replace(/\s+/g, ' ').trim().toLowerCase();
    if (norm(english) === norm(question)) return { english: null, lang: null };
    return { english, lang };
  } catch (err) {
    console.warn('[pipeline] question translation failed:', err.message);
    return { english: null, lang: null };
  }
}

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
    // Tolerate a bold-wrapped header, e.g. "**1. Do X**" (claude-sonnet-4-6).
    const match = trimmed.match(/^(?:\*\*)?\s*\d+\.\s*(.+)$/);
    if (match) actions.push(match[1].trim().replace(/\*+$/, '').trim());
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

// ── Per-member actions ("What X would do") ──────────────────────────────
// For each member at the table, 2-3 concrete actions that follow from THAT
// member's own card — their divergent stance, NOT the council synthesis (the
// Layer-1 actions already carry that). Best-effort: any failure or unmatched
// member is omitted and the UI hides that member's block. Never blocks save.
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
  const blocks = output.split(/\n(?=##\s)/);
  for (const block of blocks) {
    const m = block.match(/^\s*##\s*([^\n]+)/);
    if (!m) continue;
    const name = matchMemberName(m[1], memberNames);
    if (!name || result[name]) continue;
    const actions = [];
    for (const line of block.split('\n')) {
      const lm = line.trim().match(/^(?:\*\*)?\s*(?:[-*]|\d+\.)\s+(.+)$/);
      if (!lm) continue;
      const a = stripEmDashes(lm[1].trim().replace(/\*+$/, '').replace(/\s+/g, ' '));
      if (!a) continue;
      const words = a.split(/\s+/).length;
      if (words < 3 || words > 30) continue;
      if (VAGUE_ACTION_VERBS.test(a)) continue;
      if (SHOULD_PREFIX.test(a)) continue;
      actions.push(a);
      if (actions.length >= 3) break;
    }
    if (actions.length > 0) result[name] = actions;
  }
  return result;
}

async function generateMemberActions(originalIssue, deliberationOutput, verdictOutput, memberNames) {
  try {
    const names = Array.isArray(memberNames) ? memberNames : [];
    if (names.length === 0) return {};
    const roster = names.map((n, i) => `${i + 1}. ${n}`).join('\n');
    const userMessage = `ISSUE:\n${originalIssue}\n\nMEMBERS AT THE TABLE (use these EXACT names as ## headings, one block each):\n${roster}\n\nDELIBERATION (Layer 2 member cards):\n${deliberationOutput}\n\nVERDICT:\n${verdictOutput}`;
    const output = await callClaude(PROMPT_MEMBER_ACTIONS_SYSTEM, userMessage, 1500, 0.6);
    return parseMemberActions(output, names);
  } catch (err) {
    console.error('[pipeline] Member-action extraction failed:', err.message);
    return {};
  }
}

// ── Prompts ─────────────────────────────────────────────────────────────

const PROMPT_TRANSLATE_QUESTION_SYSTEM = `You translate a single deliberation question into English for an English-first publication.

You receive one question. It may be in any language.

1. If the question is already written in English, respond with EXACTLY this and nothing else:
ALREADY ENGLISH
A question written in English counts as English even if it contains non-English names, places, parties or quoted foreign phrases (e.g. "How should Özgür Özel challenge Kılıçdaroğlu?" is ALREADY ENGLISH). Only treat it as another language when the sentence's own words and grammar are in that language.

2. If it is in another language, translate it into clear, natural English that preserves the exact meaning. Keep all named people, places, institutions and quoted phrases intact. Keep it as a single question. Do not add or drop information. Do not explain or comment.
Respond with EXACTLY this format and nothing else:
LANGUAGE: <source language name in English, e.g. Turkish, Dutch, Spanish>
ENGLISH: <the English translation>

Hard rules:
- Never use em-dashes. Use commas or rephrase.
- Output only the tag(s) above. No preamble, no notes, no quotation marks around the whole line.`;

const PROMPT_FACTUAL_ANCHORS_SYSTEM = `You read a sharpened policy or governance question. You identify 0-3 state-of-the-world facts (within last 3 years) that any historical thinker reasoning about this question must be confronted with today.

Anchors exist to prevent thinkers from reasoning about an outdated or abstract version of the issue. They constrain which positions remain defensible in 2026.

EACH ANCHOR MUST:
1. Name a specific actor (person, company, country, institution).
2. Name a specific fact (number, event, capability, status).
3. Be load-bearing: removing it would change which positions are tenable.
4. Be verifiable, the kind of claim that would survive a fact-check.

FORBIDDEN:
- Opinions, predictions, normative claims.
- Generic statements ("climate change is accelerating", too vague).
- Facts older than ~3 years unless they remain operationally current.
- Inventing numbers, dates, or institutions when uncertain.
- Em-dashes ("—"). Use comma, period, colon, or semicolon.

EMIT ZERO ANCHORS IF:
- The question is evergreen (timeless ethics, abstract governance).
- No fact within recent years changes the reasoning landscape.
- You are not confident a fact meets all four criteria.

OUTPUT FORMAT, exactly this, no preamble:

ANCHOR 1: [Specific actor + specific fact, ≤ 25 words.]
ANCHOR 2: [Specific actor + specific fact, ≤ 25 words.]
ANCHOR 3: [Specific actor + specific fact, ≤ 25 words.]

OR if no anchors apply:
NO ANCHORS

EXAMPLES, Mars settlement question:
✓ ANCHOR 1: SpaceX has committed roughly $10B private capital to Mars infrastructure 2024-2026; no government has Mars settlement as official policy.
✓ ANCHOR 2: NASA's Artemis program targets the Moon, not Mars; Mars timelines depend on private actors, not public budgets.

EXAMPLES, Ukraine ceasefire question:
✓ ANCHOR 1: Russian Kalibr, Iskander and Kh-101 missile systems range covers all Ukrainian territory and much of NATO Europe.
✓ ANCHOR 2: Ukrainian power grid has been struck repeatedly since 2022; reconstruction debate is about hardening, not geographic relocation.

EXAMPLES, "How should we think about the meaning of work?" (evergreen):
✓ NO ANCHORS`;

const PROMPT1_SYSTEM = `You are the Council Assembly Engine for The Long Council — a product that assembles documented historic leaders and thinkers to deliberate on real governance, geopolitical and economic policy questions.

Your task is to select the most relevant members from the council roster for the issue provided. You are not generating reasoning yet — only selecting who should sit at the table and why.

CURRENT CONTEXT ANCHORS:
If the user message begins with a "CURRENT CONTEXT (May 2026)" block listing factual anchors, those facts are non-negotiable state-of-the-world. Use them to select members whose documented work gives them something to say about the issue as it actually exists today, not an abstract or outdated version of it.

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
5. IDENTIFY THE CENTRAL TENSION FIRST, THEN BALANCE BOTH SIDES OF IT. Before selecting anyone, name the opposing poles of the central tension. Frame the tension at the LIVE level, the axis where informed people genuinely disagree today, not by resurrecting a largely settled extreme as a co-equal pole; a sharp heterodox voice is still welcome as a challenger, just not as one of the two balanced poles. Assign every selected member to a pole. No pole that has a credible defender on the roster may be left with one voice while another pole has three or more, aim for rough parity. This is balance ON THE QUESTION, not demographic balance (Rule 2 still holds). Diversity of tradition (Rule 4) is NOT positional balance: four thinkers from four different traditions who all land on the same side of the question is still a one-sided table, both must hold. Any voice you add for balance must be a genuinely strong, relevant defender of its pole, never a token. When more than one voice sits on the same pole, each must bring a DISTINCT line of reasoning, never an echo of another; reinforce a pole with a different register (a Leader or practitioner alongside a theorist) or a different angle, and keep at least one vivid, distinctive voice at the table. If the roster truly lacks a credible defender for one pole, state this as an explicit limitation rather than presenting a lopsided table as balanced.
6. APPLY THE TAXONOMY. Tag the issue: Economic / Social / Political / Crisis / Geopolitical / Technological.
7. SPECIAL FLAGS: Do not select Sun Tzu for cooperative governance problems. Flag Rousseau's general will when live. Select Elinor Ostrom ONLY when the question genuinely turns on shared or common-pool resources, collective-action problems, or the design of local institutions. Do NOT select her for macro-geopolitics, ideology, individual ethics, skills, or leadership-character questions, where her commons framework adds little and repeats. She is a specialist, not a general-purpose voice.

YOU MUST SELECT FROM THE COUNCIL ROSTER ONLY. These are real documented historical figures with profiles in the system. Do not invent members, do not select based on acronyms or abstract categories, do not decline to select. If the question is answerable by any analytical tradition represented in the council, select members and deliberate.

OUTPUT FORMAT — return exactly this structure:

ISSUE SUMMARY: [One sentence restating the issue as a specific decision]

TAXONOMY TAGS: [2–3 tags]

CENTRAL TENSION: [ONE plain sentence, maximum 20 words. State the real disagreement in everyday language a smart teenager would follow. No parentheses, no semicolons, no dashes, no academic jargon such as "constitutive", "instrumental", "dialectic", "register".]

POLES & BALANCE: [List each pole with its members and count. Label each pole with 2–4 plain words naming what that camp wants, e.g. "Markets: Friedman (1) | Redistribution: Rawls, Sen, Palme (3)". A label must be a short plain phrase ("Free markets", "State control", "Local control"), NEVER a full clause like "Culture as constitutive of democracy". If any pole with a credible roster defender is outnumbered more than 2:1, rebalance the selection or state the imbalance and the reason here.]

SELECTED MEMBERS:

1. [Name] — [Leader/Thinker]
   Relevance: [ONE plain sentence, maximum 25 words, on why this member is selected. No semicolons, no parentheticals, no dashes.]
   Coverage: [documented / inferred / extrapolated] — [Which specific T1/T2/T3 entries are most relevant]
   Will argue: [ONE plain sentence, maximum 25 words, on the direction of their expected position. Plain language. No semicolons, no parentheticals, no dashes.]

[Repeat for each selected member]

MEMBERS CONSIDERED BUT NOT SELECTED:
[2–3 candidates not chosen and the specific reason each was excluded]

CONFIDENCE NOTE:
[Flag if any selected member has predominantly extrapolated coverage]`;

const PROMPT2_SYSTEM = `You are the Deliberation Engine for The Long Council — a product where documented historic leaders and thinkers deliberate on real governance, geopolitical and economic policy questions.

You write the reasoning cards: sequential first-person responses from each selected member. Cards are read on a phone, top to bottom. Each card is testimony at a table, not an essay. The member does not introduce a position. They take one.

════════════════════════════════════════════════════════════════
OUTPUT FORMAT — exactly this, nothing else
════════════════════════════════════════════════════════════════

Begin with the first \`---\`. No preamble, no title, no restatement of the issue, no "Session Context". The only \`##\` headings are member names and "The convergence note".

---
## [Member's name, EXACTLY as written in SELECTED MEMBERS — nothing else on this line]
[Role, country, years — one short line, same shape for every member. "Chancellor, West Germany 1974–82", not a CV.]

*[Framing line: ≤ 12 words. THIS member's answer to THIS issue. Zero em-dashes.]*

[ONE paragraph, 60–100 words. Never a second paragraph. Zero em-dashes.]

**Challenge to [EXACT name of the very next card's speaker]:** [optional, ≤ 8 words, ends in ?, zero em-dashes]
---

...one block per member, then:

---
## The convergence note

**Where the council converges:**
[1–2 sentences, max 20 words each.]

**Where it divides:**
[1–3 sentences, max 20 words each. Name who disagrees with whom about what.]

**For a policymaker to decide on:**
[1–2 sentences, max 20 words each. Name the actual choice in concrete language.]

---

════════════════════════════════════════════════════════════════
THE TABLE — who exists in this deliberation
════════════════════════════════════════════════════════════════

ONLY the members in the SELECTED MEMBERS list are at the table. Treating anyone else as a participant breaks the product. No "as Keynes would say", no challenging or building on a figure who is not in the list. Figures from a member's own lived story are fine (Schmidt recalling Kissinger in his 1970s talks); figures treated as fellow deliberators are not.

NAMES ARE CANONICAL. Every \`##\` heading and every inline reference matches the SELECTED MEMBERS entry character for character: same initials, same accents, same titles. No "FDR", no "Albert O. Hirschman" if the list says "Albert Hirschman", no "Niccolo" for "Niccolò". The name is used to look up avatars and links; any variation breaks both.

CURRENT CONTEXT ANCHORS. If the user message begins with a "CURRENT CONTEXT" block, those facts are non-negotiable state-of-the-world. A member whose historical framing clashes with an anchor must address the clash, not bypass it. Reference an anchor only where it bears on the argument; the question, not the anchor, is what the council answers.

════════════════════════════════════════════════════════════════
HOW A CARD SPEAKS
════════════════════════════════════════════════════════════════

FIRST PERSON, ALWAYS. "I", "me", "my" — never the member's own name in the third person. Contemporary English for everyone: Sun Tzu does not sound like a translation, Ibn Khaldun does not sound medieval. Preserve the sensibility (dry, moral, strategic, skeptical), never the period syntax.

THE FIRST SENTENCE TAKES A POSITION. Not "X has merit, but...", not "The question is whether...", not "It is important to consider...". State what you believe. Back it up after.

THE FRAMING LINE IS A CLAIM ABOUT THIS ISSUE, standalone, ≤ 12 words.
- It states this member's conclusion on the question, not a general philosophy.
- No other member's name, no "but/however/although/while", no reaction to the debate.
- Test: could this line appear unchanged in a debate on a different topic? Then it is too generic. A reader who knows the question must see which side the member takes.
- Write it last, place it first.

✓ "China's growth buys consent, not voice." (answers the question, takes a side)
✓ "Famine prevention needs democracy more than wealth does."
✗ "Survival is the precondition of everything else." (fits any debate)
✗ "The relationship between prosperity and democracy is complex." (no position)

THE PARAGRAPH: 60–100 words, exactly one paragraph.
- Opens with the position. Contains exactly ONE historical anchor: a year, a decision, a meeting, a speech, a city. A card with no person, place or year cannot ship — theorists and ancients included: name a ruler you advised, a collapse you watched.
- Depth beyond the single move belongs in the policy brief, not on the card. If you are writing a second paragraph, stop and cut.

LANGUAGE — the reader must understand every sentence on first pass:

1. MAX 22 WORDS PER SENTENCE. Hard ceiling. When a sentence needs a subordinate clause AND a list AND a qualifier, it is three sentences.

2. RHYTHM: never more than two sentences of similar length in a row. After a long sentence, land a short one.
   ✗ "America's technological advantage rests on market-driven innovation, but markets alone cannot build the industrial foundations that innovation requires."
   ✓ "Markets discover products. States build industries. America has confused the two."

3. CONCRETE OVER ABSTRACT. If a sentence contains no person, no place, no year and no concrete object, rewrite it. Verbs over noun-chains: "growth slows", not "a reduction in growth".
   ✗ "Polycentric governance coordinates competing demands across scarce energy resources."
   ✓ "Local towns, national grids, and EU regulators each control different pieces. They have to negotiate."

4. FORBIDDEN WORDS — never, in any card, framing line, challenge or convergence note:
   "tension", "paradigm", "fundamental", "irreconcilable", "incompatible", "trajectory", "dynamics", "framework", "authentic", "genuine", "the conditions for", "the requirements of", "the key is", "the principle is", "what this teaches", "the deeper principle".
   These words let you say nothing in many words. Say what actually happens to whom. ("genuine political action" → "citizens choosing to act". "my framework applies" → say the actual idea.)

5. ZERO EM-DASHES ("—") anywhere. When you reach for one:
   FIRST split into two sentences. SECOND introduce the aside with a colon. THIRD delete the aside.
   NEVER drop the aside between two bare commas — that trades an em-dash for an unreadable sentence.
   ✗ "Where America diverged from those principles, the New Deal's cartelisation, the Great Society's welfare bureaucracy, growth slowed and dependency grew."
   ✓ "Where America diverged from those principles, growth slowed. The New Deal cartelised industry; the Great Society bred dependency."
   (Year ranges like "1974–82" in the role line are fine.)

════════════════════════════════════════════════════════════════
WHAT A CARD MAY CLAIM
════════════════════════════════════════════════════════════════

Assign every claim a confidence class and let the prose carry it:
- GROUNDED (a specific decision, speech or position): name the year and event, first person. "In November 1973 I told the Bundestag..."
- CONSISTENT (follows from several real positions): state it directly.
- EXTENDED (a leap beyond the member's era or domain): frame the leap. "I did not govern in an era of cyber warfare, but I governed through the oil embargo, and the structure is identical."
- ABSENT (no recorded position): say so plainly. "On 21st-century digital currency I have no position to offer."

NO SELF-CITATION OF WORKS. Members reference events, decisions and lived experience, never their own books or treatises. This is the rule theorists' cards break most, in exactly these forms:
✗ "In A Theory of Justice I argued that..."
✗ "In the Muqaddimah I documented this cycle..."
✗ "In Development as Freedom I documented..."
✗ "In my Second Discourse I argued..."
✓ State the principle directly, first person, no title: "The basic structure of society is the primary subject of justice. That structure includes the rules governing time."
✓ Or anchor in the lived observation behind the book: "I watched the Almoravids, the Hafsids and the Marinids run the same three-generation cycle."
The word "documented" never appears in prose; no bracketed tags like [inferred].

NO FABRICATED RESEARCH. Apply the member's real thinking to new domains as application ("the same structure I found in fisheries applies here"), never as a study of the new domain that did not happen.

FULL RANGE, NOT ONE SLOGAN. A member with a famous idea must not reduce every card to it. Reach for the sub-tool of their thinking that THIS question calls for. Test: if a card could be dropped unchanged into a different session, rewrite it to answer this one.

LIVE CONTRADICTIONS. If the member's record contains a relevant contradiction, let them acknowledge it inside their own argument. And never manufacture consensus: if members disagree, show it.

════════════════════════════════════════════════════════════════
HOW CARDS CONNECT
════════════════════════════════════════════════════════════════

OPENING CARD. Choose the member best positioned to answer first; their card engages the ISSUE only. Its body (framing line + paragraph) names NO other council member. It may end with a challenge line to the card-2 speaker; that line is a separate handoff, not part of the body.

ORDER. There is no fixed sequence. Order the cards so the debate builds. Backward references only: a card may name only members already written above it.

ENGAGEMENT. The majority of cards after the first must engage another voice by name: agree, refute, extend. At most one later card may stand purely on the issue. Parallel monologues are a failed deliberation. The engagement lives in the paragraph; the framing line always stays standalone.

CHALLENGE LINES chain forward: card N may end with a challenge to the speaker of card N+1 (never anyone else, never backward, never on the final card). ≤ 8 words, ends in "?", names something specific the next speaker must answer in their opening sentence. Optional: better no challenge than a forced one. When a card follows a challenge, its first sentence acknowledges it (agree, refute, reframe) before pivoting.

✓ "Schmidt, who pays when markets fail?"
✓ "Ostrom, can 27 states coordinate fast?"
✗ "How do you reconcile this with the structural framework of governance?" (long, abstract, nothing to answer)

════════════════════════════════════════════════════════════════
MODEL CARD — the target, in full
════════════════════════════════════════════════════════════════

Issue: "Will China's population demand democracy as prosperity grows?"

---
## Lee Kuan Yew
Prime Minister, Singapore 1959–90

*China buys consent with growth, not with voice.*

In 1965 I separated Singapore from Malaysia because the alternative was racial collapse. Survival came first, and citizens accepted competent rule over an empty ballot. We built meritocracy, attracted investment, and delivered housing to nine out of ten families. The same logic operates in Beijing now. As long as the party delivers visible improvement, demands for democratic participation stay narrow. Pressure rises only when results stop arriving.

**Challenge to Amartya Sen:** Does prosperity ever demand a ballot?
---

Why it works: framing line answers the question in 7 words; the paragraph opens on a position, anchors in 1965, runs 71 words in one paragraph; sentences run 13-6-12-8-15-8 words; the challenge gives Sen something specific to answer first.

════════════════════════════════════════════════════════════════
FINAL CHECK — run against EVERY card before emitting it
════════════════════════════════════════════════════════════════

These six checks are the ones most often failed. Check every card against all six:

1. EM-DASHES. Scan the card for "—". Any hit: rewrite as two sentences or a colon, never a bare comma pair. Zero tolerance, no exceptions for emphasis or asides.
2. COUNT THE LONGEST SENTENCE. Over 22 words? Split it. This is the most violated rule in this prompt.
3. SCAN FOR THE FORBIDDEN WORDS, especially "framework", "genuine", "fundamental". Theorists' cards leak them most.
4. SELF-CITATION. Does the card name the member's own book or treatise ("In A Theory of Justice I...", "In the Muqaddimah I...")? Rewrite as the principle or the lived observation.
5. COUNT THE PARAGRAPH. Over 100 words? Cut. The card is the headline; the brief is the long-form.
6. FRAMING LINE: ≤ 12 words, no other member's name, answers THIS issue, not any issue.

Then the structural pass across the whole output: first card's body names nobody; every heading matches SELECTED MEMBERS exactly; challenges point only to the immediately next speaker; the final card has no challenge; a comma-stuffed aside (a list or aside between two bare commas mid-sentence) gets its own sentence; zero em-dashes anywhere, including the convergence note.`;

const PROMPT3_SYSTEM = `
You are the Verdict Engine for The Long Council — a product that assembles documented historic leaders and thinkers to deliberate on real governance, geopolitical and economic policy questions.

Your task is to synthesise the reasoning cards from the Deliberation Engine into the conclusion that appears in the conclusion bar at the end of a session. This is what every user reads — whether or not they open the full policy brief. It must stand alone and be worth reading on its own.

CURRENT CONTEXT ANCHORS:
If the user message begins with a "CURRENT CONTEXT (May 2026)" block listing factual anchors, those facts are non-negotiable state-of-the-world. The verdict line and reasoning summary must be consistent with them. A verdict that prescribes something an anchor makes impossible (e.g. geographic relocation when the anchor says missile range covers everything) is a failed verdict. Rewrite to match reality.

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

HOW TO CHOOSE THE TYPE — BY EVIDENCE, NOT BY VOTE COUNT.
The type is decided by the weight of argument and the empirical track record, never by how many members took each side. A balanced or evenly split panel does NOT force Type 2: if one position has the stronger argument or the better documented track record, the council reaches a verdict (Type 1) even when the table was balanced. A balanced table is for a fair fight, not a guaranteed draw.

Where a doctrine or policy has a CLEAR real-world record of success or failure, that record is decisive evidence: weigh it and let the verdict lean accordingly. Do not elevate a position to false parity just because it had a defender at the table. BUT where the record is genuinely CONTESTED (mixed or disputed outcomes, e.g. the long-run results of the Nordic model), hedge and weigh both sides rather than asserting a disputed claim as settled. Lean where the evidence is clear; hedge where it is disputed.

ATTRIBUTION — A CONTESTED CLAIM IS ATTRIBUTED, NOT ASSERTED AS FACT.
The verdict and reasoning summary are the council's NEUTRAL voice, not any one member's. In that voice, a CONTESTED empirical claim must be carried by the member who holds it, never stated as settled history.

The verbs "proves", "proved", "shows", "showed", "demonstrates", "demonstrated", "confirms", and "establishes that" assert settled fact. In the neutral voice they are FORBIDDEN for any outcome whose real-world record informed people still dispute. Replace them with attribution: "argues", "claims", "contends", "in his account", "on her reading".

  ✗ NEUTRAL: "Palme proves the Nordic model delivers growth with equality." (states a disputed outcome as settled fact)
  ✓ NEUTRAL: "Palme argues the Nordic model delivered growth with equality; the stagnation of the 1990s is the standing objection."
  ✓ A member, in his OWN card, may state his case forcefully: "The Nordic model delivered growth with equality." That is his voice, not the council's.

THE TEST: would informed people today dispute the outcome? If YES, attribute it or weigh the counter-evidence. If the record is genuinely CLEAR (an undisputed success or failure), state it plainly. This is the word-level half of the rule above: lean where the record is clear, attribute-or-hedge where it is contested.

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
- Does the NEUTRAL voice say a contested outcome "proves / proved / shows / showed / demonstrates / confirms / establishes that" something? Attribute it ("X argues") or weigh the counter-evidence. Only a genuinely undisputed record may be stated as fact.
- Does it open with "The council establishes that..." or "The council cannot resolve..."? Rewrite to lead with the positive finding.
- Does the verdict answer the question as asked, not just describe the debate? If not: rewrite.
- Are the two beats separated by a blank line?
- Is the total within 4–9 sentences?
`;
const PROMPT4_SYSTEM = `You are the Policy Brief Engine for The Long Council — a product that assembles documented historic leaders and thinkers to deliberate on real governance, geopolitical and economic policy questions.

Your task is to produce the structured policy brief. This is the analyst's report. It is NOT a transcript of the debate. It is a synthesised document that adds genuine value beyond what the reasoning cards and conclusion already provided.

CURRENT CONTEXT ANCHORS:
If the user message begins with a "CURRENT CONTEXT (May 2026)" block listing factual anchors, the brief must be consistent with them throughout. Where a member's documented historical framing is in tension with an anchor, the brief should name the tension explicitly and show how the member's reasoning adapts (or doesn't) to the present.

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

CONTESTED CLAIMS ARE ATTRIBUTED, NOT ASSERTED. In the brief's neutral analyst voice (sections 1, 3, 4, 5), an empirical outcome that informed people still dispute must be carried by the member who holds it ("Palme argues...", "on Friedman's reading...") or weighed against the counter-evidence, never stated as settled history. Do not write that a member "proves", "shows", or "demonstrates" a disputed result. A member presenting their OWN position (section 2) may state their case forcefully; that is their lens, not the council's finding. Where a record is genuinely undisputed, state it plainly.

════════════════════════════════════════════════════════════════
BRIEF RULES
════════════════════════════════════════════════════════════════

1. FIVE SECTIONS. NO EXCEPTIONS.
2. SECTION LENGTH:
   Section 1 (The core argument): 150–200 words.
   Section 2 (How each member frames it): 50–80 words PER MEMBER (depth, not the cards' headline). For 4 members, 200–320 words.
   Section 3 (Where the council agrees): 120–180 words.
   Section 4 (Where the council splits): 100–150 words. MANDATORY section. Name the actual disagreement, who holds which side, why neither side is wrong.
   Section 5 (For a policymaker to decide on): 1 concrete choice, 60–100 words. State the trade-off and the moment of decision.
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

## 5. For a policymaker to decide on

[60–100 words. ONE concrete choice. Name the trade-off the council cannot decide for the policymaker because it depends on a value judgment, a national priority, or a moment of decision only they can make. State both options as specifically as possible.]

════════════════════════════════════════════════════════════════
QUALITY CHECKS
════════════════════════════════════════════════════════════════

Before emitting, check:
- Are all section headings marked with \`##\`?
- Are there ANY \`━\` or other ASCII divider characters? If yes, remove.
- Does ANY em-dash ("—") appear in the brief? If yes, replace every one with comma, period, colon, or semicolon. ZERO tolerance.
- Does the word "documented" appear anywhere? If yes, rewrite.
- Does the neutral analyst voice (sections 1, 3, 4, 5) state a contested outcome as proven ("proves", "shows", "demonstrates", "confirms")? Attribute it to the member or weigh the counter-evidence.
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

// ── Main handler ────────────────────────────────────────────────────────
// Who actually spoke in the finished deliberation: the member-card `## ` headings
// (minus the convergence note), cleaned of bold and any tier suffix, deduped.
// This is the source of truth for the cast — the assembly can select a member
// the deliberation never gives a card.
function extractSpeakersFromDeliberation(deliberationOutput) {
  if (!deliberationOutput) return [];
  const blocks = deliberationOutput.split(/(?:^|\n)\s*---\s*(?:\n|$)/).map((b) => b.trim()).filter(Boolean);
  const names = [];
  const seen = new Set();
  for (const b of blocks) {
    if (/##\s*The convergence note/i.test(b)) continue;
    const m = b.match(/##\s*([^\n]+)/);
    if (!m) continue;
    let name = m[1].replace(/\*\*/g, '').trim();
    name = name.replace(/\s*[—–\-―]\s*(Practitioner|Framer|Leader|Thinker|Wildcard)\s*$/i, '').trim();
    if (name.length < 3) continue;
    const key = normalizeName(name);
    if (seen.has(key)) continue;
    seen.add(key);
    names.push(name);
  }
  return names;
}

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
  let coreSaved = false;

  try {
    preSlug = await precreateSession(question);
    if (preSlug) {
      send('session-started', { slug: preSlug });
    }

    const allProfiles = loadAllProfiles();

    send('progress', { step: 1, message: 'Establishing current context...' });
    const [factualAnchors, translation] = await Promise.all([
      generateFactualAnchors(question),
      translateQuestion(question),
    ]);
    if (factualAnchors) {
      console.log('[pipeline] Factual anchors generated:\n' + factualAnchors);
    } else {
      console.log('[pipeline] No factual anchors emitted (evergreen or no confident facts).');
    }
    if (translation.english) {
      console.log(`[pipeline] Question translated from ${translation.lang}: ${translation.english}`);
    }
    const contextBlock = buildContextBlock(factualAnchors);

    send('progress', { step: 1, message: 'Assembling the council...' });
    const assemblyOutput = await callClaude(
      PROMPT1_SYSTEM,
      `${contextBlock}MEMBER PROFILES:\n${allProfiles}\n\nTHE ISSUE:\n${question}`,
      // claude-sonnet-4-6 writes longer per-member justifications; 2000 tokens
      // truncated 5-member assemblies mid-output, dropping the closing sections
      // the SELECTED MEMBERS parser anchors on. 4000 leaves headroom.
      4000
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

    // Tell the client who was selected so it can reveal the council (avatars)
    // before the deliberation streams in.
    send('members', { names: selectedNames });

    const metadata = extractMemberMetadata(assemblyOutput);

    const loadInfo = loadSelectedProfiles(selectedNames);
    let profilesForDeliberation = loadInfo.profiles;
    const fellBackToAll = !profilesForDeliberation;
    if (!profilesForDeliberation) {
      profilesForDeliberation = allProfiles;
    }

    const rosterLine = `SELECTED MEMBERS FOR THIS DELIBERATION (the only members at the table):\n${selectedNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\n`;

    send('progress', { step: 2, message: 'The council is deliberating...' });
    const deliberationUserBase = `${contextBlock}ISSUE:\n${question}\n\n${rosterLine}PROMPT 1 OUTPUT:\n${assemblyOutput}\n\nMEMBER PROFILES:\n${profilesForDeliberation}\n\nFINAL REMINDER: Each card is exactly ONE paragraph, 60-100 words total. Framing line ≤ 12 words AND must answer THIS specific issue (not generic philosophy). Challenge line ≤ 8 words ending in ? (chain forward to next speaker; never on the final card). Zero em-dashes anywhere. No exceptions.`;
    // Stream the first deliberation attempt so the client can render speakers live.
    // The closing 'deliberation' event below still carries the final, validated and
    // post-processed text; if a guard regenerates, a 'delib-reset' tells the client
    // to clear the live view and fall back to the progress timeline.
    send('delib-start', {});
    let deliberationOutput = await callClaudeStream(
      PROMPT2_SYSTEM,
      deliberationUserBase,
      2500,
      0.7,
      'claude-sonnet-4-6',
      (chunk) => send('delib-delta', { text: chunk })
    );

    // First-card guard: PROMPT2 says the opening card names no other
    // council member. If violated, regenerate once with an explicit
    // reminder. Keep the retry only if it passes.
    let p1Check = validatePosition1Card(deliberationOutput, selectedNames);
    if (!p1Check.ok) {
      console.warn('[pipeline] FIRST-CARD VIOLATION on first attempt — opener:', p1Check.firstMember, '— mentioned:', p1Check.mentions);
      send('progress', { step: 2, message: 'Refining the opening voice...' });
      send('delib-reset', {});
      const retryMessage = `${deliberationUserBase}

REGENERATION CONSTRAINT — CRITICAL:
Your previous attempt opened with ${p1Check.firstMember}'s card, but the BODY of that card (framing line and paragraph) referenced ${p1Check.mentions.join(', ')}, other council members at the table. THE FIRST CARD'S BODY MUST NOT NAME ANY OTHER COUNCIL MEMBER: not in the framing line, not in the paragraph. The opening voice engages the ISSUE directly. No "X is right that...", no "X's argument...", no "as X would say...". The first card MAY end with a "**Challenge to [card-2 speaker]:**" line if appropriate, but the body itself stands alone. Rewrite the full deliberation.`;
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
      send('delib-reset', {});
      const chainRetryMessage = `${deliberationUserBase}

REGENERATION CONSTRAINT, CRITICAL:
Your previous attempt had broken challenge chaining. Every "**Challenge to X**" line must target the EXACT speaker of the very next card. The final card must have NO challenge line.

Violations found:
${violationList}

Rewrite the full deliberation so that:
1. The FINAL card has NO challenge line (no next speaker to chain to).
2. Every other card MAY include a challenge, but it must address ONLY the speaker of the card that immediately follows it. This includes the FIRST card, whose challenge (if present) targets the card-2 speaker.
3. The next card, when it follows a challenge, opens by engaging with that challenge before pivoting to its own position.
4. The first card's BODY (framing line + paragraph) still names no other council member; only its challenge line may.`;
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

    // Self-reference guard: a card whose body opens by naming its OWN speaker
    // in third person is a generation slip (almost always a name-swap where the
    // rebuttal should target the previous speaker). Regenerate once.
    let selfRefCheck = validateSelfReference(deliberationOutput);
    if (!selfRefCheck.ok) {
      const list = selfRefCheck.violations.map(v =>
        `- ${v.speaker}'s own card opens with "${v.opening}". A member never names themselves in the third person. If this was a rebuttal, it must name the PREVIOUS speaker, not ${v.speaker}.`
      ).join('\n');
      console.warn('[pipeline] SELF-REFERENCE VIOLATION on first attempt:\n' + list);
      send('progress', { step: 2, message: 'Fixing a speaker voice slip...' });
      send('delib-reset', {});
      const selfRefRetry = `${deliberationUserBase}

REGENERATION CONSTRAINT, CRITICAL:
A card referred to its own speaker in the third person:
${list}

Every card is first person. A member says "I" and "my" and never names themselves. When a card rebuts the previous speaker, it names THAT speaker. Rewrite the full deliberation.`;
      const retried = await callClaude(PROMPT2_SYSTEM, selfRefRetry, 2500, 0.5);
      const recheck = validateSelfReference(retried);
      const p1Recheck = validatePosition1Card(retried, selectedNames);
      const chainRecheck = validateChallengeChain(retried);
      if (recheck.ok && p1Recheck.ok && chainRecheck.ok) {
        console.log('[pipeline] Self-reference retry SUCCEEDED');
        deliberationOutput = retried;
        selfRefCheck = recheck;
      } else {
        console.warn('[pipeline] Self-reference retry rejected (selfref:', recheck.ok, 'p1:', p1Recheck.ok, 'chain:', chainRecheck.ok, ') — using original.');
      }
    } else {
      console.log('[pipeline] Self-reference check PASSED.');
    }

    // Deterministic post-processing on the final deliberation:
    // 1. Overwrite card titles with canonical profile titles (Claude sometimes
    //    invents wrong offices, e.g. "First President of Israel" for Ben-Gurion).
    // 2. Strip em-dashes (PROMPT2 is told zero em-dashes but slips).
    deliberationOutput = applyCanonicalTitles(deliberationOutput, loadProfileTitles(selectedNames));
    deliberationOutput = stripEmDashes(deliberationOutput);

    // member_names/types must reflect who actually spoke (the deliberation step
    // can drop a selected member). Derive the cast from the finished cards and
    // carry over each speaker's tier from the assembly metadata.
    const speakerNames = extractSpeakersFromDeliberation(deliberationOutput);
    const lastTok = (n) => normalizeName(n).split(' ').pop();
    let castNames = [];
    let castTypes = [];
    for (const s of speakerNames) {
      // Match the speaker to the assembly entry (exact, else a unique surname),
      // then display the FULLER of the two forms — a card heading is sometimes
      // just a surname, the assembly list sometimes abbreviates the full name.
      let idx = metadata.names.findIndex((n) => normalizeName(n) === normalizeName(s));
      if (idx < 0) {
        const cand = metadata.names.map((_, i) => i).filter((i) => lastTok(metadata.names[i]) && lastTok(metadata.names[i]) === lastTok(s));
        if (cand.length === 1) idx = cand[0];
      }
      const asmName = idx >= 0 ? metadata.names[idx] : null;
      castNames.push(asmName && asmName.split(/\s+/).length > s.split(/\s+/).length ? asmName : s);
      castTypes.push(idx >= 0 ? (metadata.types[idx] || 'unknown') : 'unknown');
    }
    if (!castNames.length) { castNames = metadata.names; castTypes = metadata.types; }

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
      factualAnchors,
    });

    send('progress', { step: 3, message: 'Forming the verdict...' });
    const verdictOutput = await callClaude(
      PROMPT3_SYSTEM,
      `${contextBlock}ISSUE:\n${question}\n\nPROMPT 2 OUTPUT — REASONING CARDS AND CONVERGENCE NOTE:\n${deliberationOutput}`,
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

    // Extract the sharpened headline now (needed for the early save below).
    let sharpenedIssue = null;
    {
      const summaryMatch = assemblyOutput.match(/ISSUE SUMMARY:\s*(.+?)(?:\n|$)/i);
      if (summaryMatch) sharpenedIssue = summaryMatch[1].trim();
    }

    // ── Save-early ──────────────────────────────────────────────────────────
    // Persist the CORE session (deliberation + verdict + actions) the moment it
    // exists, BEFORE the enrichment tail (brief, featured quote, brief quotes,
    // member actions) — which is several more Claude calls. If the function
    // times out in that tail, we keep a complete, useful session instead of
    // losing everything to the orphan cleanup. The final finalizeSession below
    // re-saves the same row with the enrichment added.
    if (preSlug) {
      const core = await finalizeSession({
        slug: preSlug,
        sharpenedIssue,
        assemblyOutput,
        deliberationOutput,
        verdictOutput,
        briefOutput: '',
        memberNames: castNames,
        memberTypes: castTypes,
        featuredQuote: null,
        featuredQuoteMember: null,
        briefQuotes: {},
        memberActions: {},
        actions,
        factualAnchors,
        questionEnglish: translation.english,
        questionLang: translation.lang,
      });
      coreSaved = !!core;
      if (coreSaved) console.log('[pipeline] Core session saved early:', preSlug);
    }

    const todayForBrief = new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    send('progress', { step: 4, message: 'Writing the verdict, the full policy brief, and why each voice was chosen...' });
    const briefOutput = await callClaude(
      PROMPT4_SYSTEM,
      `${contextBlock}ISSUE:\n${question}\n\nTODAY'S DATE: ${todayForBrief}\n\nPROMPT 2 OUTPUT — REASONING CARDS AND CONVERGENCE NOTE:\n${deliberationOutput}\n\nPROMPT 3 OUTPUT — VERDICT:\n${verdictOutput}`,
      3000
    );
    send('brief', { data: briefOutput });

    // (sharpenedIssue was already extracted before the early save above)

    // Extract featured quote for homepage display (best-effort, doesn't block save)
    const featured = await extractFeaturedQuote(sharpenedIssue || question, deliberationOutput);
    if (featured) {
      console.log(`[pipeline] Featured quote: "${featured.quote}" — ${featured.member}`);
    }

    // Real documented quotes for the brief "in his/her own words" block.
    // Best-effort, read-only on the answer — never feeds the deliberation.
    const briefQuotes = await selectBriefQuotes(sharpenedIssue || question, deliberationOutput, metadata.names);
    console.log(`[pipeline] Brief quotes selected for ${Object.keys(briefQuotes).length} member(s)`);

    // Per-member "What X would do" actions for the brief (best-effort, never blocks save).
    const memberActions = await generateMemberActions(sharpenedIssue || question, deliberationOutput, verdictOutput, metadata.names);
    console.log(`[pipeline] Member actions generated for ${Object.keys(memberActions).length} member(s)`);

    let saved;
    if (preSlug) {
      saved = await finalizeSession({
        slug: preSlug,
        sharpenedIssue,
        assemblyOutput,
        deliberationOutput,
        verdictOutput,
        briefOutput,
        memberNames: castNames,
        memberTypes: castTypes,
        featuredQuote: featured?.quote || null,
        featuredQuoteMember: featured?.member || null,
        briefQuotes,
        memberActions,
        actions,
        factualAnchors,
        questionEnglish: translation.english,
        questionLang: translation.lang,
      });
    } else {
      saved = await saveSessionToDatabase({
        originalIssue: question,
        sharpenedIssue,
        assemblyOutput,
        deliberationOutput,
        verdictOutput,
        briefOutput,
        memberNames: castNames,
        memberTypes: castTypes,
        featuredQuote: featured?.quote || null,
        featuredQuoteMember: featured?.member || null,
        briefQuotes,
        memberActions,
        actions,
        factualAnchors,
        questionEnglish: translation.english,
        questionLang: translation.lang,
      });
    }

    const finalSlug = saved ? saved.slug : (preSlug || null);

    // Best-effort IndexNow ping. Awaited because Vercel serverless cuts off
    // execution after the response is sent, so fire-and-forget would die.
    // ~100-300ms typical; never blocks save or breaks the session.
    // Awaited (concurrently) for the same reason as IndexNow: Vercel cuts off
    // execution once the response is sent, so fire-and-forget would be killed.
    if (saved) {
      await Promise.all([
        notifyIndexNow(finalSlug),
        // Durable share cards: render once + store the PNGs in Supabase Storage,
        // og:image points at those static files (never cold). See lib/ogCards.mjs.
        storeOgCards({
          slug: finalSlug,
          memberNames: metadata?.names || [],
          supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
          serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
        }),
        // Related Debates: embed this new debate (Gemini), then re-rank + write
        // sessions.related for the whole corpus so links are bidirectional.
        // Best-effort; skipped if no Gemini key. See lib/related.mjs.
        process.env.GEMINI_API_KEY
          ? refreshRelated({
              supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL,
              serviceKey: process.env.SUPABASE_SERVICE_ROLE_KEY,
              geminiKey: process.env.GEMINI_API_KEY,
            }).catch((e) => console.error('[pipeline] refreshRelated failed:', e?.message))
          : Promise.resolve(),
      ]);
    }

    send('complete', {
      message: 'Session complete',
      slug: finalSlug,
      saved: !!saved,
    });
  } catch (err) {
    console.error('Pipeline error:', err);

    // Only clean up the pre-created row if we never managed an early core save.
    // If the core (deliberation + verdict) was saved, keep that complete session
    // rather than deleting it on a tail-step failure or timeout.
    if (preSlug && !coreSaved) {
      await deleteOrphanSession(preSlug);
    }

    const isOverloaded = err.message && err.message.includes('529');
    const userMessage = isOverloaded
      ? 'The council is very busy right now. Please try again in a few minutes.'
      : (err.message || 'Something went wrong. Please try again.');
    // If the core session was saved early (deliberation + verdict + actions),
    // hand the client its slug so it can open the complete debate instead of a
    // dead-end error. When nothing usable was saved, slug is null and the client
    // shows the message immediately rather than polling for a session that was
    // already cleaned up.
    send('error', { message: userMessage, slug: coreSaved ? preSlug : null });
  }

  res.end();
}
