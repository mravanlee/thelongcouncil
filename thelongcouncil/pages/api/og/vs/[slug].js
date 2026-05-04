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

export default async function handler(req) {
  try {
    const url = new URL(req.url);
    const slug = url.pathname.split('/').pop();
    if (!slug) return new Response('Missing slug', { status: 400 });

    const host = req.headers.get('host');
    const protocol = host && host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const sessionRes = await fetch(`${baseUrl}/api/session/${slug}`);
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

    const portrait = member.portrait?.startsWith('http')
      ? member.portrait
      : `${baseUrl}${member.portrait}`;

    const [playfair500, playfair600, playfairItalic] = await Promise.all([
      loadGoogleFont('Playfair Display', 500, false),
      loadGoogleFont('Playfair Display', 600, false),
      loadGoogleFont('Playfair Display', 500, true),
    ]);

    return new ImageResponse(
      (
        <div style={{ width: '1200px', height: '630px', background: '#f3eeea', display: 'flex' }}>

          {/* LEFT — Portrait with flush-bottom name band */}
          <div style={{ width: '504px', height: '630px', position: 'relative', display: 'flex', overflow: 'hidden' }}>
            <img src={portrait} style={{ position: 'absolute', top: '-44px', left: '-152px', width: '808px', height: '808px' }} />
            <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#f3eeea', padding: '18px 40px', display: 'flex' }}>
              <div style={{ display: 'flex', fontFamily: 'Playfair Display', fontSize: '56px', color: '#1a1a1a', fontWeight: 600, lineHeight: 1 }}>
                {speakerName}
              </div>
            </div>
          </div>

          {/* RIGHT — Bordeauxrood quote zone */}
          <div style={{ width: '696px', height: '630px', background: '#6b1a1a', color: '#f3eeea', padding: '64px 72px', display: 'flex', flexDirection: 'column', boxSizing: 'border-box' }}>

            <div style={{ display: 'flex', fontFamily: 'Playfair Display', fontSize: '20px', letterSpacing: '5px', opacity: 0.7, fontWeight: 500 }}>
              THE LONG COUNCIL
            </div>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
              <div style={{ display: 'flex', fontFamily: 'Playfair Display', fontSize: '140px', lineHeight: 0.6, opacity: 0.35, fontWeight: 500, marginBottom: '12px' }}>
                &ldquo;
              </div>
              <div style={{ display: 'flex', fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: '46px', lineHeight: 1.2, fontWeight: 500 }}>
                {quoteText}
              </div>
            </div>

            <div style={{ display: 'flex', borderTop: '1px solid rgba(243,238,234,0.3)', paddingTop: '20px' }}>
              <div style={{ display: 'flex', fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: '20px', opacity: 0.75 }}>
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
      }
    );
  } catch (err) {
    return new Response(`Error generating image: ${err.message}`, { status: 500 });
  }
}
