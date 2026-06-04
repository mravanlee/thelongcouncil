import { ImageResponse } from '@vercel/og';
import { resolveAvatarSlug, KNOWN_AVATAR_SLUGS } from '../../../../lib/avatarSlugs';

export const config = {
  runtime: 'edge',
};

async function loadGoogleFont(family, weight, italic = false) {
  const italicParam = italic ? '1' : '0';
  const url = `https://fonts.googleapis.com/css2?family=${family.replace(/ /g, '+')}:ital,wght@${italicParam},${weight}&display=swap`;
  const css = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
  }).then((res) => res.text());
  const fontUrl = css.match(/src: url\((.+?)\) format/)?.[1];
  if (!fontUrl) throw new Error(`Font URL not found for ${family} ${weight}${italic ? ' italic' : ''}`);
  return fetch(fontUrl).then((res) => res.arrayBuffer());
}

// Resilient wrapper: a font hiccup must never break the card. On failure we
// render with the default font — the portrait and layout still come through.
async function safeFont(family, weight, italic = false) {
  try {
    return await loadGoogleFont(family, weight, italic);
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

    const [sessionRes, playfair500, playfair600, playfairItalic] = await Promise.all([
      fetch(`${baseUrl}/api/session/${slug}`),
      safeFont('Playfair Display', 500, false),
      safeFont('Playfair Display', 600, false),
      safeFont('Playfair Display', 500, true),
    ]);

    if (!sessionRes.ok) return new Response('Session not found', { status: 404 });
    const session = await sessionRes.json();

    if (!session.members || session.members.length === 0) {
      return new Response('No speakers found', { status: 400 });
    }

    // Feature a member that actually has an avatar file. Off-roster figures the
    // pipeline occasionally adds (e.g. Charles de Gaulle) have no portrait, which
    // breaks @vercel/og into an empty image — so never feature one as the face.
    const hasAvatar = (m) => KNOWN_AVATAR_SLUGS.has(avatarSlugFor(m && m.name));
    let member = session.members.find(hasAvatar) || session.members[0];
    if (memberQuery) {
      const target = normaliseName(memberQuery);
      const found = session.members.find((m) => normaliseName(m.name) === target);
      if (found && hasAvatar(found)) member = found;
    }

    const rawQuestion = session.question || session.sharpenedQuestion || '';
    const question = rawQuestion.length > 55
      ? rawQuestion.slice(0, 55).replace(/\s+\S*$/, '') + '…'
      : rawQuestion;
    const quoteText = member.quote || '';
    const speakerName = member.name || '';
    const nameFontSize = getNameFontSize(speakerName);
    const quoteFontSize = getQuoteFontSize(quoteText);

    // Build the portrait from the resolved slug so it always points at a file
    // that exists (we only ever feature members that have a real avatar).
    const memberSlug = avatarSlugFor(speakerName);
    const portrait = KNOWN_AVATAR_SLUGS.has(memberSlug)
      ? `${baseUrl}/avatars/avatar_${memberSlug}.png`
      : null;

    return new ImageResponse(
      (
        // 1200×630 design scaled into an 840×441 output so the PNG lands ~400KB —
        // a safe margin under WhatsApp's ~600KB limit (one wrapper, no layout rework).
        <div style={{ width: '840px', height: '441px', display: 'flex', overflow: 'hidden', background: PAPER }}>
          <div style={{ width: '1200px', height: '630px', background: PAPER, display: 'flex', transform: 'scale(0.7)', transformOrigin: 'top left', flexShrink: 0 }}>
          {/* LEFT — portrait + name strip */}
          <div style={{ width: '504px', height: '630px', position: 'relative', display: 'flex', overflow: 'hidden', background: PAPER_SOFT }}>
            <img src={portrait} style={{ position: 'absolute', top: '-40px', left: '-108px', width: '720px', height: '720px' }} />
            <div style={{
              position: 'absolute', bottom: 0, left: 0, right: 0, height: '116px',
              background: PAPER, padding: '0 44px',
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
            width: '696px', height: '630px', background: PAPER, color: INK,
            display: 'flex', flexDirection: 'column', boxSizing: 'border-box',
            position: 'relative',
          }}>
            {/* Brand row (compass + wordmark) with bleeding border-bottom */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '40px 60px 18px',
              borderBottom: `1px solid ${RULE}`,
              color: OXBLOOD,
            }}>
              {/* Inline compass SVG (lucide-react compass) */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke={OXBLOOD} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10" />
                <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />
              </svg>
              <div style={{
                display: 'flex',
                fontFamily: 'Playfair Display',
                fontSize: '20px',
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
              padding: '40px 60px 0',
              position: 'relative',
              overflow: 'hidden',
            }}>
              {/* Faded oversized opening quote */}
              <div style={{
                position: 'absolute',
                top: '8px',
                left: '54px',
                fontFamily: 'Playfair Display',
                fontSize: '150px',
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
                paddingLeft: '70px',
                marginTop: '36px',
              }}>
                {quoteText}
              </div>
            </div>

            {/* Question block — PAPER_SOFT, 116px tall to match name strip */}
            <div style={{
              height: '116px',
              background: PAPER_SOFT,
              padding: '20px 60px',
              borderTop: `1px solid ${RULE}`,
              display: 'flex',
              flexDirection: 'column',
              justifyContent: 'center',
              boxSizing: 'border-box',
            }}>
              <div style={{
                display: 'flex',
                fontFamily: 'Playfair Display',
                fontSize: '28px',
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
        </div>
      ),
      {
        width: 840,
        height: 441,
        fonts: [
          playfair500 && { name: 'Playfair Display', data: playfair500, style: 'normal', weight: 500 },
          playfair600 && { name: 'Playfair Display', data: playfair600, style: 'normal', weight: 600 },
          playfairItalic && { name: 'Playfair Display', data: playfairItalic, style: 'italic', weight: 500 },
        ].filter(Boolean),
        headers: {
          'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        },
      },
    );
  } catch (err) {
    return new Response(`Error generating image: ${err.message}`, { status: 500 });
  }
}
