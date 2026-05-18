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
- Anthropic API: `claude-sonnet-4-20250514` for pipeline prompts 1-4, `claude-haiku-4-5-20251001` for sharpener
- Supabase (Frankfurt) for session storage
- 4-prompt pipeline via SSE: assembly → deliberation → verdict → brief

## Critical sync rules

- **`AVATAR_NAME_EXPANSIONS`** map exists in 3 files: `Procession.jsx`, `archive/[slug].js`, `council.js`. Update all three together when adding members.
- **`ALL_COUNCIL_MEMBERS`** in `pages/api/pipeline.js` must match current 37-member roster.
- **`stripTierSuffix`** handles old ("Framer", "Practitioner") + new ("Leader", "Thinker") + slash variants ("Framer/Practitioner").
- **Bestandsnaam-valkuil:** `pages/archive/[slug].js` en `pages/api/og/vs/[slug].js` eindigen beide op `[slug].js`. Bevestig eerste 5 regels voor elke commit.

## Roster (37 members)

See `PROJECT_INSTRUCTIONS.md` for full list. Brief: 23 leaders + 14 thinkers. Last roster change: April 25, 2026 (Lula, Harari removed; Eleanor Roosevelt, Rosa Luxemburg, Wangari Maathai added).
