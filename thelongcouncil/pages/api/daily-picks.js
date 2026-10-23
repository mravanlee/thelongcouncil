// Daily article suggestions for Alex, fetched by n8n at 08:00 (workflow "TLC -
// Daily picks") and mailed on. Protected by a shared key in the x-picks-key
// header, so nobody else can spend Claude calls here. See lib/dailyPicks.mjs.
import crypto from 'node:crypto';
import { buildDailyPicks } from '../../lib/dailyPicks.mjs';

export const config = { maxDuration: 120 };

const PICKS_MODEL = process.env.TLC_MODEL_CONTEXT || process.env.TLC_MODEL || 'claude-sonnet-5';

function keyOk(given) {
  const want = process.env.DAILY_PICKS_KEY || '';
  if (!want || typeof given !== 'string') return false;
  const a = Buffer.from(given);
  const b = Buffer.from(want);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

export default async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });
  if (!keyOk(req.headers['x-picks-key'])) return res.status(401).json({ error: 'Unauthorized' });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(500).json({ error: 'Server not configured' });

  try {
    const out = await buildDailyPicks({ key: process.env.ANTHROPIC_API_KEY, model: PICKS_MODEL });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(out);
  } catch (err) {
    console.error('[daily-picks] failed:', err.message);
    return res.status(500).json({ error: err.message });
  }
}
