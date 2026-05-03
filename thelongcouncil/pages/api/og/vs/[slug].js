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

    const member1 = session.members?.[0];
    const member2 = session.members?.[1];
    if (!member1 || !member2) return new Response('Need at least 2 members', { status: 400 });

    const question = (session.question || session.sharpenedQuestion || '').toUpperCase();
    const quoteText = member1.quote || '';

    const portrait1 = member1.portrait?.startsWith('http') ? member1.portrait : `${baseUrl}${member1.portrait}`;
    const portrait2 = member2.portrait?.startsWith('http') ? member2.portrait : `${baseUrl}${member2.portrait}`;

    const [playfairItalic, playfairRegular, inter] = await Promise.all([
      loadGoogleFont('Playfair Display', 500, true),
      loadGoogleFont('Playfair Display', 500, false),
      loadGoogleFont('Inter', 500, false),
    ]);

    return new ImageResponse(
      (
        <div style={{ width: '1080px', height: '1350px', background: '#f3eeea', display: 'flex', flexDirection: 'column' }}>

          {/* Question + divider */}
          <div style={{ paddingTop: '50px', paddingLeft: '120px', paddingRight: '120px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ display: 'flex', textAlign: 'center', fontFamily: 'Inter', fontWeight: 500, fontSize: '28px', letterSpacing: '2px', lineHeight: 1.4, color: '#2a2a2a' }}>
              {question}
            </div>
            <div style={{ width: '60px', height: '3px', background: '#6b1a1a', marginTop: '24px' }} />
          </div>

          {/* Faces row: portrait — VS-stack — portrait */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '40px 60px 0', height: '480px' }}>
            
            {/* Left portrait — cropped to focus on head */}
            <div style={{ width: '380px', height: '420px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
              <img src={portrait1} style={{ width: '500px', height: '500px' }} />
            </div>

            {/* VS with single integrated slash */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '420px', width: '140px', position: 'relative' }}>
              <div style={{ width: '2px', height: '320px', background: '#6b1a1a', transform: 'rotate(20deg)', position: 'absolute', left: '50%', top: '50%', marginLeft: '-1px', marginTop: '-160px' }} />
              <div style={{ display: 'flex', fontFamily: 'Playfair Display', fontWeight: 500, fontSize: '96px', color: '#6b1a1a', lineHeight: 1, position: 'relative', zIndex: 1 }}>VS</div>
            </div>

            {/* Right portrait */}
            <div style={{ width: '380px', height: '420px', overflow: 'hidden', display: 'flex', justifyContent: 'center', alignItems: 'flex-start' }}>
              <img src={portrait2} style={{ width: '500px', height: '500px' }} />
            </div>
          </div>

          {/* Names — same column structure as faces */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', padding: '20px 60px 0' }}>
            <div style={{ width: '380px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontFamily: 'Playfair Display', fontWeight: 500, fontSize: '36px', color: '#6b1a1a', letterSpacing: '2px', textAlign: 'center' }}>{member1.name.toUpperCase()}</div>
              <div style={{ width: '70px', height: '2.5px', background: '#6b1a1a', marginTop: '14px' }} />
            </div>
            <div style={{ width: '140px' }} />
            <div style={{ width: '380px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <div style={{ display: 'flex', fontFamily: 'Playfair Display', fontWeight: 500, fontSize: '36px', color: '#6b1a1a', letterSpacing: '2px', textAlign: 'center' }}>{member2.name.toUpperCase()}</div>
              <div style={{ width: '70px', height: '2.5px', background: '#6b1a1a', marginTop: '14px' }} />
            </div>
          </div>

          {/* Quote anchor block */}
          <div style={{ flex: 1, background: '#ede5df', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '20px 140px', marginTop: '30px' }}>
            <div style={{ display: 'flex', position: 'relative', maxWidth: '780px' }}>
              <div style={{ position: 'absolute', left: '-50px', top: '-50px', display: 'flex', fontSize: '80px', color: '#6b1a1a', fontFamily: 'Playfair Display', lineHeight: 1 }}>“</div>
              <div style={{ display: 'flex', textAlign: 'center', fontFamily: 'Playfair Display', fontStyle: 'italic', fontWeight: 500, fontSize: '52px', lineHeight: 1.3, color: '#1a1a1a' }}>
                {quoteText}
              </div>
              <div style={{ position: 'absolute', right: '-50px', bottom: '-50px', display: 'flex', fontSize: '80px', color: '#6b1a1a', fontFamily: 'Playfair Display', lineHeight: 1 }}>”</div>
            </div>
          </div>

          {/* Gold accent line */}
          <div style={{ width: '100%', height: '3px', background: '#c4a661' }} />

          {/* Footer */}
          <div style={{ height: '180px', background: '#6b1a1a', color: '#f3eeea', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center' }}>
            <div style={{ display: 'flex', fontFamily: 'Inter', fontSize: '16px', letterSpacing: '2px', opacity: 0.85, marginBottom: '14px' }}>
              — TWO PERSPECTIVES. ONE QUESTION. —
            </div>
            <div style={{ display: 'flex', fontFamily: 'Playfair Display', fontWeight: 500, fontSize: '36px' }}>The Long Council</div>
          </div>

        </div>
      ),
      {
        width: 1080,
        height: 1350,
        fonts: [
          { name: 'Playfair Display', data: playfairItalic, style: 'italic', weight: 500 },
          { name: 'Playfair Display', data: playfairRegular, style: 'normal', weight: 500 },
          { name: 'Inter', data: inter, style: 'normal', weight: 500 },
        ],
      }
    );
  } catch (err) {
    return new Response(`Error generating image: ${err.message}`, { status: 500 });
  }
}
