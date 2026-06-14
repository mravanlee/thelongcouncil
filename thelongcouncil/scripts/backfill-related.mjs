// One-time / re-runnable backfill for Related Debates. Embeds every session
// that lacks a vector (via Gemini), then ranks and writes sessions.related.
// Idempotent: stored embeddings are reused, so re-runs only embed new debates.
//
// Run from thelongcouncil/:  node scripts/backfill-related.mjs
// Needs .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY) and
// ~/.claude/secrets/gemini.env (GEMINI_API_KEY).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { refreshRelated } from '../lib/related.mjs';

function loadEnv(p) {
  if (!fs.existsSync(p)) return;
  for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
    const t = line.trim();
    if (!t || t.startsWith('#') || !t.includes('=')) continue;
    const [k, ...rest] = t.split('=');
    if (!(k.trim() in process.env)) process.env[k.trim()] = rest.join('=').trim().replace(/^['"]|['"]$/g, '');
  }
}
loadEnv(path.join(process.cwd(), '.env.local'));
loadEnv(path.join(os.homedir(), '.claude', 'secrets', 'gemini.env'));

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
const geminiKey = process.env.GEMINI_API_KEY;
if (!supabaseUrl || !serviceKey || !geminiKey) {
  console.error('Ontbrekende env: NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY / GEMINI_API_KEY');
  process.exit(1);
}

console.error('[related] backfill gestart (embeddt ontbrekende vectoren via Gemini)…');
const t0 = Date.now();
const n = await refreshRelated({ supabaseUrl, serviceKey, geminiKey });
console.error(`[related] klaar: related geschreven naar ${n} sessies in ${Math.round((Date.now() - t0) / 1000)}s.`);
