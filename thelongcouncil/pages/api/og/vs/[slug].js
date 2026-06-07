import { ImageResponse } from '@vercel/og';
import { resolveAvatarSlug, KNOWN_AVATAR_SLUGS } from '../../../../lib/avatarSlugs';

export const config = {
  runtime: 'edge',
};

// Self-hosted Playfair Display (TTF, latin + latin-ext) served from /public/fonts.
// NB: @vercel/og's satori only parses TTF/OTF — NOT woff2 (it throws "Unsupported
// OpenType signature wOF2"). Keep these as .ttf.
// We deliberately do NOT fetch from Google Fonts at render time: that cross-origin
// CSS+font round-trip made a cold render ~2.5s, which exceeds social-crawler timeouts
// (Twitterbot etc.) on whatever Vercel region the crawler hits — so the card was cached
// broken. Static assets from our own origin are on Vercel's global edge CDN, so even a
// cold render fetches them in tens of ms. latin + latin-ext cover English + accented
// member names (e.g. Atatürk); satori falls back per-glyph across the registered fonts.
const FONT_FILES = [
  { file: 'playfair-500.ttf', weight: 500, style: 'normal' },
  { file: 'playfair-500-ext.ttf', weight: 500, style: 'normal' },
  { file: 'playfair-600.ttf', weight: 600, style: 'normal' },
  { file: 'playfair-600-ext.ttf', weight: 600, style: 'normal' },
  { file: 'playfair-italic-500.ttf', weight: 500, style: 'italic' },
  { file: 'playfair-italic-500-ext.ttf', weight: 500, style: 'italic' },
];

// Load one self-hosted font file. A hiccup must never break the card: on any
// failure we return null and that weight renders with the default font.
async function loadFont(baseUrl, file) {
  try {
    const res = await fetch(`${baseUrl}/fonts/${file}`);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

function getNameFontSize(name) {
  const len = name.length;
  if (len <= 10) return 56;
  if (len <= 13) return 50;
  if (len <= 16) return 44;
  if (len <= 19) return 38;
  return 32;
}

function getQuoteFontSize(text) {
  const len = text.length;
  if (len <= 105) return 46;
  if (len <= 145) return 38;
  if (len <= 185) return 32;
  if (len <= 235) return 26;
  return 22;
}

function normaliseName(name) {
  return (name || '')
    .replace(/\s*[—–-]\s*(Practitioner|Framer|Wildcard)\s*$/i, '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]/g, '');
}

// Resolve a member name to a known avatar slug (naive slug → resolver).
function avatarSlugFor(name) {
  const naive = (name || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return resolveAvatarSlug(naive);
}

// ─── Editorial cream palette (matches site design tokens) ──────────────
const PAPER = '#f3eeea';
const PAPER_SOFT = '#ede4d3';
const INK = '#1a1a1a';
const INK_SOFT = '#5a4a3d';
const OXBLOOD = '#6b1a1a';
const RULE = 'rgba(31,24,18,0.14)';
const QUOTEMARK = 'rgba(107,26,26,0.20)';

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const slug = url.pathname.split('/').pop();
    if (!slug) return new Response('Missing slug', { status: 400 });

    const memberQuery = url.searchParams.get('member');

    const host = req.headers.get('host');
    const protocol = host && host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const [sessionRes, fontData] = await Promise.all([
      fetch(`${baseUrl}/api/session/${slug}`),
      Promise.all(FONT_FILES.map((f) => loadFont(baseUrl, f.file))),
    ]);

    if (!sessionRes.ok) return new Response('Session not found', { status: 404 });
    const session = await sessionRes.json();

    if (!session.members || session.members.length === 0) {
      return new Response('No speakers found', { status: 400 });
    }

    // Pick the member to feature. A per-member share (?member=) ALWAYS shows that
    // exact member — never a substitute, because showing someone else's face or
    // quote would be misinformation. A wildcard/off-roster member has no avatar and
    // gets a neutral default-profile placeholder (below), with their OWN name+quote.
    // The canonical card (no ?member) features the first member that has a portrait.
    const hasAvatar = (m) => KNOWN_AVATAR_SLUGS.has(avatarSlugFor(m && m.name));
    let member;
    if (memberQuery) {
      const target = normaliseName(memberQuery);
      member = session.members.find((m) => normaliseName(m.name) === target)
        || session.members.find(hasAvatar)
        || session.members[0];
    } else {
      member = session.members.find(hasAvatar) || session.members[0];
    }

    const rawQuestion = session.question || session.sharpenedQuestion || '';
    const question = rawQuestion.length > 55
      ? rawQuestion.slice(0, 55).replace(/\s+\S*$/, '') + '…'
      : rawQuestion;
    const quoteText = member.quote || '';
    const speakerName = member.name || '';
    const nameFontSize = Math.round(getNameFontSize(speakerName) * 0.7);
    const quoteFontSize = Math.round(getQuoteFontSize(quoteText) * 0.7);

    // Real portrait when the member has one; null (→ default-profile placeholder
    // in the card) for wildcard / off-roster members without an avatar.
    const memberSlug = avatarSlugFor(speakerName);
    const portrait = KNOWN_AVATAR_SLUGS.has(memberSlug)
      ? `${baseUrl}/avatars/avatar_${memberSlug}.png`
      : null;

    return new ImageResponse(
      (
        // Native 840×441 design (0.7× of the original 1200×630) so the PNG lands
        // ~250–330KB — a safe margin under WhatsApp's ~600KB share-card limit.
        <div style={{ width: '840px', height: '441px', background: PAPER, display: 'flex' }}>
          {/* LEFT — portrait + name strip */}
          <div style={{ width: '353px', height: '441px', position: 'relative', display: 'flex', overflow: 'hidden', background: PAPER_SOFT }}>
            {portrait ? (
              <img src={portrait} style={{ position: 'absolute', top: '-28px', left: '-76px', width: '504px', height: '504px' }} />
            ) : (
              <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <svg width="190" height="190" viewBox="0 0 100 100" fill="rgba(90,74,61,0.32)">
                  <circle cx="50" cy="35" r="21" />
                  <path d="M50 60 C29 60 15 77 15 100 L85 100 C85 77 71 60 50 60 Z" />
                </svg>
              </div>
            )}
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '81px',
              background: PAPER, padding: '0 31px',
              display: 'flex', alignItems: 'center',
              borderTop: `1px solid ${RULE}`,
            }}>
              <div style={{
                display: 'flex',
                fontFamily: 'Playfair Display',
                fontSize: `${nameFontSize}px`,
                color: INK,
                fontWeight: 500,
                lineHeight: 1,
                whiteSpace: 'nowrap',
                letterSpacing: '-0.02em',
              }}>
                {speakerName}
              </div>
            </div>
          </div>

          {/* RIGHT — cream editorial panel */}
          <div style={{
            width: '487px', height: '441px', background: PAPER, color: INK,
            display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
            position: 'relative',
          }}>
            {/* Brand row (compass + wordmark) with bleeding border-bottom */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '8px',
              padding: '28px 42px 13px',
              borderBottom: `1px solid ${RULE}`,
              color: OXBLOOD,
            }}>
              {/* Inline compass SVG (lucide-react compass) */}
              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke={OXBLOOD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />
              </svg>
              <div style={{
                display: 'flex',
                fontFamily: 'Playfair Display',
                fontSize: '14px',
                letterSpacing: '0.12em',
                textTransform: 'uppercase',
                fontWeight: 500,
                color: OXBLOOD,
              }}>
                The Long Council
              </div>
            </div>

            {/* Hero quote area */}
            <div style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              padding: '28px 42px 0',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Faded oversized opening quote */}
              <div style={{
                position: 'absolute',
                top: '6px',
                left: '38px',
                fontFamily: 'Playfair Display',
                fontSize: '105px',
                lineHeight: 1,
                color: QUOTEMARK,
                fontWeight: 500,
                display: 'flex',
              }}>
                &ldquo;
              </div>
              <div style={{
                display: 'flex',
                fontFamily: 'Playfair Display',
                fontStyle: 'italic',
                fontSize: `${quoteFontSize}px`,
                lineHeight: 1.25,
                fontWeight: 500,
                color: INK,
                paddingLeft: '49px',
                marginTop: '25px',
              }}>
                {quoteText}
              </div>
            </div>

            {/* Question block — PAPER_SOFT, 81px tall to match name strip */}
            <div style={{
              height: '81px',
              background: PAPER_SOFT,
              padding: '14px 42px',
              borderTop: `1px solid ${RULE}`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              boxSizing: 'border-box',
            }}>
              <div style={{
                display: 'flex',
                fontFamily: 'Playfair Display',
                fontSize: '20px',
                lineHeight: 1.25,
                color: INK,
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}>
                {question}
              </div>
            </div>
          </div>
        </div>
      ),
      {
        width: 840,
        height: 441,
        fonts: FONT_FILES
          .map((f, i) => fontData[i] && { name: 'Playfair Display', data: fontData[i], style: f.style, weight: f.weight })
          .filter(Boolean),
        headers: {
          'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        },
      },
    );
  } catch (err) {
    return new Response(`Error generating image: ${err.message}`, { status: 500 });
  }
}
