# The Long Council — Project Instructions
Last updated: June 5, 2026

==============================================================
PRODUCT
==============================================================

The Long Council — www.thelongcouncil.com — assembles 37
documented historic leaders and thinkers to deliberate on real
governance, geopolitical and economic policy questions.
Next.js app on Vercel, claude-sonnet-4-20250514 for all
deliberation prompts, claude-haiku-4-5 for the sharpener.

Primary domain: www.thelongcouncil.com
Redirects (308):
  - thelongcouncil.com
  - thelongcouncil.org
  - www.thelongcouncil.org
  - thelongcouncil.vercel.app

Repo: github.com/mravanlee/thelongcouncil
(code in subfolder thelongcouncil/)

==============================================================
CORE VALUE — THE BEST ANSWER, NOT A BALANCED SHOW
==============================================================

The council's job is the BEST answer to the question, not a
balanced display of opinions. Two distinct jobs that must
never be confused:

1. INPUT — a balanced, fair fight. Every serious position gets
   its STRONGEST defender at the table, so criticism lands on a
   real argument, never a strawman. Selection is balanced on
   the central tension (the poles of the question, not
   demographics). But a seat is not an endorsement: representing
   a position is not the same as validating it. When a pole
   needs reinforcement, add a voice that brings a DISTINCT
   argument (and ideally a different register), not an echo of
   one already at the table.

2. OUTPUT — an evidence-weighted verdict. The verdict follows
   the weight of argument and the empirical track record, NEVER
   a vote count. A balanced panel does NOT mandate a centrist
   "both sides have a point" draw. A fair fight may have a
   clear winner.

Weigh the track record:
   - CLEAR record (e.g. command-economy central planning's
     failures): decisive evidence; the verdict weighs it and
     may lean.
   - CONTESTED record (mixed or disputed outcomes, e.g. the
     long-run results of the Nordic model): hedge and weigh
     both sides rather than asserting a disputed claim as
     settled.

Two failure modes, avoid in equal measure:
   - BOTHSIDESISM / false parity — treating a demonstrably
     weaker position as an equal contender just because it was
     represented.
   - STRAWMANNING — excluding or weakening a position so the
     win is hollow. (This is why we still seat its strongest
     defender.)

Frame the central tension at the LIVE level — where reasonable
disagreement genuinely exists today — not by resurrecting a
largely settled extreme as a co-equal pole. For "how should
wealth be distributed", the live tension is market vs.
mixed/redistributive, not capitalism vs. revolutionary
socialism.

The value the council adds: confront the strongest case for
every serious position, then judge honestly by argument and
evidence — so the verdict is trustworthy, not diplomatic.

==============================================================
COUNCIL ROSTER (37 members)
==============================================================

Full list of council members and their avatar filenames:

 1. Albert Hirschman          - avatar_albert_hirschman.webp
 2. Ali ibn Abi Talib         - avatar_ali_ibn_abi_talib.webp
 3. Amartya Sen               - avatar_amartya_sen.webp
 4. Confucius                 - avatar_confucius.webp
 5. David Ben-Gurion          - avatar_david_ben_gurion.webp
 6. Deng Xiaoping             - avatar_deng_xiaoping.webp
 7. Eleanor Roosevelt         - avatar_eleanor_roosevelt.webp
 8. Elinor Ostrom             - avatar_elinor_ostrom.webp
 9. Ellen Johnson Sirleaf     - avatar_ellen_johnson_sirleaf.webp
10. Franklin D. Roosevelt     - avatar_franklin_d_roosevelt.webp
11. Frantz Fanon              - avatar_frantz_fanon.webp
12. Friedrich Hayek           - avatar_friedrich_hayek.webp
13. Hannah Arendt             - avatar_hannah_arendt.webp
14. Helmut Schmidt            - avatar_helmut_schmidt.webp
15. Ibn Khaldun               - avatar_ibn_khaldun.webp
16. Indira Gandhi             - avatar_indira_gandhi.webp
17. Jawaharlal Nehru          - avatar_jawaharlal_nehru.webp
18. Jean-Jacques Rousseau     - avatar_jean_jacques_rousseau.webp
19. John Locke                - avatar_john_locke.webp
20. John Maynard Keynes       - avatar_john_maynard_keynes.webp
21. John Rawls                - avatar_john_rawls.webp
22. Julius Nyerere            - avatar_julius_nyerere.webp
23. Kautilya                  - avatar_kautilya.webp
24. Konrad Adenauer           - avatar_konrad_adenauer.webp
25. Lee Kuan Yew              - avatar_lee_kuan_yew.webp
26. Mahathir Mohamad          - avatar_mahathir_mohamad.webp
27. Margaret Thatcher         - avatar_margaret_thatcher.webp
28. Milton Friedman           - avatar_milton_friedman.webp
29. Mustafa Kemal Atatürk     - avatar_mustafa_kemal_ataturk.webp
30. Nelson Mandela            - avatar_nelson_mandela.webp
31. Niccolò Machiavelli       - avatar_niccolo_machiavelli.webp
32. Olof Palme                - avatar_olof_palme.webp
33. Raúl Prebisch             - avatar_raul_prebisch.webp
34. Rosa Luxemburg            - avatar_rosa_luxemburg.webp
35. Simón Bolívar             - avatar_simon_bolivar.webp
36. Sun Tzu                   - avatar_sun_tzu.webp
37. Wangari Maathai           - avatar_wangari_maathai.webp

Removed (April 25, 2026): Lula da Silva, Yuval Noah Harari
Added (April 25, 2026): Eleanor Roosevelt, Rosa Luxemburg,
                        Wangari Maathai

==============================================================
USER CONTEXT
==============================================================

- Non-technical: works via GitHub web editor, commits via
  "Edit this file" -> paste -> commit
- Deploys via Vercel auto-deploy from main branch
- Prefers Dutch responses, English code/prompts
- Wants full files pasted, not diff snippets
- Values content quality over animation polish
- Works methodically: one change per commit, verify on live
  site, then next
- Claude artifacts often fail to preview (Next.js syntax,
  cross-file imports). Use code blocks in chat as fallback —
  user can copy from there directly.

==============================================================
ARCHITECTURE
==============================================================

thelongcouncil/
  components/
    Procession.jsx       Vertical rail with portrait avatars.
                         Supports instant={true} prop which
                         skips animation and renders all seats
                         in 'past' state immediately.
                         Supports sessionSlug prop which
                         enables per-member share icons.
                         Supports scrollReveal={true} prop
                         (May 11): each Seat fades in via
                         IntersectionObserver as user scrolls.
                         Used on archive/[slug].js. NOT used
                         on homepage live procession.
                         Scroll timing: 0.85s ease-out.
                         Section markers: "Leaders" / "Thinkers"
                         Contains AVATAR_NAME_EXPANSIONS map
                         and nameToAvatarSlug() function.
                         allLeaders + allThinkers variables for
                         correct section header logic.
  pages/
    index.js             Landing + sharpener UI + session
                         + recent sessions section + live
                         session counter (Supabase count).
                         ShareButton on live session view
                         after SSE complete (May 7).
                         (Jun 10-11) Hero rebuilt: left-aligned
                         3-line italic dek ("History's leaders
                         and thinkers, / debating questions we
                         face today. / Read their verdicts"),
                         eyebrow "The most recent question",
                         question (heroTitleSize) + verdict
                         28px desktop, equal line-height 1.3.
                         Trust explainer block below verdict
                         (Grounded in documented history /
                         Structured disagreement / Public
                         archive). Featured column narrowed to
                         max-w-4xl. Page wrapped in min-h-screen
                         bg-background (was cooler body colour).
                         (Jun 11) recentSessions lifted to client
                         state; on pipeline completion the new
                         session is PREPENDED (teaser via
                         extractTeaser(verdict)) so it shows as
                         "most recent" without a refetch. reset()
                         + completion strip the #ask hash via
                         history.replaceState so the URL returns
                         to a clean "/". Fixes: new session not
                         appearing until a full nav, and the logo
                         appearing to "do nothing" on the homepage.
    council.js           Council members overview (37).
                         Full rebuild May 8: 88px portrait,
                         bordeauxrood top border, 3 positions,
                         core belief, session counter.
                         May 9: bio truncation removed,
                         hover effect added, AVATAR_NAME_
                         EXPANSIONS added, tier label fix in
                         getServerSideProps debateCounts.
                         (Jun 11) "How the council works"
                         explainer section added ABOVE the
                         roster: eyebrow label + 6 numbered
                         steps (no icons/cards). Intro +
                         roster grid unchanged.
    about.js             Rewritten April 30.
                         (Jun 11) Copy strengthened: lead opens
                         with the core question + "The
                         technologies are new. Many of the
                         dilemmas are not." (cliche removed),
                         "Among the voices" intro line, "How it
                         works" = 5 numbered steps, new
                         "Grounded in the record" + "Why this
                         exists" sections. Founder unchanged.
    archive/
      index.js           Archive list page.
                         extractTeaser uses .replace(/\s+/g, ' ')
                         (Jun 11) Header copy: label THE ARCHIVE,
                         H1 "The questions. The debates. The
                         verdicts." (each phrase whitespace-
                         nowrap → breaks only at the periods;
                         32px mobile / text-5xl desktop), intro
                         "Explore every session of The Long
                         Council." Filters/search/cards unchanged.
      [slug].js          Archive detail page.
                         Debate section open by default (May 11)
                         — no CollapsibleSection wrapper.
                         Procession with instant={true} AND
                         scrollReveal={true} AND sessionSlug.
                         "The debate" label above procession.
                         Policy brief + assembly still behind
                         CollapsibleSection.
                         Contains AVATAR_NAME_EXPANSIONS map
                         and nameToAvatarSlug().
                         stripTierSuffix handles slash variants.
                         (Jun 11) Page wrapped in min-h-screen
                         bg-background (was falling back to the
                         cooler body colour, looked "whiter").
    api/
      sharpen.js         Prompt 0 — question sharpener.
                         May 11: compression for long questions.
                         Questions >20 words OR with multiple
                         sub-questions are compressed to ≤15
                         words. Short questions pass unchanged.
                         UI in index.js already handles
                         wasSharpened display (existing logic).
      pipeline.js        Prompts 1-4: assembly, deliberation,
                         verdict, brief + Supabase save.
                         Temperature: P2+P3 at 0.7, P1+P4 at 1.0.
                         P2 max_tokens: 2500.
                         P2 user message has FINAL REMINDER
                         on length at the end.
                         validateSelectedMembers() prevents
                         ghost sessions.
                         extractMemberMetadata strips tier
                         suffix before Supabase storage.
                         stripTierSuffix handles slash variants.
                         ALL_COUNCIL_MEMBERS updated for
                         current 37-member roster.
      og/vs/[slug].js    VS card OG image endpoint, edge runtime.
  lib/
    supabase.js          Client + service client + slug gen
    cardParser.js        Pure helpers: FRAMER_NAMES, getTier,
                         getInitials, slugify, parseCard,
                         renderInline.
                         FRAMER_NAMES expanded with short names
                         (Machiavelli, Keynes etc) and Rosa
                         Luxemburg.
  styles/
    globals.css
  public/
    favicon.ico
    apple-touch-icon.png
    og-default.png
    robots.txt
    avatars/             37 portrait WebPs
  data/
    profiles/            37 .md files

==============================================================
PIPELINE FLOW
==============================================================

1. User submits question -> sharpener (Prompt 0):
   - Short questions (≤20 words, single decision): READY unchanged
   - Long questions (>20 words or multiple sub-questions):
     compressed to ≤15 words, shown to user with "You asked: X"
   - Too vague: CLARIFY with one question, max one round
2. User confirms -> pipeline.js runs 4 prompts via SSE:
   - Prompt 1 (assembly): selects 3-6 council members [temp 1.0]
   - Prompt 2 (deliberation): reasoning cards [temp 0.7]
   - Prompt 3 (verdict): synthesizes conclusion [temp 0.7]
   - Prompt 4 (brief): policy brief [temp 1.0]
3. After Prompt 1: validateSelectedMembers() checks that at
   least 2 real council members were selected. If not: orphan
   session deleted, error sent to user, pipeline aborts.
4. Session saved to Supabase, slug returned via SSE complete

==============================================================
DATABASE — SUPABASE
==============================================================

Project: TheLongCouncil (Frankfurt region)

Table: sessions
- id (uuid)
- slug (text unique)
- original_issue
- sharpened_issue
- cards (jsonb: {assembly, deliberation, verdict, brief})
- member_names (text[])  — clean names, NO tier suffix
                           (new sessions). Old sessions may
                           still have suffix in data.
- member_types (text[])  — "leader" / "thinker" / "wildcard"
                           / "unknown". Old sessions: "framer"
                           / "practitioner" (pre-May 8).
- taxonomy_tags (text[])
- created_at
- user_id (nullable)

stripTierSuffix in archive/[slug].js handles both old
("Framer", "Practitioner") and new ("Leader", "Thinker") and
slash variants ("Framer/Practitioner") for backwards compat.

Environment vars (Production + Preview):
- NEXT_PUBLIC_SUPABASE_URL
- NEXT_PUBLIC_SUPABASE_ANON_KEY
- SUPABASE_SERVICE_ROLE_KEY

==============================================================
AVATAR NAME EXPANSIONS
==============================================================

Three files contain AVATAR_NAME_EXPANSIONS map (must stay
in sync if updated):
- components/Procession.jsx
- pages/archive/[slug].js
- pages/council.js

Map:
  'machiavelli'  → 'niccolo_machiavelli'
  'keynes'       → 'john_maynard_keynes'
  'hayek'        → 'friedrich_hayek'
  'friedman'     → 'milton_friedman'
  'locke'        → 'john_locke'
  'rousseau'     → 'jean_jacques_rousseau'
  'rawls'        → 'john_rawls'
  'arendt'       → 'hannah_arendt'
  'sen'          → 'amartya_sen'
  'hirschman'    → 'albert_hirschman'
  'fanon'        → 'frantz_fanon'
  'prebisch'     → 'raul_prebisch'
  'ostrom'       → 'elinor_ostrom'
  'bolivar'      → 'simon_bolivar'

==============================================================
SHARE FUNNEL — STATE OF PLAY (END OF MAY 11)
==============================================================

All share entry points live and validated.

| Surface              | OG image                              |
|----------------------|---------------------------------------|
| Homepage /           | /og-default.png                       |
| Council /council     | /og-default.png                       |
| About /about         | /og-default.png                       |
| Archive list /archive| /og-default.png                       |
| Archive /{slug}      | /api/og/vs/{slug} (default member[0]) |
| Archive /{slug}?     | /api/og/vs/{slug}?member={x}          |
|   member={x}         | (member-specific VS card)             |

Share entry-points live:
- Live session ShareButton (index.js, after SSE complete)
- Sessie-niveau ShareButton op archive/[slug]
- Per-member ShareIcon in elke deliberation card (archive only)

==============================================================
KEY FIXES APPLIED (CUMULATIVE)
==============================================================

May 11 changes:

Scroll-reveal on archive page:
- Procession.jsx: scrollReveal prop added. When true, each
  Seat starts invisible (opacity 0, translateY 16px) and
  fades in (0.85s ease-out) when scrolled into view via
  IntersectionObserver. Observer disconnects after trigger
  (one-shot, no flicker).
- archive/[slug].js: "The debate" CollapsibleSection replaced
  with open section. Procession gets scrollReveal={true}.
  Policy brief and assembly still behind CollapsibleSection.

Prompt 2 improvements (pipeline.js):
- RHYTHM rule (Rule 5) added: never more than 2 consecutive
  sentences of similar length. Short punch after long setup.
  Pattern: SHORT. SHORT. MEDIUM. or MEDIUM. SHORT. MEDIUM.
- PARAGRAPH BODY WRONG/RIGHT examples added under rule 7b:
  explicit before/after showing position-first + rhythm vs
  hedging open + academic monotone.
- GOOD EXAMPLE updated: Adenauer reference removed (was a
  roster violation in the example itself). Example now has
  no external council member reference.
- BAD EXAMPLE added alongside GOOD EXAMPLE: same content,
  no rhythm, reads like an essay.
- RHYTHM CHECK added as Quality Check 8.

Question sharpener (sharpen.js):
- PATH 1 READY now has compression rules:
  ≤20 words + single decision → copy unchanged
  >20 words OR multiple sub-questions → compress to ≤15 words
- Compression keeps core decision and subject, drops context
  and rhetorical framing.
- UI was already ready in index.js (wasSharpened logic).
  "THE COUNCIL WILL START THE DEBATE" label + "You asked: X"
  already rendered correctly.
- Validated: fashion question compressed correctly,
  Trump question compressed correctly, short questions
  pass through unchanged.

May 9 fixes (unchanged):
- Ghost session prevention (validateSelectedMembers)
- Debate teaser blob fix (extractTeaser)
- Avatar expansions (AVATAR_NAME_EXPANSIONS in 3 files)
- Leaders/Thinkers section split (cardParser FRAMER_NAMES)
- Tier suffix stripped before Supabase storage
- Slash-variant suffix handling
- Prompt 2 framing line standalone rule
- Prompt 2 token budget (2500)
- Prompt 3 answers the question as asked
- Council page: full bios, hover effect

==============================================================
PROMPT QUALITY — STATE OF PLAY (END OF MAY 11)
==============================================================

Observed in test sessions today:

WORKING WELL:
- Speaking order correct (leaders before thinkers)
- Historical anchors present in all cards
- Framing lines mostly standalone
- Verdicts answer the question directly
- Machiavelli card quality strong

STILL OCCURRING:
- FDR framing line lekkage: near-verbatim copy of RIGHT
  example in prompt. Example must be replaced.
- "framework" still appears occasionally (Arendt, Mandela)
- "the deeper point" still appears (Mandela)
- Theorists (Confucius) still produce flat rhythm despite
  RHYTHM rule — BAD EXAMPLE in prompt uses a modern leader
  (LKY), not a theorist. A theorist BAD EXAMPLE needed.
- Occasional 3-paragraph cards (Atatürk)
- Em-dash in framing line (Confucius)

DECISION: not fixing these today. Monitor next sessions.
If pattern persists: replace FDR example first (lekkage),
then add theorist BAD EXAMPLE for rhythm.

ALTERNATIVE APPROACH ON HOLD:
- Few-shot voorbeelden als aparte input (optie 1): added
  to TODO. Would add 2 complete example cards to user
  message in callClaude for Prompt 2. One modern leader,
  one ancient thinker, neutral subject (not ethics/leadership).
- Revisie-stap (optie 2): also on TODO. +15-20s latency.
- Temperature already at 0.7 (adjusted May 9/10).

==============================================================
DESIGN
==============================================================

- Tagline: "History's counsel on today's questions"
- Typography: Playfair Display (serif) + Inter (sans-serif)
- Color palette:
  - Page surface = token --background (class bg-background):
    oklch(0.972 0.012 85), warm cream. THIS is the real page
    background. Body fallback is #f8f6f2 (cooler/greyer) — every
    page MUST wrap its content in <div className="min-h-screen
    bg-background text-foreground antialiased"> or it shows the
    colder body colour. Exception: brief/[slug].js is a
    deliberate white document. (Jun 10-11: homepage and
    archive/[slug] were missing the wrapper — fixed.)
  - Bordeauxrood: #6b1a1a
  - Verdict block surface: #f0ede3
  - Textarea surface: #f3eeea
  - Cast avatar background: #f3eeea
  - Card hover background: #f5f1e8 (council page)
- Reading width: 62ch max-width on body
- .session container: 680px, .landing: 720px
- Section markers: "Leaders" / "Thinkers"

Procession type (current, unchanged from May 9):
- Name: Playfair Display 16px/600 (desktop: 17px)
- Framing line: Playfair Display 19px/600 (desktop: 20px)
  NOTE: This was proposed May 11 but NOT committed —
  user confirmed mobile was fine as-is. Current live values
  are 17.5px/500 (mobile) and 18px/500 (desktop).
- Body: Inter 14.5px (desktop: 15px), color #1a1a1a

Archive page hierarchy (May 11):
  Back link → meta (date · members) → H1 → cast row →
  verdict block → ShareButton → "THE DEBATE" label →
  Procession (scroll-reveal) → convergence note →
  policy brief (collapsible) → assembly (collapsible)

==============================================================
MODELS
==============================================================

- Prompts 1-4: claude-sonnet-4-20250514
- Sharpener: claude-haiku-4-5-20251001

Temperature settings:
- PROMPT1 (assembly): 1.0 / max_tokens: 2000
- PROMPT2 (deliberation): 0.7 / max_tokens: 2500
- PROMPT3 (verdict): 0.7 / max_tokens: 1500
- PROMPT4 (brief): 1.0 / max_tokens: 3000
- Sharpener: default / max_tokens: 500

==============================================================
OPEN WORK
==============================================================

NEXT UP (in priority order):

1. PROMPT 2 — FDR EXAMPLE LEKKAGE
   FDR framing line is near-verbatim copy of the RIGHT
   example in PROMPT2_SYSTEM. Replace the example with
   a sentence on a completely different topic. Monitor
   next 2-3 sessions before fixing — confirm it recurs.

2. PROMPT 2 — THEORIST RHYTHM EXAMPLE
   BAD EXAMPLE currently uses LKY (modern leader). Theorists
   (Confucius, Machiavelli) still produce flat rhythm.
   Add a BAD EXAMPLE specifically for a theorist/ancient
   thinker — same structure issue, different voice.
   Do after item 1 is confirmed and fixed.

3. PROMPT 2 — FEW-SHOT VOORBEELDEN (OPTION 1)
   Add 2 complete example cards to the user message in
   callClaude for Prompt 2. One modern leader + one ancient
   thinker. Subject must be neutral (not ethics/leadership/
   governance — too close to common questions, causes
   content leakage). Climate, urban planning, or trade.
   This may resolve rhythm + forbidden words more reliably
   than additional rules.

4. VERDICT → POLICY VERKENNEN
   Handmatig testen met één bestaande sessie.
   Beslissing: extra Prompt 5 of aparte feature.

5. TOKEN BUDGET MONITORING
   P2 max_tokens = 2500. Krap bij 6-leden sessies.
   Als convergence note wordt afgekapt: verhoog naar 3000.
   One-line change in pipeline.js callClaude for P2.

STILL OPEN (LOW PRIORITY):
- 3 levende leden profielen (Mahathir, Sirleaf, Sen)
- Bing Webmaster Tools
- WhatsApp image rendering (parked)
- Wildcard avatar (joker silhouette)
- Member dossier pages /council/[slug]
- PDF export
- Featured session op homepage

PARKED:
- Verdict cards visualisatie
- Masthead redesign
- Session threading
- JSON-LD schema markup
- VS card preview op site zelf

==============================================================
METHODOLOGY RULES
==============================================================

1. One change per commit — never stack multiple unrelated fixes
2. Verify on live site before next change
3. For sharpener / pipeline changes, test with both a clearly-
   specific question and a vague one
4. If introducing contract changes between frontend/backend,
   do in one commit across both files (or two consecutive
   commits if web editor doesn't support multi-file)
5. Use the debug SSE event whenever diagnosing pipeline issues
6. For design work: make a mockup before code
7. For DNS / infrastructure work: always screenshot current
   state before changing.
8. For visual design choices that aren't converging via chat
   iteration, recommend external design tools.
9. When Claude artifacts fail to preview (common for Next.js
   files), paste code directly in chat as code blocks.
10. For full-file replacements, always note "this is a
    complete file replacement — Cmd+A, paste, commit".
11. For JSX elements with multiple attributes, single-line
    is more robust than multi-line when pasting into GitHub
    web editor.
12. Apple-touch-icons should NOT have rounded corners.
13. Browser tab favicons need solid-fill design.
14. For mockup HTMLs: embed images as base64 in the HTML.
15. Critical CSS definitions go in globals.css, not in
    <style jsx global> within components.
16. For whitespace normalisation: use /\s+/g not /\s*\n\s*/g.
17. Visuele bugs altijd op meerdere viewportbreedtes valideren.
18. High-DPI screenshots maken pixel-correcte tekst groot
    lijken. Bij twijfel: DevTools Computed pane checken.
19. For Chrome console paste blocking: type "allow pasting".
20. WhatsApp caches link previews aggressively. Use ?v=N.
21. Voor vaste-hoogte UI elementen: gebruik height: 56px
    expliciet ipv min-height + padding mix.
22. Bij eyebrow/branding tekst: vraag "wat moet iemand in
    2 seconden begrijpen om te besluiten of ze klikken".
23. Project knowledge raadplegen voor feiten over het project.
24. Bij meerstap plannen: expliciet tracken welke stap gedaan.
25. BIJZONDER OPLETTEN MET BESTANDSNAMEN — pages/archive/
    [slug].js en pages/api/og/vs/[slug].js eindigen beide
    op [slug].js. Bevestig eerste 5 regels voor elke commit.
26. VS-card visuele bugs zijn alleen zichtbaar bij de
    SPECIFIEKE input. Test altijd met meerdere leden.
27. Edge cache busting: Vercel @vercel/og per-URL met ?bust=N.
28. Voor JSX styling-only wijzigingen: één bucket-tweak commit.
29. Prompt-instructies zijn de bron van lekkage. Als een woord
    vaak in output verschijnt: check of het in de prompt staat.
30. AVATAR_NAME_EXPANSIONS map staat in 3 bestanden:
    Procession.jsx, archive/[slug].js, council.js. Bij
    toevoegen van nieuwe lid: alle drie updaten.
31. member_names in Supabase zijn nu clean (geen tier suffix)
    voor nieuwe sessies. Oude sessies hebben nog suffix —
    stripTierSuffix in frontend handelt dit.
32. P2 max_tokens is 2500. Als kaarten worden afgekapt bij
    6-leden sessies: verhoog naar 3000. Monitoring nodig.
33. Prompt 3 antwoordt nu de vraag als gesteld. Bij "How
    should X" moet verdict een richting geven.
34. (May 11) scrollReveal prop in Procession gebruikt
    IntersectionObserver per Seat. Timing: 0.85s. Alleen
    actief als scrollReveal={true} — homepage live procession
    is onaangetast.
35. (May 11) Sharpener comprimeert alleen bij >20 woorden
    of meerdere deelvragen. Korte vragen ongewijzigd. UI
    toont "You asked: X" bij compressie (bestaande logica).
36. (May 11) Prompt 2 uitbreiden met regels werkt beperkt
    bij 800+ regels. Overwegen: few-shot voorbeelden in
    user message als alternatief voor meer instructies.
37. (May 11) Bij prompt voorbeeld lekkage: vervang het
    voorbeeld, schoon de prompt zelf op. Niet alleen de
    output-regels aanscherpen.
38. (Jun 10) Elke pagina moet z'n inhoud wikkelen in
    <div className="min-h-screen bg-background text-foreground
    antialiased">. Zonder die wrapper valt 'ie terug op de
    koudere body-kleur (#f8f6f2) i.p.v. de warme --background
    token. Uitzondering: brief/[slug].js (bewust wit document).
39. (Jun 10 → GEFIXT Jun 11, commit a3ca061) Tailwind v4: de
    UNLAYERED `a { color:inherit; text-decoration:none }` in
    globals.css won van utility-classes, dus text-primary op
    links rendde donker. Opgelost door de reset in `@layer base`
    te zetten — utilities winnen nu. `text-primary` etc. werkt
    voortaan gewoon op <Link>; geen inline-style meer nodig.
40. (Jun 11) Koppen met meerdere zinnen (bv. "X. Y. Z."): zet
    elke zin in een whitespace-nowrap span zodat afbreken
    alleen op de punten gebeurt — schoon op 375/430/desktop.
    Eyebrow-labels op één pagina dezelfde kleur geven (oxbloed).
