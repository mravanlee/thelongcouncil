import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

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

    const question = session.sharpenedQuestion || session.question || '';
    const quoteText = member1.quote || '';
    const quoteAuthor = member1.name || '';

    const portrait1 = member1.portrait?.startsWith('http')
      ? member1.portrait
      : `${baseUrl}${member1.portrait}`;
    const portrait2 = member2.portrait?.startsWith('http')
      ? member2.portrait
      : `${baseUrl}${member2.portrait}`;

    return new ImageResponse(
      (
        <div style={{ width: '1080px', height: '1350px', background: '#f3eeea', display: 'flex', flexDirection: 'column' }}>

          {/* Question */}
          <div style={{ height: '260px', padding: '80px 100px 40px', display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center', fontFamily: 'serif', fontSize: '34px', fontStyle: 'italic', lineHeight: 1.4, color: '#2a2a2a' }}>
            "{question}"
          </div>

          {/* Faces */}
          <div style={{ height: '420px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', padding: '0 80px', position: 'relative' }}>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <img src={portrait1} style={{ width: '360px', objectFit: 'contain' }} />
              <div style={{ marginTop: '12px', display: 'flex', fontFamily: 'sans-serif', fontSize: '22px', color: '#1a1a1a' }}>
                {member1.name}
              </div>
            </div>

            <div style={{ position: 'absolute', left: '50%', top: '40%', transform: 'translate(-50%, -50%)', display: 'flex', fontFamily: 'serif', fontSize: '64px', color: '#6b1a1a', fontWeight: 600, letterSpacing: '2px' }}>
              VS
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <img src={portrait2} style={{ width: '360px', objectFit: 'contain' }} />
              <div style={{ marginTop: '12px', display: 'flex', fontFamily: 'sans-serif', fontSize: '22px', color: '#1a1a1a' }}>
                {member2.name}
              </div>
            </div>

          </div>

          {/* Quote */}
          <div style={{ height: '430px', background: '#6b1a1a', color: '#f3eeea', padding: '70px 100px', display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
            <div style={{ display: 'flex', fontFamily: 'serif', fontSize: '44px', lineHeight: 1.2 }}>
              "{quoteText}"
            </div>
            <div style={{ marginTop: '24px', display: 'flex', fontFamily: 'sans-serif', fontSize: '22px', opacity: 0.85 }}>
              — {quoteAuthor}
            </div>
          </div>

          {/* Footer */}
          <div style={{ height: '140px', background: '#1a0f0f', color: '#f3eeea', display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0 80px', fontFamily: 'sans-serif', fontSize: '20px' }}>
            <div style={{ display: 'flex' }}>Two perspectives from the council</div>
            <div style={{ display: 'flex' }}>The Long Council</div>
          </div>

        </div>
      ),
      {
        width: 1080,
        height: 1350,
      }
    );
  } catch (err) {
    return new Response(`Error generating image: ${err.message}`, { status: 500 });
  }
}
