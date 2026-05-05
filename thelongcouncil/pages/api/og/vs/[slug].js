import { ImageResponse } from '@vercel/og';

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

// Naam font-size schaalt met lengte; balk-hoogte blijft constant 92px.
function getNameFontSize(name) {
  const len = name.length;
  if (len <= 10) return 56;
  if (len <= 13) return 50;
  if (len <= 16) return 44;
  if (len <= 19) return 38;
  return 32;
}

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const slug = url.pathname.split('/').pop();
    if (!slug) return new Response('Missing slug', { status: 400 });

    const host = req.headers.get('host');
    const protocol = host && host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    // Parallel fetch: session + 3 fonts in one round-trip.
    // Inter removed — Playfair 500 covers the question line, saves ~100KB.
    const [sessionRes, playfair500, playfair600, playfairItalic] = await Promise.all([
      fetch(`${baseUrl}/api/session/${slug}`),
      loadGoogleFont('Playfair Display', 500, false),
      loadGoogleFont('Playfair Display', 600, false),
      loadGoogleFont('Playfair Display', 500, true),
    ]);

    if (!sessionRes.ok) return new Response('Session not found', { status: 404 });
    const session = await sessionRes.json();

    const member = session.members?.[0];
    if (!member) return new Response('No speaker found', { status: 400 });

    const rawQuestion = session.question || session.sharpenedQuestion || '';
    const question = rawQuestion.length > 55
      ? rawQuestion.slice(0, 55).replace(/\s+\S*$/, '') + '…'
      : rawQuestion;
    const quoteText = member.quote || '';
    const speakerName = member.name || '';
    const nameFontSize = getNameFontSize(speakerName);

    const portrait = member.portrait?.startsWith('http')
      ? member.portrait
      : `${baseUrl}${member.portrait}`;

    return new ImageResponse(
      (
        <div style={{ width: '1200px', height: '630px', background: '#f3eeea', display: 'flex' }}>

          {/* LEFT — Portrait with flush-bottom name band */}
          <div style={{ width: '504px', height: '630px', position: 'relative', display: 'flex', overflow: 'hidden' }}>
            <img src={portrait} style={{ position: 'absolute', top: '-40px', left: '-108px', width: '720px', height: '720px' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: '92px', background: '#f3eeea', padding: '0 40px', display: 'flex', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontFamily: 'Playfair Display', fontSize: `${nameFontSize}px`, color: '#1a1a1a', fontWeight: 600, lineHeight: 1, whiteSpace: 'nowrap' }}>
                {speakerName}
              </div>
            </div>
          </div>

          {/* RIGHT — Bordeauxrood quote zone */}
          <div style={{ width: '696px', height: '630px', background: '#6b1a1a', color: '#f3eeea', padding: '40px 72px 60px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

            {/* TOP: brand */}
            <div style={{ display: 'flex', fontFamily: 'Playfair Display', fontSize: '20px', letterSpacing: '5px', opacity: 0.7, fontWeight: 500 }}>
              THE LONG COUNCIL
            </div>

            {/* MIDDLE: quote-mark + quote */}
            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', paddingTop: '40px' }}>
              <div style={{ display: 'flex', fontFamily: 'Playfair Display', fontSize: '90px', lineHeight: 1, opacity: 0.3, fontWeight: 500, marginBottom: '8px' }}>
                &ldquo;
              </div>
              <div style={{ display: 'flex', fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: '46px', lineHeight: 1.2, fontWeight: 500, marginTop: '-20px' }}>
                {quoteText}
              </div>
            </div>

            {/* BOTTOM: question */}
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <div style={{ display: 'flex', height: '1px', background: 'rgba(243,238,234,0.3)', marginBottom: '20px' }} />
              <div style={{ display: 'flex', fontFamily: 'Playfair Display', fontSize: '20px', fontWeight: 500, color: '#f3eeea' }}>
                on: {question}
              </div>
            </div>

          </div>
        </div>
      ),
      {
        width: 1200,
        height: 630,
        fonts: [
          { name: 'Playfair Display', data: playfair500, style: 'normal', weight: 500 },
          { name: 'Playfair Display', data: playfair600, style: 'normal', weight: 600 },
          { name: 'Playfair Display', data: playfairItalic, style: 'italic', weight: 500 },
        ],
        headers: {
          'Cache-Control': 'public, max-age=31536000, s-maxage=31536000, immutable',
        },
      }
    );
  } catch (err) {
    return new Response(`Error generating image: ${err.message}`, { status: 500 });
  }
}
