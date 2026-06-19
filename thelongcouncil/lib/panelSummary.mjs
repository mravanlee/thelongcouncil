// Plain-language "panel summary" for the /who page — a REPAIR tool for the 11
// debates generated 16–19 June 2026 with claude-sonnet-4-6, whose assembly text is
// far more verbose than the retired model's (a 117-word "central tension", 50–70
// word "will argue" lines, academic pole labels). The assembly prompt has since been
// tightened so new debates are concise at the source; this module only rewrites the
// already-stored verbose ones into a short, plain summary saved as cards.panel_summary
// and read by /who (with the raw-assembly parse as fallback for every other debate).
//
// The LLM call stays with each caller (the backfill script). This module owns the
// one contract: what to extract, what to ask, and how to validate the result.

// ── Pull CENTRAL TENSION + poles + selected members out of the assembly ──
export function extractAssemblyFraming(assembly) {
  const text = assembly || '';
  const LABELS = 'ISSUE SUMMARY|TAXONOMY TAGS|CENTRAL TENSION|POLES & BALANCE|SELECTED MEMBERS|MEMBERS CONSIDERED BUT NOT SELECTED|CONFIDENCE NOTE';
  const grab = (label) => {
    const re = new RegExp(label + ':\\s*([\\s\\S]*?)(?=\\n\\s*(?:' + LABELS + ')\\s*:|$)', 'i');
    const m = text.match(re);
    return m ? m[1].trim() : '';
  };
  const stripMd = (v) => (v || '').replace(/\*+/g, '').replace(/\s+/g, ' ').trim();
  const stripTier = (s) => (s || '').replace(/\s*[—–-]\s*(Practitioner|Framer|Leader|Thinker|Wildcard)(\/\w+)?\s*$/i, '').trim();

  const tension = stripMd(grab('CENTRAL TENSION'));

  // Poles: bullet list ("- **Label:** Name (2) — N voices") or legacy pipe line.
  // The verbose model trails member lists with "— 3 voices", "→ 3 voices, distinct
  // registers", or "(3)", and sometimes adds "Imbalance note:" / "Total:" lines that
  // are NOT poles. Cut names at the first dash/arrow/paren/digit and keep only short,
  // name-shaped tokens, so the bookkeeping prose can never reach the page.
  const polesRaw = grab('POLES & BALANCE');
  const poleNames = (s) => s
    .replace(/\s+[—–\-→]\s+.*$/, '')               // drop trailing " — 2 voices" / " → 3 voices, ..."
    .replace(/\s*=\s*\d.*$/, '')                    // drop trailing "= 2"
    .split(',')
    .map((x) => x.replace(/\([^)]*\)/g, '').trim()) // strip any parenthetical "(2)" / "(2 voices)"
    .filter((x) => x && x.split(/\s+/).length <= 4 && !/[/]|adjacent|^voices?$/i.test(x));
  const poleLines = polesRaw.split('\n').map((l) => l.trim()).filter((l) => /^[-*]/.test(l));
  const poles = (poleLines.length >= 2
    ? poleLines.map((l) => stripMd(l.replace(/^[-*]\s*/, '')))
    : polesRaw.split('|').map((seg) => stripMd(seg))
  ).map((seg) => {
    const mm = seg.match(/^(.*?):\s*(.*)$/);
    if (!mm) return null;
    if (/^(note|imbalance|total|balance|note on)\b/i.test(mm[1].trim())) return null;
    const names = poleNames(mm[2]);
    return names.length ? { label: mm[1].trim(), names } : null;
  }).filter(Boolean);

  // Selected members: headers as "**N. Name — Tier**" with Relevance/Will argue lines.
  let selBlock = (text.match(/SELECTED MEMBERS:[^\n]*\n+([\s\S]*?)(?=\n\s*(?:MEMBERS CONSIDERED BUT NOT SELECTED|CONFIDENCE NOTE)\s*:|$)/i) || [])[1] || '';
  selBlock = selBlock.replace(/^[ \t]*[-–—]{3,}[ \t]*$/gm, '').replace(/\[Special flag:[\s\S]*?\]/gi, '');
  const tag = (entry, k) => {
    const m = entry.match(new RegExp('^\\s*' + k + ':\\s*([\\s\\S]*?)(?=\\n\\s*(?:Relevance|Coverage|Will argue):|$)', 'im'));
    return m ? stripMd(m[1]).replace(/\[(?:documented|inferred|extrapolated)[^\]]*\]\s*[—–-]?\s*/gi, '').trim() : '';
  };
  const members = selBlock.split(/\n(?=[ \t]*(?:\*\*)?[ \t]*\d+\.[ \t])/).map((e) => e.trim()).filter(Boolean).map((entry) => {
    const firstLine = entry.split('\n')[0] || '';
    const name = stripTier(firstLine.replace(/^[ \t]*(?:\*\*)?[ \t]*\d+\.[ \t]*/, '').replace(/\*\*/g, '').trim());
    return { name, willArgue: tag(entry, 'Will argue'), relevance: tag(entry, 'Relevance') };
  }).filter((m) => m.name && !/^(Relevance|Coverage|Will argue)$/i.test(m.name));

  return { tension, poles, members };
}

// ── Prompt: rewrite the framing in plain language, keeping the same members ──
export function buildPanelSummaryPrompt(question, framing) {
  const polesBlock = framing.poles
    .map((p, i) => `${i + 1}. Current label: "${p.label}"\n   Members: ${p.names.join(', ')}`)
    .join('\n');
  const membersBlock = framing.members
    .map((m, i) => `${i + 1}. ${m.name}\n   Will argue (too long): ${m.willArgue || '(none)'}\n   Why selected (too long): ${m.relevance || '(none)'}`)
    .join('\n\n');
  return `You are rewriting the framing of a council debate so an ordinary, curious reader understands it at a glance. The current text is dense and academic. Rewrite it in plain, concrete English.

QUESTION:
${question}

CURRENT CENTRAL TENSION (too dense):
${framing.tension || '(none)'}

CURRENT POLES (academic labels):
${polesBlock || '(none)'}

CURRENT MEMBERS (their lines are too long):
${membersBlock || '(none)'}

Rewrite rules:
- TENSION: one plain sentence, 12 to 22 words. State the real disagreement in everyday words. No parentheses, no semicolons, no dashes, no jargon ("constitutive", "instrumental", "register"). A smart teenager should get it.
- POLE LABELS: 2 to 5 words each, plain and concrete, naming what that camp believes. Not a clause.
- For EACH member, "stance": one plain sentence, max 22 words, what they will argue. "why": one plain sentence, max 20 words, why they are at this table. No semicolons, parentheses, or dashes.
- Keep the SAME poles and the SAME members, in the SAME order, with the SAME names exactly as given. Do not add, drop, rename, or move anyone.

Return ONLY valid JSON, no preamble, exactly:
{"tension":"...","poles":[{"label":"...","names":["..."]}],"members":[{"name":"...","stance":"...","why":"..."}]}`;
}

// ── Validate + normalise the LLM response into the stored shape, or null ──
export function parsePanelSummary(text, framing) {
  if (!text) return null;
  let obj;
  try {
    const m = text.match(/\{[\s\S]*\}/);
    if (!m) return null;
    obj = JSON.parse(m[0]);
  } catch {
    return null;
  }
  const clean = (s) => String(s || '')
    .replace(/\s*[—–]\s*/g, ', ')
    .replace(/\s+([,.;:)])/g, '$1')
    .replace(/,\s*([,.;:)])/g, '$1')
    .replace(/,\s*,/g, ',')
    .replace(/\s{2,}/g, ' ')
    .trim();

  const tension = clean(obj.tension);
  if (!tension || tension.length < 10) return null;

  // Always keep OUR poles/members (names + order); take only the model's wording,
  // so a hallucinated roster change can never reach the page.
  const poles = (framing?.poles || []).map((orig, i) => {
    const got = Array.isArray(obj.poles) ? obj.poles[i] : null;
    return { label: (got && clean(got.label)) || orig.label, names: orig.names };
  });

  const byName = {};
  if (Array.isArray(obj.members)) {
    for (const m of obj.members) if (m && m.name) byName[String(m.name).trim().toLowerCase()] = m;
  }
  const members = (framing?.members || []).map((orig, i) => {
    const got = byName[orig.name.toLowerCase()] || (Array.isArray(obj.members) ? obj.members[i] : null) || {};
    return {
      name: orig.name,
      stance: clean(got.stance) || orig.willArgue,
      why: clean(got.why) || orig.relevance,
    };
  });

  return { tension, poles, members };
}
