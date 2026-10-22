// Reads up to 3 news-article links the reader wants the council to debate, then
// proposes 3 questions. Security lives in lib/contextSources: https-only, Google
// Web Risk, SSRF-guarded fetch, paywall fallback, article text treated as data.
import { fetchSources, suggestQuestions, MAX_LINKS } from '../../lib/contextSources.mjs';

export const config = { maxDuration: 60 };

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
  unreadable: 'That article could not be read, even its headline.',
  too_many_redirects: 'That link redirected too many times.',
  fetch_failed: 'That page could not be reached.',
};

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Server not configured' });

  let urls = [];
  const body = req.body || {};
  if (typeof body.url === 'string') urls = [body.url];
  else if (Array.isArray(body.urls)) urls = body.urls.filter((u) => typeof u === 'string');
  urls = urls.map((u) => u.trim()).filter(Boolean).slice(0, MAX_LINKS);
  if (urls.length === 0) return res.status(400).json({ error: 'Paste a news article link first.' });

  try {
    const { sources, errors } = await fetchSources(urls, process.env.WEBRISK_API_KEY);
    const errOut = errors.map((e) => ({ url: e.url, reason: e.reason, message: REASON_COPY[e.reason] || 'That link could not be used.' }));

    if (sources.length === 0) {
      return res.status(200).json({ ok: false, sources: [], questions: [], errors: errOut });
    }

    const questions = await suggestQuestions(sources, { key: process.env.ANTHROPIC_API_KEY, model: CONTEXT_MODEL });

    return res.status(200).json({
      ok: true,
      sources: sources.map((s) => ({ url: s.url, title: s.title, type: s.type, mode: s.mode })),
      questions,
      errors: errOut,
    });
  } catch (err) {
    console.error('[read-article] failed:', err.message);
    return res.status(500).json({ error: 'Could not read the article. Try another source.' });
  }
}
