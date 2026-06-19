# The Long Council

37 documented historic leaders and thinkers deliberate on governance, geopolitical and economic policy questions.

**Live:** https://www.thelongcouncil.com
**Code lives in:** `./thelongcouncil/` subfolder (Next.js app)
**Full project spec:** see [`PROJECT_INSTRUCTIONS.md`](./PROJECT_INSTRUCTIONS.md) — keep this in sync when major changes land.

## User workflow

- Non-technical: commits via GitHub web editor ("Edit this file" → paste → commit)
- Deploys automatically via Vercel from `main`
- **Prefers Dutch in chat, English in code/prompts**
- **Always paste full files in chat as code blocks** — not diff snippets. User copies and pastes into web editor. Note "this is a complete file replacement — Cmd+A, paste, commit".
- One change per commit. Verify on live site before next change.
- For UI/design: mockup first, implement after approval.

## Stack

- Next.js on Vercel
- Anthropic API: `claude-sonnet-4-6` for pipeline prompts 1-4 + quote extraction, `claude-haiku-4-5-20251001` for sharpener (was `claude-sonnet-4-20250514`, retired by Anthropic Jun 2026 → caused full pipeline outage; verify model IDs are current if the pipeline fails pre-save)
- Supabase (Frankfurt) for session storage
- 5-step pipeline via SSE: assembly → deliberation → verdict → brief → featured quote extraction
- **Deliberation streams live.** The deliberation call uses `callClaudeStream` (`stream:true`) and forwards text deltas over SSE: `delib-start` then many `delib-delta` `{text}`, so the homepage renders speakers one by one (`StreamingDebate` in `pages/index.js`) while they are written. The closing `deliberation` event still carries the final, validated, post-processed text — the session view (`Procession`) renders from that, unchanged. The three deliberation guards (first-card, challenge-chain, self-reference) run after the stream; if any regenerates, a `delib-reset` tells the client to clear the live view. So streaming is the happy-path live experience; the authoritative result is still the `deliberation` event.
- **Assembly call (prompt 1) uses `maxTokens: 4000`.** `claude-sonnet-4-6` writes long per-member justifications; the previous 2000 cap truncated 5-member assemblies mid-output, dropping the closing sections the `SELECTED MEMBERS` parser anchors on → "The council could not assemble" on verbose questions (outage Jun 16 2026, fixed in 44f92da). The section regex also tolerates truncation (end-of-string boundary). When swapping models, re-check every `maxTokens` cap against the new model's verbosity, not just the model IDs.
- **Assembly prompt enforces SHORT, plain output.** Same model swap (Jun 16, `claude-sonnet-4-20250514` → `claude-sonnet-4-6`) had a second symptom: the new model is much wordier, so with the old "[One sentence]" instructions the CENTRAL TENSION ballooned to ~117 words, pole labels became academic clauses, and Relevance/Will argue ran 50-70 words each — only visible on `/who`, which renders the raw assembly. Prompt 1 now caps these (tension ≤20 plain words, pole labels 2-4 plain words, relevance/will-argue ≤25 each; no parens/semicolons/dashes/jargon). The 11 already-bloated debates (16-19 Jun) were repaired via `cards.panel_summary` (see schema + scripts). Lesson: when a model swap changes verbosity, the *prompt's length guidance* is as load-bearing as the token cap.

## Local dev setup

- `thelongcouncil/.env.local` (gitignored) holds: `NEXT_PUBLIC_SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `ANTHROPIC_API_KEY`, `SUPABASE_ACCESS_TOKEN`.
- `thelongcouncil/scripts/` — one-off scripts. `backfill-featured-quotes.mjs` regenerates `featured_quote` for sessions where it is NULL. Idempotent. Run from `thelongcouncil/`: `node scripts/backfill-featured-quotes.mjs [--limit N] [--dry-run]`.
- `scripts/backfill-related.mjs` — (re)computes "Related Debates" (`sessions.related` + `sessions.embedding`) via Gemini embeddings. Idempotent: reuses stored embeddings, so re-runs only embed new debates. Scoring lives in `lib/related.mjs` (one contract, shared with the pipeline). Needs `GEMINI_API_KEY` (`~/.claude/secrets/gemini.env`). Run: `node scripts/backfill-related.mjs`. New debates are handled automatically by the pipeline; this is only for full rebuilds.
- `scripts/backfill-panel-summary.mjs` — writes `cards.panel_summary` (plain-language rewrite of the assembly's tension + pole labels + per-member stance, read by `/who`). REPAIR-ONLY for the 11 debates generated 16-19 Jun 2026 with the verbose `claude-sonnet-4-6` before the assembly prompt was tightened; new debates are concise at the source and don't need it. Contract lives in `lib/panelSummary.mjs`. Idempotent. Run: `node scripts/backfill-panel-summary.mjs [--since YYYY-MM-DD] [--slug S] [--limit N] [--force] [--dry-run]`.

## Database schema (sessions table)

- `id`, `slug`, `original_issue`, `sharpened_issue`, `cards` (jsonb: assembly/deliberation/verdict/brief/**actions**), `member_names`, `member_types`, `created_at`, `updated_at`
- **`featured_quote`** (text, nullable) — short pull-quote for homepage display, extracted by pipeline step 5
- **`featured_quote_member`** (text, nullable) — name of the member who said the quote
- **`cards.actions`** (array of strings, may be empty `[]`) — 2-3 imperative next-step actions distilled from the deliberation, displayed in the "What to do now" block on the detail page. Generated by `PROMPT_ACTIONS_SYSTEM` after step 3 (verdict). Best-effort: if extraction or validation fails, saved as `[]` and the UI hides the block.
- **`cards.panel_summary`** (object, nullable) — `{ tension, poles:[{label,names}], members:[{name,stance,why}] }`: plain-language rewrite of the assembly framing for the `/who` page. Present ONLY on the 11 debates from 16-19 Jun 2026 (backfilled — see scripts above); `/who` prefers it and falls back to parsing the raw assembly for every other debate. The raw assembly is the more-verbose `claude-sonnet-4-6` output; the assembly prompt now caps tension/pole-label/relevance/will-argue length (see Stack note), so debates after this fix are concise without a panel_summary.
- **`embedding`** (jsonb, nullable) — 768-dim Gemini (`gemini-embedding-001`) vector of the debate (question + verdict + central tension), used to score "Related Debates". Written by `lib/related.mjs`.
- **`related`** (jsonb, nullable) — precomputed "Related Debates" for the detail page: `[{slug, title, blurb}]`. Scoring = mean-centered cosine + structured re-rank + adaptive per-debate relevance floor (`lib/related.mjs`). Computed automatically at the end of the pipeline for each new debate (best-effort, re-ranks the whole corpus so links are bidirectional; needs `GEMINI_API_KEY` env). Full rebuild: `scripts/backfill-related.mjs`. The live site only reads it.

## Critical sync rules

- **`AVATAR_NAME_EXPANSIONS`** and `KNOWN_AVATAR_SLUGS` live in `lib/avatarSlugs.js`. When adding/removing council members, update `KNOWN_AVATAR_SLUGS` to match the new `/public/avatars/*.webp` filenames. `resolveAvatarSlug()` does exact match → expansion lookup → fuzzy last-name match against the known-slugs set. The 4 callers (`Procession.jsx`, `archive/[slug].js`, `council.js`, `archive/index.js`) each compute a naive slug from a member name and pass it through `resolveAvatarSlug()`.
- **Avatar deep-link anchors.** `pages/council.js` renders `id="m-<slug>"` per member; `Procession.jsx` renders `id="speaker-<slug>"` per deliberation card (`slug = resolveAvatarSlug(...)`). Consumers: about-page "Among the voices" avatars → `/council#m-<slug>`; homepage recent-question avatars and the debate-page `VerdictCast` → `/archive/<session>#speaker-<slug>`. If any caller changes how it slugifies names, these cross-page deep links silently break — keep them all on `resolveAvatarSlug`. `Procession` seat has `scroll-margin-top` for breathing room on hash landing.
- **`ALL_COUNCIL_MEMBERS`** in `pages/api/pipeline.js` must match current 37-member roster.
- **`stripTierSuffix`** handles old ("Framer", "Practitioner") + new ("Leader", "Thinker") + slash variants ("Framer/Practitioner").
- **Bestandsnaam-valkuil:** `pages/archive/[slug].js` en `pages/api/og/vs/[slug].js` eindigen beide op `[slug].js`. Bevestig eerste 5 regels voor elke commit.
- **Quote extraction is best-effort**: if the Claude call fails, session still saves with NULL quote. The backfill script can fill these later. Don't break the save path to make quote required.
- **Polling constants** in `pages/index.js`: `FINALIZE_POLL_INTERVAL_MS = 5000`, `FINALIZE_MAX_ATTEMPTS = 60` → total 5 min recovery window. Matches Vercel function max (300s). Keep aligned if changing pipeline timeout.

## Roster (37 members)

See `PROJECT_INSTRUCTIONS.md` for full list. Brief: 23 leaders + 14 thinkers. Last roster change: April 25, 2026 (Lula, Harari removed; Eleanor Roosevelt, Rosa Luxemburg, Wangari Maathai added).
