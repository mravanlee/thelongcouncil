import { NextResponse } from 'next/server';

// Detect known AI crawler and assistant user agents.
// Source: each provider's published bot list, kept in sync with the
// equivalent Allow rules in public/robots.txt.
const AI_BOT_PATTERNS = [
  // OpenAI
  /GPTBot/i,
  /OAI-SearchBot/i,
  /ChatGPT-User/i,
  // Anthropic
  /ClaudeBot/i,
  /Claude-SearchBot/i,
  /Claude-User/i,
  // Perplexity
  /PerplexityBot/i,
  /Perplexity-User/i,
  // Google AI (separate from Googlebot — this is for AI training/SGE)
  /Google-Extended/i,
  // Apple AI
  /Applebot-Extended/i,
  // Common Crawl (feeds many LLM training sets)
  /CCBot/i,
  // Meta (Llama training)
  /Meta-ExternalAgent/i,
  // ByteDance (Doubao, etc.)
  /Bytespider/i,
];

function detectAiBot(ua) {
  if (!ua) return null;
  for (const pattern of AI_BOT_PATTERNS) {
    const m = ua.match(pattern);
    if (m) return m[0];
  }
  return null;
}

// Fire-and-forget insert into a Supabase table. Uses event.waitUntil so it
// never blocks the response, and swallows all errors so logging can never
// break a page load. The service-role key is server-only (never shipped to the
// browser) and works in the Edge runtime.
function logHit(event, table, row) {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key || !event) return;
  event.waitUntil(
    fetch(`${url}/rest/v1/${table}`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'return=minimal',
      },
      body: JSON.stringify(row),
    }).catch(() => {})
  );
}

export function middleware(req, event) {
  const ua = req.headers.get('user-agent') || '';
  const bot = detectAiBot(ua);
  const path = req.nextUrl.pathname;
  const country = (req.geo && req.geo.country) || '-';

  if (bot) {
    const ip = req.ip || '-';
    // Single-line structured log (search Vercel logs for "[ai-bot]") plus a
    // durable, queryable row in ai_bot_hits.
    console.log(`[ai-bot] ${bot} path=${path} country=${country} ip=${ip}`);
    logHit(event, 'ai_bot_hits', { bot, path, country, ip });
  } else {
    // Anonymous page-view logging for real browser navigations only (requests
    // that accept HTML, excluding API routes). Privacy-preserving by design:
    // we store NO IP, NO cookies, NO user-agent, NO identifier — only path,
    // referrer host, country, and timestamp. Aggregate, never personal.
    const accept = req.headers.get('accept') || '';
    if (accept.includes('text/html') && !path.startsWith('/api')) {
      let referrer = null;
      const referer = req.headers.get('referer');
      if (referer) {
        try {
          referrer = new URL(referer).hostname;
        } catch {}
      }
      logHit(event, 'page_views', { path, referrer, country });
    }
  }

  return NextResponse.next();
}

// Skip static binary assets to save middleware invocations on the
// Vercel quota. Text/XML files are INCLUDED (llms.txt, llms-full.txt,
// sitemap.xml, robots.txt) because those are exactly where AI bots hit
// first; we want that visibility.
export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon|apple-touch-icon|og-default|avatars|api/og|.*\\.(?:ico|svg|png|webp|jpg|jpeg)$).*)',
  ],
};
