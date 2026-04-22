import fs from 'fs';
import path from 'path';

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
    return null;
  }

  return matched.join('\n\n---\n\n');
}

function normalizeName(name) {
  return name.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, ' ');
}

// ── Member extraction from Prompt 1 output ──────────────────────────────
// Accepts multiple dash characters: — (em), – (en), - (hyphen), ― (horizontal bar)
// Also tolerates line variations.
function extractSelectedMembers(assemblyOutput) {
  // First locate the SELECTED MEMBERS section
  const selectedMatch = assemblyOutput.match(
    /SELECTED MEMBERS:\s*\n([\s\S]*?)(?=\n\s*(?:MEMBERS CONSIDERED|CONFIDENCE NOTE|$))/i
  );

  if (!selectedMatch) {
    console.warn('[pipeline] Could not locate "SELECTED MEMBERS:" section in Prompt 1 output.');
    return [];
  }

  const section = selectedMatch[1];
  const names = [];

  // Accept any dash-like character between name and role tier
  // Also accept the tier being missing (sometimes Prompt 1 omits it)
  const dashChars = '[—–\\-―]';
  const regex = new RegExp(
    `^\\s*\\d+\\.\\s+(.+?)(?:\\s+${dashChars}\\s+(?:Practitioner|Framer))?\\s*$`,
    'gm'
  );

  let match;
  while ((match = regex.exec(section)) !== null) {
    const rawName = match[1].trim();
    // Skip if this line doesn't look like a name (too short, or is a sub-line like "Relevance:")
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

// ── Roster validator ────────────────────────────────────────────────────
const ALL_COUNCIL_MEMBERS = [
  'Lee Kuan Yew', 'Helmut Schmidt', 'Margaret Thatcher', 'Franklin Roosevelt',
  'Franklin D. Roosevelt', 'Konrad Adenauer', 'Nelson Mandela', 'Deng Xiaoping',
  'Mustafa Kemal Ataturk', 'Mustafa Kemal Atatürk', 'David Ben-Gurion',
  'David Ben Gurion', 'Jawaharlal Nehru', 'Indira Gandhi', 'Julius Nyerere',
  'Mahathir Mohamad', 'Lula', 'Luiz Inácio Lula da Silva', 'Lula da Silva',
  'Ellen Johnson Sirleaf', 'Olof Palme', 'Simón Bolívar', 'Simon Bolivar',
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

// ── Claude API call ─────────────────────────────────────────────────────
async function callClaude(system, user, maxTokens = 4000) {
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

// ── Prompts (unchanged from rollback) ───────────────────────────────────

const PROMPT1_SYSTEM = `You are the Council Assembly Engine for The Long Council — a product that assembles documented historic leaders and thinkers to deliberate on real governance, geopolitical and economic policy questions.

Your task is to select the most relevant members from the council roster for the issue provided. You are not generating reasoning yet — only selecting who should sit at the table and why.

CONFIDENCE SIGNALS — used throughout all outputs:
[documented] — directly traceable to a specific decision, speech, or published position in the member's T1–T3 profile. Always cite the specific source.
[inferred] — consistent with multiple documented positions but not a direct quote or recorded decision. State why the inference is warranted.
[extrapolated] — logical extension of documented positions to a domain or era beyond the member's direct experience. Must be explicitly framed as such.
[no documented position] — the member has no recorded position on this topic. Silence noted honestly. Do not fill the gap.

SELECTION RULES:
1. SELECT 3–6 MEMBERS covering every distinct analytical tradition genuinely relevant to this issue. Err toward 4–5 rather than the minimum. A council of 2 is almost never enough — someone is always missing. Include both Practitioners (decision-makers) and Framers (theorists) unless the issue is purely one or the other.
2. RELEVANCE IS THE ONLY CRITERION. Do not select members to achieve geographic or gender balance if they are not genuinely relevant.
3. ASSESS CONFIDENCE LEVEL BEFORE SELECTING. Prefer [documented] coverage.
4. ENSURE DIVERSITY OF ANALYTICAL TRADITION. Avoid selecting members who all reason from the same framework.
5. IDENTIFY THE CENTRAL TENSION FIRST. Select members who will sit on different sides of that tension.
6. APPLY THE TAXONOMY. Tag the issue: Economic / Social / Political / Crisis / Geopolitical / Technological.
7. SPECIAL FLAGS: Do not select Lula as primary voice on anti-corruption design. Do not select Sun Tzu for cooperative governance problems. Flag Rousseau's general will when live.

OUTPUT FORMAT — return exactly this structure:

ISSUE SUMMARY: [One sentence restating the issue as a specific decision]

TAXONOMY TAGS: [2–3 tags]

CENTRAL TENSION: [One sentence identifying the core analytical conflict]

SELECTED MEMBERS:

1. [Name] — [Practitioner/Framer]
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
CRITICAL OUTPUT CONSTRAINTS — READ FIRST
════════════════════════════════════════════════════════════════

STEP 1 — COMMIT TO SPEAKING ORDER BEFORE WRITING.

The very first line of your output is:

SPEAKING ORDER: [Member A] → [Member B] → [Member C] → [Member D]

Where Member A is the most grounded, decision-based voice and the final member is the most framework-based voice. This line is required. It is stripped from the user-facing output but forces you to commit to sequence before writing any cards.

HOW TO DETERMINE ORDER:
- GROUNDED / FIRST: modern practitioners who made decisions directly relevant to this issue. Examples: Schmidt on European policy, Roosevelt on wartime strategy, Lee Kuan Yew on governance, Keynes on economic crisis response.
- FRAMEWORK / LAST: ancient thinkers and pure theorists who supply frameworks but not modern decisions. Examples: Sun Tzu, Confucius, Kautilya, Machiavelli, Ibn Khaldun, Ali ibn Abi Talib, Rawls, Arendt, Rousseau, Locke.

Ancient thinkers ALWAYS speak after modern practitioners. Sun Tzu never speaks before a 20th-century policymaker. This is absolute.

STEP 2 — BEGIN CARDS AFTER SPEAKING ORDER.

After the SPEAKING ORDER line, emit a blank line, then begin the first card with \`---\`.

NO PREAMBLE. NO META-COMMENTARY. NO TITLE BLOCK.

Do NOT emit any of the following:
- Titles like "Deliberation Engine Output" or "The Long Council — Session"
- Headings like "Issue Analysis", "Central Tension", "Session Context"
- A restatement of the issue
- Any "##" heading that is not a member's name or "The convergence note"

════════════════════════════════════════════════════════════════
FORBIDDEN WORDS AND PHRASINGS
════════════════════════════════════════════════════════════════

The word "documented" MUST NEVER appear in the prose of any card.
Rewrites:

  "my documented experience"     →  "my experience"
  "documented risks"             →  "the risks"
  "documented limits"            →  "the limits"
  "documented pattern"           →  "the pattern"
  "documented consequences"      →  "the consequences"
  "my documented position"       →  "my position"
  "documented history"           →  "the historical record"

Also avoid "evidenced", "attested", "on the record".
Do not emit bracketed confidence tags like [documented], [inferred], [extrapolated].

NO SELF-CITATION OF WRITTEN WORKS.

Members reference events, decisions, policies, and lived experience — NOT their own books, chapters, or treatises.

FORBIDDEN:
- "As I wrote in Chapter 6 of The Art of War..."
- "In my Prince I argued..."
- "My concept of 'the space of appearance' as I named it..."
- "In the Muqaddimah I described..."
- "My General Theory demonstrated..."

CORRECT:
- State the principle directly. "The higher strategy is to break the adversary's resolve without direct confrontation."
- Reference decisions and events, not publications. Schmidt references his 1973 Bundestag speech (an event) — not his published essays.
- Ancient thinkers speak the principle in their own voice, in modern English, without naming the work it came from.

════════════════════════════════════════════════════════════════
CONFIDENCE — INTERNAL REASONING DISCIPLINE
════════════════════════════════════════════════════════════════

Before writing each claim, mentally assign it to one of four categories:

GROUNDED    — directly traceable to a specific decision, speech, or published position in the member's T1–T3 profile.
CONSISTENT  — not a direct quote, but follows from multiple documented positions.
EXTENDED    — a logical extension to a domain or era beyond the member's direct experience.
ABSENT      — no recorded position. Do not fill the gap.

Communicate confidence through the prose:

- GROUNDED: name the decision, year, speech, or event. "In his November 1973 Bundestag address, Schmidt argued..."
- CONSISTENT: state the claim directly. "The deeper principle is that alliance relationships constrain but also enable security policy."
- EXTENDED: frame the leap explicitly. "I did not govern in an era of cyber warfare — but I governed during the oil embargo, and the structure of the problem is identical."
- ABSENT: acknowledge silence plainly. "On 21st-century digital currency I have no position to offer."

════════════════════════════════════════════════════════════════
REASONING CARD RULES
════════════════════════════════════════════════════════════════

1. SPEAKING ORDER IS FIXED AFTER STEP 1.
   Write the cards in exactly the order declared in the SPEAKING ORDER line. Do not reorder.

2. STRICT SEQUENCING OF REFERENCES.
   A member at position N may only reference members at positions 1 through N-1. Never reference a member who has not yet spoken. The member at position 1 references NO prior speaker.

3. THE FINAL MEMBER HAS NO "CHALLENGE TO" LINE.
   Members at positions 1 through N-1 end with:
     **Challenge to [next member's name]:** [one sentence]
   The member at position N (the final speaker) does NOT emit a Challenge line. Their card ends with the second reasoning paragraph. Nothing more.

4. EVERY CARD IS FIRST-PERSON, IN CONTEMPORARY ENGLISH.
   Each member speaks as themselves — translated into English a 2026 reader absorbs at reading speed.

   PRESERVE: characteristic tone (dry, aphoristic, moral, strategic, skeptical, paternal), habitual level of abstraction, angle on problems.

   DO NOT preserve: archaic phrasing, period syntax, dated vocabulary, ceremonial cadence, pseudo-classical rhetorical structures.

   Sun Tzu does not sound like a translation of The Art of War. Confucius does not say "the Master says". Ibn Khaldun does not sound medieval. A member from 500 BCE and one from 1975 should both read as contemporary prose — only their sensibility distinguishes them.

5. EVERY MEMBER AFTER POSITION 1 MUST DIRECTLY ENGAGE THE PREVIOUS SPEAKER by name. Parallel monologues are not deliberation.

6. GROUND CLAIMS IN SPECIFIC EVENTS — IN PROSE.
   Sourced moments in natural language: year, venue, decision, speech. Never with bracketed citation tags. Never citing written works.

7. EACH CARD HAS THREE PARTS — FOLLOW EXACTLY:

   a) FRAMING LINE
      One sentence in italics, maximum 15 words.
      The single analytical lens this member brings — the thesis.

   b) REASONING
      150–250 words across EXACTLY TWO PARAGRAPHS, separated by a blank line.

      Paragraph 1 (80–120 words) — the grounded argument.
      For position 1: open with the member's own position anchored in a specific sourced moment.
      For positions 2 through N: open by engaging the previous speaker by name, then state your position anchored in a specific sourced moment from your own experience.

      Paragraph 2 (70–130 words) — the implication.
      Draw out what your position means. Name the alternative you reject or extend.

      DO NOT write a single block. DO NOT write three or more paragraphs. Exactly two, separated by a blank line.

   c) CHALLENGE LINE (only for positions 1 through N-1)
      Exactly one sentence. To the NEXT speaker only.
      The final speaker omits this line entirely.

8. SURFACE LIVE T4 CONTRADICTIONS.
   If relevant, surface as a tension the member acknowledges within their own argument.

9. DO NOT PRODUCE FALSE CONSENSUS.

10. LENGTH DISCIPLINE.
    150–250 words per card. Framing line 15 words or fewer. Challenge line exactly one sentence (positions 1 through N-1 only).

════════════════════════════════════════════════════════════════
OUTPUT FORMAT — produce exactly this structure
════════════════════════════════════════════════════════════════

SPEAKING ORDER: [Member A] → [Member B] → [Member C] → [Member D]

---
## [Member A — position 1]
[Role, Country, Years]

*[Framing line — maximum 15 words.]*

[Paragraph 1 — 80–120 words. The grounded argument with a sourced moment. No previous speaker to engage.]

[Paragraph 2 — 70–130 words. The implication.]

**Challenge to [Member B]:** [Exactly one sentence.]
---
## [Member B — position 2]
[Role, Country, Years]

*[Framing line.]*

[Paragraph 1 — engages Member A by name, states position.]

[Paragraph 2 — implication.]

**Challenge to [Member C]:** [One sentence.]
---

[... continue for each middle member ...]

---
## [Member N — final position]
[Role, Country, Years]

*[Framing line.]*

[Paragraph 1 — engages previous speaker by name, states position.]

[Paragraph 2 — implication.]
---

After the final card (which has no Challenge line), emit:

---
## The convergence note

**Where the council converges**
[1–2 sentences naming the principle all members accept.]

**Where it divides**
[1–3 sentences naming the specific disagreement and why it is not resolvable through argument alone.]

**What only the policymaker can resolve**
[1–2 sentences naming the decision-point requiring a judgment the council cannot make.]
---

════════════════════════════════════════════════════════════════
QUALITY CHECKS — apply before producing output
════════════════════════════════════════════════════════════════

Before writing, ask:
- Is the SPEAKING ORDER line at the very top of my output?
- Do modern practitioners come before ancient thinkers and pure theorists?
- For each card after position 1, have I identified who the previous speaker is (the member immediately before in the SPEAKING ORDER)?

Before emitting each card, check:

1. ROSTER CHECK — ABSOLUTE PRIORITY:
   - Does this card name, address, or build on any person who is NOT in the SELECTED MEMBERS list?
   - If yes, rewrite. The only exceptions are historical persons referenced as part of the speaker's own experience (Kissinger as Schmidt's counterpart, not as a council member).

2. SEQUENCING CHECK:
   - Does this card reference only members earlier in the SPEAKING ORDER? If it references someone later, rewrite.
   - If this is position 1, does it reference no prior speaker? If it references anyone, rewrite.
   - If this is the final position, does it OMIT the Challenge line? If the Challenge line is present, delete it.

3. FORBIDDEN WORDS CHECK:
   - Does "documented" appear in the prose? Rewrite.
   - Are there bracketed tags? Remove.
   - Does the card cite a book, chapter, or treatise by name? Rewrite the reference as a principle or event.

4. STRUCTURE CHECK:
   - Is the framing line 15 words or fewer?
   - Does the reasoning consist of EXACTLY TWO paragraphs?
   - Is total reasoning 150–250 words?

5. VOICE CHECK:
   - Does the member sound like themselves, in modern English?
   - Any archaic, ceremonial, or pseudo-classical phrasing? Rewrite.`;

const PROMPT3_SYSTEM = `You are the Verdict Engine for The Long Council — a product that assembles documented historic leaders and thinkers to deliberate on real governance, geopolitical and economic policy questions.

Your task is to synthesise the reasoning cards from the Deliberation Engine into the conclusion that appears in the conclusion bar at the end of a session. This is what every user reads — whether or not they open the full policy brief. It must stand alone and be worth reading on its own.

The conclusion bar has two parts only: the verdict and the reasoning summary. Nothing else. Limits, unresolved questions, and counterfactuals belong in the policy brief. This output is the front page. Sharp, clear, honest.

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
The council does not reach a verdict. Used when members reason from genuinely incompatible frameworks, or the central tension depends on a value judgment only the user can make.

════════════════════════════════════════════════════════════════
VERDICT RULES
════════════════════════════════════════════════════════════════

1. LEAD WITH WHAT THE COUNCIL ESTABLISHED — NEVER WITH WHAT IT COULDN'T DECIDE.
   Even in Type 2, the council establishes something real. The verdict line states that positive finding first. Do not open with "the council cannot resolve..." or "the council is divided..." or "the council establishes that..."

2. THE REASONING SUMMARY HAS TWO BEATS.
   Two distinct movements, separated by a blank line:

   Beat 1 — The synthesis. 2–4 sentences. Name each member's contribution in one clause.

   Beat 2 — The irreducible split. 1–2 sentences.

3. DO NOT MANUFACTURE CONSENSUS.

4. WRITE IN CONTEMPORARY ENGLISH.

5. LENGTH.
   Verdict line: 1–3 sentences.
   Reasoning summary: 3–6 sentences total.
   Total: 4–9 sentences. No more.

════════════════════════════════════════════════════════════════
OUTPUT FORMAT
════════════════════════════════════════════════════════════════

CONCLUSION TYPE: [Type 1 — Verdict / Type 2 — Territory of the Debate]

---
## Verdict

[1–3 sentences. Leads with what the council established.]

## Reasoning

[Beat 1 — The synthesis. 2–4 sentences.]

[Beat 2 — The irreducible split. 1–2 sentences. Omit if no meaningful dissent.]
---

════════════════════════════════════════════════════════════════
QUALITY CHECKS
════════════════════════════════════════════════════════════════

Before emitting, check:
- Does "documented" appear? Rewrite.
- Does it open with "The council establishes that..."? Rewrite.
- Is the total within 4–9 sentences?
- Are the two beats separated by a blank line?`;

const PROMPT4_SYSTEM = `You are the Policy Brief Engine for The Long Council — a product that assembles documented historic leaders and thinkers to deliberate on real governance, geopolitical and economic policy questions.

Your task is to produce the structured policy brief. This is the analyst's report — not a transcript of the debate, but a synthesised document that adds genuine value beyond what the reasoning cards and conclusion already provided.

════════════════════════════════════════════════════════════════
WRITING STYLE
════════════════════════════════════════════════════════════════

- Write at the level of a long-form Economist leader, but with more narrative tension.
- Open every section with the most interesting thing — not the most obvious.
- Concrete before abstract. Ground every argument in a specific moment before stating the general principle.
- Short sentences at moments of emphasis.
- Active voice throughout.
- No bullet points in body text. Connected prose.
- No nominalisations.

The word "documented" MUST NOT appear in the prose. Do not emit bracketed confidence tags. Do not cite members' written works by name — reference events, decisions, policies.

════════════════════════════════════════════════════════════════
BRIEF RULES
════════════════════════════════════════════════════════════════

1. FOUR SECTIONS. NO EXCEPTIONS.
2. SECTION LENGTH:
   Section 1: 150–200 words.
   Section 2: 100–130 words total across all members.
   Section 3: 150–200 words.
   Section 4: 2–3 scenarios, 1–2 sentences each, 60–100 words maximum.
3. Total brief: 460–630 words.
4. This is NOT a transcript replay. Add something the reasoning cards did not say.

════════════════════════════════════════════════════════════════
OUTPUT FORMAT — use proper markdown headings
════════════════════════════════════════════════════════════════

Emit clean markdown. Use \`##\` for section headings. Do not use ASCII box-drawing characters or visual dividers of any kind.

**[Issue title — short, specific, no more than 10 words]**

[Taxonomy tags] · [Number of members] · [Today's date]

**Confidence summary:** [One sentence on aggregate confidence level.]

## 1. The core argument

[150–200 words. Open with sharpest insight. Active voice.]

## 2. How each member frames it

[100–130 words total. Structure each member as a short paragraph opening with their name in bold. Example:

**Franklin D. Roosevelt** sees this through the lens of...

**Helmut Schmidt** reframes the question as...

Lens not transcript. Surface any live T4 contradictions.]

## 3. Where the council agrees

[150–200 words. 3–5 specific claims. Open with the most surprising point of agreement. Prose, not bullets.]

## 4. What would change this verdict

[2–3 scenarios. 1–2 sentences each. Hard limit 60–100 words total.]

════════════════════════════════════════════════════════════════
QUALITY CHECKS
════════════════════════════════════════════════════════════════

Before emitting, check:
- Are all section headings marked with \`##\`?
- Are there ANY \`━\` or other ASCII divider characters? If yes, remove.
- Does the word "documented" appear anywhere? If yes, rewrite.
- Are member names in section 2 marked with \`**bold**\`?
- Does section 2 stay within 100–130 words total?
- Is the total brief within 460–630 words?`;

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

  try {
    const allProfiles = loadAllProfiles();

    // ── Prompt 1 — Assemble the council ──────────────────────────────
    send('progress', { step: 1, message: 'Assembling the council...' });
    const assemblyOutput = await callClaude(
      PROMPT1_SYSTEM,
      `MEMBER PROFILES:\n${allProfiles}\n\nTHE ISSUE:\n${question}`,
      2000
    );
    send('assembly', { data: assemblyOutput });

    // Log the first 800 chars of Prompt 1 output so we can see what it actually returned
    console.log('[pipeline] === Prompt 1 output (first 800 chars) ===');
    console.log(assemblyOutput.substring(0, 800));
    console.log('[pipeline] === end Prompt 1 preview ===');

    // ── Extract selected members, load only their profiles ───────────
    const selectedNames = extractSelectedMembers(assemblyOutput);
    console.log('[pipeline] Extracted selected names:', selectedNames);

    let profilesForDeliberation = null;
    if (selectedNames.length > 0) {
      profilesForDeliberation = loadSelectedProfiles(selectedNames);
    }
    if (!profilesForDeliberation) {
      console.warn('[pipeline] Falling back to all profiles for Prompt 2.');
      profilesForDeliberation = allProfiles;
    } else {
      console.log('[pipeline] Successfully loaded', selectedNames.length, 'selected profiles for Prompt 2.');
    }

    const rosterLine = selectedNames.length > 0
      ? `SELECTED MEMBERS FOR THIS DELIBERATION (the only members at the table):\n${selectedNames.map((n, i) => `${i + 1}. ${n}`).join('\n')}\n\n`
      : '';

    // ── Prompt 2 — Deliberate ────────────────────────────────────────
    send('progress', { step: 2, message: 'The council is deliberating...' });
    const deliberationOutput = await callClaude(
      PROMPT2_SYSTEM,
      `ISSUE:\n${question}\n\n${rosterLine}PROMPT 1 OUTPUT:\n${assemblyOutput}\n\nMEMBER PROFILES:\n${profilesForDeliberation}`,
      5000
    );
    send('deliberation', { data: deliberationOutput });

    // ── Roster violation check ───────────────────────────────────────
    if (selectedNames.length > 0) {
      validateRoster(deliberationOutput, selectedNames);
    } else {
      console.warn('[pipeline] Roster validation SKIPPED because no names extracted from Prompt 1.');
    }

    // ── Prompt 3 — Verdict ────────────────────────────────────────────
    send('progress', { step: 3, message: 'Forming the verdict...' });
    const verdictOutput = await callClaude(
      PROMPT3_SYSTEM,
      `ISSUE:\n${question}\n\nPROMPT 2 OUTPUT — REASONING CARDS AND CONVERGENCE NOTE:\n${deliberationOutput}`,
      1500
    );
    send('verdict', { data: verdictOutput });

    // ── Prompt 4 — Policy Brief ───────────────────────────────────────
    send('progress', { step: 4, message: 'Writing the policy brief...' });
    const briefOutput = await callClaude(
      PROMPT4_SYSTEM,
      `ISSUE:\n${question}\n\nPROMPT 2 OUTPUT — REASONING CARDS AND CONVERGENCE NOTE:\n${deliberationOutput}\n\nPROMPT 3 OUTPUT — VERDICT:\n${verdictOutput}`,
      3000
    );
    send('brief', { data: briefOutput });

    send('complete', { message: 'Session complete' });
  } catch (err) {
    console.error('Pipeline error:', err);
    const isOverloaded = err.message && err.message.includes('529');
    const userMessage = isOverloaded ? 'The AI service is under high demand right now. Please try again in a few minutes.' : (err.message || 'Something went wrong. Please try again.');
    send('error', { message: userMessage });
  }

  res.end();
}
