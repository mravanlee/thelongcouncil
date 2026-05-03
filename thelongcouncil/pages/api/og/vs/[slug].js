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

    if (!slug) {
      return new Response('Missing slug', { status: 400 });
    }

    const host = req.headers.get('host');
    const protocol = host && host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    const sessionRes = await fetch(`${baseUrl}/api/session/${slug}`);
    if (!sessionRes.ok) {
      return new Response('Session not found', { status: 404 });
    }
    const session = await sessionRes.json();

    const member1 = session.members?.[0];
    const member2 = session.members?.[1];

    if (!member1 || !member2) {
      return new Response('Need at least 2 members', { status: 400 });
    }

    const question = (session.question || session.sharpenedQuestion || '').toUpperCase();
    const quoteText = member1.quote || '';

    const portrait1 = member1.portrait?.startsWith('http') ? member1.portrait : `${baseUrl}${member1.portrait}`;
    const portrait2 = member2.portrait?.startsWith('http') ? member2.portrait : `${baseUrl}${member2.portrait}`;

    const [playfairItalic, playfairRegular, inter] = await Promise.all([
      loadGoogleFont('Playfair Display', 500, true),
      loadGoogleFont('Playfair Display', 500, false),
      loadGoogleFont('Inter', 400, false),
    ]);

    return new ImageResponse(
      (
        <div style={{ width: '1080px', height: '1350px', background: '#f3eeea', display: 'flex', flexDirection: 'column' }}>

          {/* Question */}
          <div style={{ padding: '80px 120px 20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ textAlign: 'center', fontFamily: 'Inter', fontSize: '22px', letterSpacing: '2px', lineHeight: 1.5, color: '#2a2a2a' }}>
              {question}
            </div>
          </div>

          {/* Divider */}
          <div style={{ width: '60px', height: '3px', background: '#6b1a1a', margin: '10px auto 20px' }} />

          {/* Faces */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 100px', position: 'relative', height: '420px' }}>
            <img src={portrait1} style={{ width: '360px', objectFit: 'contain' }} />

            <div style={{ position: 'absolute', left: '50%', top: '45%', transform: 'translate(-50%, -50%)', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ width: '2px', height: '80px', background: '#6b1a1a', marginBottom: '10px', transform: 'rotate(20deg)' }} />
              <div style={{ display: 'flex', fontFamily: 'Playfair Display', fontSize: '64px', color: '#6b1a1a' }}>VS</div>
            </div>

            <img src={portrait2} style={{ width: '360px', objectFit: 'contain' }} />
          </div>

          {/* Names */}
          <div style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 100px 30px' }}>
            <div style={{ width: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontFamily: 'Playfair Display', fontSize: '28px', color: '#6b1a1a', letterSpacing: '2px', textAlign: 'center' }}>{member1.name.toUpperCase()}</div>
              <div style={{ width: '50px', height: '2px', background: '#6b1a1a', marginTop: '10px' }} />
            </div>
            <div style={{ width: '360px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontFamily: 'Playfair Display', fontSize: '28px', color: '#6b1a1a', letterSpacing: '2px', textAlign: 'center' }}>{member2.name.toUpperCase()}</div>
              <div style={{ width: '50px', height: '2px', background: '#6b1a1a', marginTop: '10px' }} />
            </div>
          </div>

          {/* Quote */}
          <div style={{ padding: '40px 140px', display: 'flex', justifyContent: 'center', alignItems: 'center', position: 'relative', flex: 1 }}>
            <div style={{ position: 'absolute', left: '100px', top: '0px', display: 'flex', fontSize: '80px', color: '#6b1a1a', fontFamily: 'Playfair Display', fontStyle: 'normal', lineHeight: 1 }}>“</div>
            <div style={{ display: 'flex', textAlign: 'center', fontFamily: 'Playfair Display', fontStyle: 'italic', fontSize: '44px', lineHeight: 1.4, color: '#1a1a1a' }}>
              {quoteText}
            </div>
            <div style={{ position: 'absolute', right: '100px', bottom: '0px', display: 'flex', fontSize: '80px', color: '#6b1a1a', fontFamily: 'Playfair Display', fontStyle: 'normal', lineHeight: 1 }}>”</div>
          </div>

          {/* Footer */}
          <div style={{ height: '180px', background: 'linear-gradient(180deg, #6b1a1a, #3b0e0e)', color: '#f3eeea', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontFamily: 'Inter', fontSize: '14px', letterSpacing: '2px', opacity: 0.8, marginBottom: '12px' }}>
              — TWO PERSPECTIVES. ONE QUESTION. —
            </div>
            <div style={{ display: 'flex', fontFamily: 'Playfair Display', fontSize: '36px' }}>The Long Council</div>
          </div>

        </div>
      ),
      {
        width: 1080,
        height: 1350,
        fonts: [
          { name: 'Playfair Display', data: playfairItalic, style: 'italic', weight: 500 },
          { name: 'Playfair Display', data: playfairRegular, style: 'normal', weight: 500 },
          { name: 'Inter', data: inter, style: 'normal', weight: 400 },
        ],
      }
    );
  } catch (err) {
    return new Response(`Error generating image: ${err.message}`, { status: 500 });
  }
}
