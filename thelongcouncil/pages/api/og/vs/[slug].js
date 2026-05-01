import { ImageResponse } from '@vercel/og';

export const config = {
  runtime: 'edge',
};

// Auto-shrink question font size based on length
function getQuestionFontSize(text) {
  const len = (text || '').length;
  if (len <= 60) return 38;
  if (len <= 90) return 32;
  if (len <= 120) return 28;
  return 24;
}

// Auto-shrink quote font size based on length
function getQuoteFontSize(text) {
  const len = (text || '').length;
  if (len <= 80) return 44;
  if (len <= 120) return 38;
  if (len <= 160) return 32;
  return 28;
}

export default async function handler(req) {
  try {
    const { searchParams } = new URL(req.url);
    const url = new URL(req.url);
    const pathParts = url.pathname.split('/');
    const slug = pathParts[pathParts.length - 1];

    if (!slug) {
      return new Response('No slug provided', { status: 400 });
    }

    // Fetch session data from our own session API
    const origin = `${url.protocol}//${url.host}`;
    const sessionRes = await fetch(`${origin}/api/session/${slug}`);

    if (!sessionRes.ok) {
      return new Response('Session not found', { status: 404 });
    }

    const data = await sessionRes.json();
    const { question, members } = data;

    // Need at least 2 members for VS card — fallback 404
    if (!members || members.length < 2) {
      return new Response('Not enough members for VS card', { status: 404 });
    }

    // First two speakers become A and B
    const A = members[0];
    const B = members[1];

    // Quote = A's framing line (per design spec: only A's quote shown)
    const quote = A.quote;
    const quoteAuthor = A.name;

    // Use sharpened question if available and shorter, else original
    const displayQuestion = data.sharpenedQuestion && data.sharpenedQuestion.length < question.length
      ? data.sharpenedQuestion
      : question;

    return new ImageResponse(
      (
        <div
          style={{
            width: '1080px',
            height: '1350px',
            display: 'flex',
            flexDirection: 'column',
            background: '#f3eeea',
            position: 'relative',
            fontFamily: 'serif',
          }}
        >
          {/* QUESTION at top */}
          <div
            style={{
              padding: '70px 100px 30px',
              textAlign: 'center',
              fontSize: `${getQuestionFontSize(displayQuestion)}px`,
              fontStyle: 'italic',
              color: '#3a3a3a',
              lineHeight: 1.35,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              minHeight: '160px',
            }}
          >
            "{displayQuestion}"
          </div>

          {/* TWO PORTRAITS WITH VS */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '20px 80px 0',
              flex: '0 0 auto',
            }}
          >
            <img
              src={A.portrait}
              alt={A.name}
              width="380"
              height="380"
              style={{
                width: '380px',
                height: '380px',
                objectFit: 'cover',
              }}
            />
            <div
              style={{
                fontSize: '88px',
                color: '#6b1a1a',
                fontWeight: 700,
                fontFamily: 'serif',
                display: 'flex',
              }}
            >
              VS
            </div>
            <img
              src={B.portrait}
              alt={B.name}
              width="380"
              height="380"
              style={{
                width: '380px',
                height: '380px',
                objectFit: 'cover',
              }}
            />
          </div>

          {/* NAMES ROW */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '15px 100px 30px',
            }}
          >
            <div
              style={{
                fontSize: '32px',
                fontWeight: 600,
                color: '#0f0f0f',
                fontFamily: 'serif',
                width: '380px',
                textAlign: 'center',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              {A.name}
            </div>
            <div style={{ width: '88px', display: 'flex' }}></div>
            <div
              style={{
                fontSize: '32px',
                fontWeight: 600,
                color: '#0f0f0f',
                fontFamily: 'serif',
                width: '380px',
                textAlign: 'center',
                display: 'flex',
                justifyContent: 'center',
              }}
            >
              {B.name}
            </div>
          </div>

          {/* QUOTE BAND */}
          <div
            style={{
              flex: 1,
              background: '#6b1a1a',
              color: '#f3eeea',
              padding: '50px 90px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontFamily: 'serif',
            }}
          >
            <div
              style={{
                fontSize: `${getQuoteFontSize(quote)}px`,
                lineHeight: 1.3,
                fontStyle: 'italic',
                textAlign: 'center',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
              }}
            >
              <div style={{ display: 'flex' }}>"{quote}"</div>
              <div
                style={{
                  marginTop: '24px',
                  fontSize: '22px',
                  fontStyle: 'normal',
                  opacity: 0.8,
                  letterSpacing: '0.05em',
                  textTransform: 'uppercase',
                  display: 'flex',
                }}
              >
                — {quoteAuthor}
              </div>
            </div>
          </div>

          {/* FOOTER */}
          <div
            style={{
              height: '110px',
              background: '#1a0f0f',
              color: '#f3eeea',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '0 80px',
              flex: '0 0 auto',
            }}
          >
            <div
              style={{
                fontSize: '18px',
                opacity: 0.7,
                letterSpacing: '0.08em',
                textTransform: 'uppercase',
                display: 'flex',
              }}
            >
              Two perspectives. One question.
            </div>
            <div
              style={{
                fontSize: '24px',
                fontFamily: 'serif',
                opacity: 0.95,
                display: 'flex',
              }}
            >
              The Long Council
            </div>
          </div>
        </div>
      ),
      {
        width: 1080,
        height: 1350,
      }
    );
  } catch (err) {
    console.error('[og/vs] Error:', err);
    return new Response(`Error generating image: ${err.message}`, { status: 500 });
  }
}
