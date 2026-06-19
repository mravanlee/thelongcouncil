// Related Debates — shared scoring (one contract for the backfill script AND
// the pipeline, like lib/ogCards.mjs). Embeds each debate with Gemini, stores
// the vector in sessions.embedding, then ranks all-pairs (mean-centered cosine
// + small structured re-rank + guardrails) and writes top-K into
// sessions.related ([{slug,title,blurb}]). The live site only reads `related`.

const GEMINI_MODEL = 'gemini-embedding-001';
const EMBED_DIM = 768;
const TOP_K = 6;
const W_COS = 0.78, W_TAGS = 0.14, W_MEMBERS = 0.08;
// Gemini raw cosines are uniformly high (~0.8-0.9 even for unrelated pairs), so
// we discriminate on MEAN-CENTERED cosine. The relevance floor is ADAPTIVE per
// debate (relative to its own best match): isolated topics surface only their
// genuine twin, spread-out topics surface their whole cluster — one global
// threshold can't do both.
const NEAR_DUP_CC = 0.80;   // exclude reworded twins (centered cosine)
const MIN_ABS_COS = 0.10;   // never include a near-zero-semantic match
const REL_FACTOR = 0.55;    // keep candidates with cc >= best_match_cc * this

// ── text helpers ───────────────────────────────────────────────────────────
export function stripTier(n) {
  return String(n || '').replace(/\s*[—–-]\s*(Practitioner|Framer|Leader|Thinker|Wildcard).*$/i, '').trim();
}
function verdictOf(cards) {
  const v = (cards && cards.verdict) || '';
  const m = v.match(/##\s*Verdict\s*\n+([\s\S]*?)(?=\n##|$)/i);
  return (m ? m[1] : v).trim();
}
function assemblyField(cards, label) {
  const a = (cards && cards.assembly) || '';
  const m = a.match(new RegExp(label + ':\\s*([^\\n]+)', 'i'));
  return m ? m[1].trim() : '';
}
function tagsOf(cards) {
  const raw = assemblyField(cards, 'TAXONOMY TAGS');
  return new Set(raw.split(/[,/]/).map((t) => t.trim().toLowerCase()).filter(Boolean));
}
function blurbOf(verdict) {
  let s = (verdict || '').trim().split(/(?<=[.;:])\s/)[0] || '';
  s = s.trim().replace(/[.;:,]+$/, '');
  if (s.length > 100) s = s.slice(0, 100).replace(/\s+\S*$/, '') + '…';
  return s;
}

// A debate's identity for similarity: the question + verdict + the central tension.
export function buildDoc(session) {
  const c = session.cards || {};
  const title = (c.question_en || session.sharpened_issue || session.original_issue || '').trim();
  const verdict = verdictOf(c);
  const tension = assemblyField(c, 'CENTRAL TENSION');
  return [title, verdict, tension].filter(Boolean).join('\n').trim();
}

export function itemFromSession(session) {
  const c = session.cards || {};
  // Display title is the natural question (translated, if foreign-language), NOT the
  // verbose internal sharpened_issue — that reads as an instruction, not a question.
  const title = (c.question_en || session.original_issue || session.sharpened_issue || '').trim();
  return {
    slug: session.slug,
    title,
    blurb: blurbOf(verdictOf(c)),
    tags: tagsOf(c),
    members: new Set((session.member_names || []).map(stripTier).filter(Boolean)),
    emb: Array.isArray(session.embedding) ? session.embedding : null,
  };
}

// ── Gemini embedding ─────────────────────────────────────────────────────────
export async function embedText(text, apiKey) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:embedContent`;
  for (let attempt = 0; attempt < 4; attempt++) {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'x-goog-api-key': apiKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        model: `models/${GEMINI_MODEL}`,
        content: { parts: [{ text: (text || '').slice(0, 8000) }] },
        taskType: 'SEMANTIC_SIMILARITY',
        outputDimensionality: EMBED_DIM,
      }),
    });
    if (r.ok) {
      const d = await r.json();
      return d.embedding.values;
    }
    if (r.status === 429 || r.status >= 500) { await sleep(1500 * (attempt + 1)); continue; }
    throw new Error(`Gemini embed ${r.status}: ${(await r.text()).slice(0, 200)}`);
  }
  throw new Error('Gemini embed: out of retries');
}
const sleep = (ms) => new Promise((res) => setTimeout(res, ms));

// ── vector math ──────────────────────────────────────────────────────────────
function norm(v) {
  let s = 0; for (const x of v) s += x * x;
  const n = Math.sqrt(s) || 1; return v.map((x) => x / n);
}
function dot(a, b) { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; }
function jaccard(a, b) {
  if (!a.size && !b.size) return 0;
  let inter = 0; for (const x of a) if (b.has(x)) inter++;
  return inter / (a.size + b.size - inter);
}

// ── ranking ──────────────────────────────────────────────────────────────────
// items: [{slug,title,blurb,tags:Set,members:Set,emb:number[]}] (emb required)
// returns Map<slug, [{slug,title,blurb}]>
export function rankRelated(items) {
  const D = items.filter((d) => Array.isArray(d.emb) && d.emb.length);
  const n = D.length;
  const raw = D.map((d) => norm(d.emb));                                   // L2-normalized
  const mean = new Array(raw[0].length).fill(0);
  for (const v of raw) for (let i = 0; i < v.length; i++) mean[i] += v[i] / n;
  const cen = raw.map((v) => norm(v.map((x, i) => x - mean[i])));          // mean-center + renormalize

  // member IDF (sharing a rare thinker means more than sharing a common one)
  const df = {};
  for (const d of D) for (const m of d.members) df[m] = (df[m] || 0) + 1;
  const midf = {}; let maxMidf = 1;
  for (const [m, c] of Object.entries(df)) { midf[m] = Math.log((n + 1) / (c + 1)) + 1; if (midf[m] > maxMidf) maxMidf = midf[m]; }
  const memberScore = (a, b) => {
    const shared = [...a].filter((m) => b.has(m)).slice(0, 2);
    if (!shared.length) return 0;
    return Math.min(shared.reduce((s, m) => s + midf[m], 0) / (2 * maxMidf), 1);
  };

  const out = new Map();
  for (let i = 0; i < n; i++) {
    // centered cosine to every non-self, non-near-duplicate debate
    const ccs = [];
    for (let j = 0; j < n; j++) {
      if (i === j) continue;
      const cc = dot(cen[i], cen[j]);
      if (cc > NEAR_DUP_CC) continue;                                      // reworded twin
      ccs.push({ j, cc });
    }
    const topCc = ccs.reduce((m, c) => Math.max(m, c.cc), 0);
    const floorCc = Math.max(MIN_ABS_COS, topCc * REL_FACTOR);             // adaptive per debate
    const kept = ccs
      .filter((c) => c.cc >= floorCc)
      .map(({ j, cc }) => ({ j, score: W_COS * cc + W_TAGS * jaccard(D[i].tags, D[j].tags) + W_MEMBERS * memberScore(D[i].members, D[j].members) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, TOP_K);
    out.set(D[i].slug, kept.map(({ j }) => ({ slug: D[j].slug, title: D[j].title, blurb: D[j].blurb })));
  }
  return out;
}

// ── orchestration (used by backfill AND pipeline) ────────────────────────────
// Fetches all sessions, embeds any that lack a stored vector (incremental:
// a new debate only embeds itself), ranks all, and bulk-writes `related`.
// Best-effort and self-contained. Returns the count written.
export async function refreshRelated({ supabaseUrl, serviceKey, geminiKey }) {
  const sel = 'slug,original_issue,sharpened_issue,member_names,cards,embedding';
  const r = await fetch(`${supabaseUrl}/rest/v1/sessions?select=${sel}&cards=not.is.null&limit=5000`, {
    headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}` },
  });
  const sessions = await r.json();

  // embed anything missing a vector, persist it
  for (const s of sessions) {
    if (Array.isArray(s.embedding) && s.embedding.length) continue;
    const doc = buildDoc(s);
    if (!doc) continue;
    s.embedding = await embedText(doc, geminiKey);
    await fetch(`${supabaseUrl}/rest/v1/sessions?slug=eq.${encodeURIComponent(s.slug)}`, {
      method: 'PATCH',
      headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
      body: JSON.stringify({ embedding: s.embedding }),
    });
  }

  const ranked = [...rankRelated(sessions.map(itemFromSession))];

  // Write concurrently in small batches so this stays ~1-2s even from the
  // pipeline. PATCH-by-slug is a plain update (no unique-constraint needed).
  let written = 0;
  const BATCH = 25;
  for (let k = 0; k < ranked.length; k += BATCH) {
    const results = await Promise.all(ranked.slice(k, k + BATCH).map(([slug, related]) =>
      fetch(`${supabaseUrl}/rest/v1/sessions?slug=eq.${encodeURIComponent(slug)}`, {
        method: 'PATCH',
        headers: { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json', Prefer: 'return=minimal' },
        body: JSON.stringify({ related }),
      }).then((res) => res.ok).catch(() => false)));
    written += results.filter(Boolean).length;
  }
  return written;
}
