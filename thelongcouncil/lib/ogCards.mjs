// Durable OG share-cards. Instead of relying on @vercel/og's on-demand render
// + Vercel's volatile edge cache (which evicts, so a pre-warmed card can be cold
// again when a crawler arrives — empty share cards), we render each card ONCE,
// store the PNG in the public Supabase Storage bucket `og-cards`, and point
// og:image at that static file. Static = always fast, never cold, no eviction.
//
// Used by BOTH the pipeline (new sessions) and scripts/backfill-og-cards.mjs
// (existing sessions) so the logic can't drift. The stripTier regex MUST match
// Procession.jsx ShareQuoteLink + archive/[slug].js (one contract).

const HOST = 'https://www.thelongcouncil.com';
const BUCKET = 'og-cards';

const stripTier = (n) =>
  String(n || '').replace(/\s*[—–-]\s*(Practitioner|Framer|Leader|Thinker|Wildcard)\s*$/i, '').trim();

// Filesystem-safe storage key from a member name.
const safeKey = (s) =>
  String(s)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'x';

// Render (canonical + per member) → upload to Storage → write sessions.og_images.
// Map is keyed by the EXACT ?member= value the share buttons use (cleanName),
// plus "__canonical__". Best-effort per card: only successfully-stored cards end
// up in the map, so og:image only ever points at a file that exists.
export async function storeOgCards({ slug, memberNames, supabaseUrl, serviceKey }) {
  if (!slug || !supabaseUrl || !serviceKey) return {};

  // Cache-bust the SOURCE render so we never copy a stale @vercel/og response
  // (its CDN caches 1y; a re-run must re-render with current code). Does not
  // affect the Storage path — that stays deterministic per member.
  const cb = Date.now();
  const targets = [{ key: '__canonical__', src: `${HOST}/api/og/vs/${slug}?cb=${cb}`, path: `${slug}/canonical.png` }];
  for (const n of memberNames || []) {
    const clean = stripTier(n);
    if (clean) {
      targets.push({
        key: clean,
        src: `${HOST}/api/og/vs/${slug}?member=${encodeURIComponent(clean)}&cb=${cb}`,
        path: `${slug}/${safeKey(clean)}.png`,
      });
    }
  }

  const map = {};
  await Promise.all(
    targets.map(async (t) => {
      try {
        const r = await fetch(t.src, { headers: { 'User-Agent': 'TLC-OgStore/1.0' } });
        if (r.status !== 200) return;
        const buf = Buffer.from(await r.arrayBuffer());
        if (!buf.length) return;
        const up = await fetch(`${supabaseUrl}/storage/v1/object/${BUCKET}/${t.path}`, {
          method: 'POST',
          headers: {
            apikey: serviceKey,
            Authorization: `Bearer ${serviceKey}`,
            'Content-Type': 'image/png',
            'x-upsert': 'true',
            'Cache-Control': 'public, max-age=31536000, immutable',
          },
          body: buf,
        });
        if (up.ok) map[t.key] = `${supabaseUrl}/storage/v1/object/public/${BUCKET}/${t.path}`;
      } catch {
        /* best-effort: fall back to the on-demand endpoint for this card */
      }
    }),
  );

  if (Object.keys(map).length) {
    try {
      await fetch(`${supabaseUrl}/rest/v1/sessions?slug=eq.${encodeURIComponent(slug)}`, {
        method: 'PATCH',
        headers: {
          apikey: serviceKey,
          Authorization: `Bearer ${serviceKey}`,
          'Content-Type': 'application/json',
          Prefer: 'return=minimal',
        },
        body: JSON.stringify({ og_images: map }),
      });
    } catch {
      /* best-effort */
    }
  }
  return map;
}
