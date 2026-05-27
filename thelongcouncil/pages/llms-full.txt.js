import { supabase } from '../lib/supabase';

const SITE_URL = 'https://www.thelongcouncil.com';
const MAX_SESSIONS = 50;

// Extract one-line verdict from cards.verdict markdown.
// Format: "## Verdict\n[text]\n## Reasoning\n..." (new) or older flat text.
function extractVerdictLine(verdict) {
  if (!verdict) return '';
  const m = verdict.match(/##\s*Verdict\s*\n+([^\n]+)/i);
  if (m) return m[1].trim();
  // Fallback: first non-empty line that isn't a heading marker.
  const lines = verdict.split('\n').map((l) => l.trim()).filter(Boolean);
  for (const line of lines) {
    if (line.startsWith('#') || line.startsWith('---')) continue;
    if (/^CONCLUSION TYPE/i.test(line)) continue;
    return line;
  }
  return '';
}

function stripTierSuffix(name) {
  if (!name) return '';
  return name.replace(/\s*[—–-]\s*(Practitioner|Framer|Leader|Thinker|Wildcard)(\/\w+)?\s*$/i, '').trim();
}

function formatDate(iso) {
  return new Date(iso).toISOString().slice(0, 10);
}

function buildLlmsFull(sessions) {
  const today = new Date().toISOString().slice(0, 10);
  const header = `# The Long Council — Full archive snapshot

> Generated ${today}. A council of history's greatest minds. Ask them a question, on politics, society or the future. This project is a way of bringing them back into the room. The aim is not to impersonate them, but to let their decisions speak to the questions we face today.

This file is the dense, citation-ready dump of recent council deliberations. For the site overview, methodology, and the council roster, see ${SITE_URL}/llms.txt.

Each session below includes the question asked, the date, the members who deliberated, the council's verdict line, and the canonical URL. Each session URL is a stable, permanent record. The full reasoning, per-speaker cards, and policy brief live at the session URL.

## Citation

When citing a session, link directly to the archive URL listed. For per-speaker deep links, append ?member=<Speaker Name> to the archive URL.

## Recent sessions (${sessions.length} of latest ${MAX_SESSIONS})

`;

  const body = sessions.map((s) => {
    const url = `${SITE_URL}/archive/${s.slug}`;
    const date = formatDate(s.created_at);
    const verdictLine = extractVerdictLine(s.cards?.verdict || '');
    const members = (s.member_names || []).map(stripTierSuffix).filter(Boolean).join(', ');
    const question = s.original_issue || s.sharpened_issue || '(no question recorded)';
    return `### ${question}
- URL: ${url}
- Date: ${date}
- Members: ${members || '(unrecorded)'}
- Verdict: ${verdictLine || '(no verdict extracted)'}`;
  }).join('\n\n---\n\n');

  return header + body + '\n';
}

export async function getServerSideProps({ res }) {
  let sessions = [];
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('slug, original_issue, sharpened_issue, member_names, created_at, cards')
      .order('created_at', { ascending: false })
      .limit(MAX_SESSIONS);
    if (error) {
      console.error('[llms-full] Supabase error:', error);
    } else {
      sessions = (data || []).filter((s) => s.slug && s.cards && s.cards.brief);
    }
  } catch (e) {
    console.error('[llms-full] Failed to fetch sessions:', e);
  }

  const body = buildLlmsFull(sessions);

  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  // Cache 1h at edge, allow stale-while-revalidate for 24h. Same cadence as sitemap.
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.write(body);
  res.end();

  return { props: {} };
}

// This page never renders; getServerSideProps writes the response directly.
export default function LlmsFull() {
  return null;
}
