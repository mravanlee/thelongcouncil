// Reads a news-article link the reader attaches (for context) or starts from
// (for suggested questions), and returns a confirmation plus, when asked, 3
// suggested questions. Security lives in lib/contextSources: https-only, Google
// Web Risk, SSRF-guarded fetch, paywalled pages refused, article text treated as data.
import { fetchSource, suggestQuestions } from '../../lib/contextSources.mjs';

export const config = { maxDuration: 45 };

const CONTEXT_MODEL = process.env.TLC_MODEL_CONTEXT || process.env.TLC_MODEL || 'claude-sonnet-5';

const REASON_COPY = {
  not_https: 'Only https links are accepted.',
  ip_literal: 'That looks like an IP address, not a news site.',
  shortener: 'Shortened links are not accepted; paste the full article URL.',
  not_public: 'That does not look like a public web address.',
  has_credentials: 'That link contains login details and was rejected.',
  bad_port: 'That link uses an unusual port and was rejected.',
  invalid: 'That is not a valid link.',
  unsafe: 'That link was flagged as unsafe and was blocked.',
  private_ip: 'That link points to an internal address and was blocked.',
  not_html: 'That link is not a readable web page.',
  not_article: 'That link is not a news article, so there is nothing for the council to read.',
  unreadable: 'We could not find an article to read at that link.',
  paywalled: 'That article is behind a paywall, so the council cannot read it. Try a free report on the same news, or ask without a link.',
  too_many_redirects: 'That link redirected too many times.',
  fetch_failed: 'That page could not be reached.',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Server not configured' });

  const body = req.body || {};
  const url = typeof body.url === 'string' ? body.url.trim() : '';
  const wantSuggest = body.suggest !== false; // default true; pass false to only confirm a link
  if (!url) return res.status(400).json({ error: 'Paste a news article link first.' });

  try {
    const r = await fetchSource(url, process.env.WEBRISK_API_KEY);
    if (!r.ok) {
      return res.status(200).json({ ok: false, reason: r.reason, message: REASON_COPY[r.reason] || 'That link could not be used.' });
    }
    const source = { url: r.url, title: r.title, type: r.type, mode: r.mode };
    let questions = [];
    if (wantSuggest) {
      questions = await suggestQuestions([r], { key: process.env.ANTHROPIC_API_KEY, model: CONTEXT_MODEL });
    }
    return res.status(200).json({ ok: true, source, questions });
  } catch (err) {
    console.error('[read-article] failed:', err.message);
    return res.status(500).json({ error: 'Could not read the article. Try another source.' });
  }
}
