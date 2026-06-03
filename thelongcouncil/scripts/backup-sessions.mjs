#!/usr/bin/env node
// Daily logical backup of the `sessions` table -> versioned JSON file.
// Read-only on the database: it only SELECTs, never writes to Supabase.
// Reads .env.local (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY).
//
// Output: <backup-dir>/sessions-YYYY-MM-DD.json  (one file per day, kept).
// Default backup-dir: ~/.claude/backups/thelongcouncil/
// Old files beyond --retention days are pruned (default 30).
//
// Run from project root:
//   node scripts/backup-sessions.mjs [--out DIR] [--retention N] [--dry-run]

import { readFileSync, mkdirSync, writeFileSync, readdirSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';

// ── Load .env.local ────────────────────────────────────────────────────
const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = join(__dirname, '..', '.env.local');
const env = {};
try {
  readFileSync(envPath, 'utf-8').split('\n').forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) return;
    const eq = trimmed.indexOf('=');
    if (eq < 0) return;
    env[trimmed.slice(0, eq).trim()] = trimmed.slice(eq + 1).trim();
  });
} catch (e) {
  console.error(`Cannot read ${envPath}: ${e.message}`);
  process.exit(1);
}

const SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_KEY = env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

// ── CLI args ───────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const OUT_DIR = outIdx >= 0
  ? args[outIdx + 1]
  : join(homedir(), '.claude', 'backups', 'thelongcouncil');
const retIdx = args.indexOf('--retention');
const RETENTION_DAYS = retIdx >= 0 ? parseInt(args[retIdx + 1], 10) : 30;
const DRY_RUN = args.includes('--dry-run');

// ── Fetch all rows via the PostgREST data API (paginated). We use plain
// fetch instead of @supabase/supabase-js: the client hangs on Node 26, while
// a direct REST call is fast and dependency-free. ──────────────────────────
async function fetchAllSessions() {
  const PAGE = 1000;
  let offset = 0;
  const all = [];
  for (;;) {
    const url = `${SUPABASE_URL}/rest/v1/sessions?select=*&order=created_at.asc&limit=${PAGE}&offset=${offset}`;
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 30000);
    let data;
    try {
      const res = await fetch(url, {
        headers: { apikey: SERVICE_KEY, Authorization: `Bearer ${SERVICE_KEY}` },
        signal: ctrl.signal,
      });
      if (!res.ok) throw new Error(`REST ${res.status}: ${(await res.text()).slice(0, 200)}`);
      data = await res.json();
    } finally {
      clearTimeout(timer);
    }
    if (!Array.isArray(data) || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    offset += PAGE;
  }
  return all;
}

function pruneOld(dir) {
  const cutoff = Date.now() - RETENTION_DAYS * 24 * 60 * 60 * 1000;
  let removed = 0;
  for (const name of readdirSync(dir)) {
    const m = name.match(/^sessions-(\d{4})-(\d{2})-(\d{2})\.json$/);
    if (!m) continue;
    const fileTime = Date.parse(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
    if (Number.isFinite(fileTime) && fileTime < cutoff) {
      if (!DRY_RUN) rmSync(join(dir, name));
      removed++;
    }
  }
  return removed;
}

async function main() {
  const rows = await fetchAllSessions();
  const now = new Date();
  const stamp = now.toISOString().slice(0, 10); // YYYY-MM-DD
  const payload = {
    backed_up_at: now.toISOString(),
    source: SUPABASE_URL,
    table: 'sessions',
    count: rows.length,
    rows,
  };
  const outFile = join(OUT_DIR, `sessions-${stamp}.json`);

  if (DRY_RUN) {
    console.log(`[dry-run] would write ${rows.length} sessions to ${outFile}`);
    console.log(`[dry-run] would prune backups older than ${RETENTION_DAYS} days`);
    return;
  }

  mkdirSync(OUT_DIR, { recursive: true });
  writeFileSync(outFile, JSON.stringify(payload, null, 2), { mode: 0o600 });
  const removed = pruneOld(OUT_DIR);
  console.log(`[backup-sessions] wrote ${rows.length} sessions -> ${outFile}`);
  if (removed) console.log(`[backup-sessions] pruned ${removed} backup(s) older than ${RETENTION_DAYS} days`);
}

main().catch(err => {
  console.error('[backup-sessions] FAILED:', err.message);
  process.exit(1);
});
