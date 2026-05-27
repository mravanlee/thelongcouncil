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

export function middleware(req) {
  const ua = req.headers.get('user-agent') || '';
  const bot = detectAiBot(ua);
  if (bot) {
    const path = req.nextUrl.pathname;
    const country = (req.geo && req.geo.country) || '-';
    const ip = req.ip || '-';
    // Single-line structured log. Search Vercel logs for "[ai-bot]" to
    // see all hits. Format keeps the bot label early so eyeballing is fast.
    console.log(`[ai-bot] ${bot} path=${path} country=${country} ip=${ip}`);
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
