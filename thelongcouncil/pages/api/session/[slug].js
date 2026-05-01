import { supabase } from '../../../lib/supabase';

// Helper: parse the framing line (italic line) from a member's card text
function extractFramingLine(cardText) {
  if (!cardText) return null;

  // The framing line is the first italic line: starts with * but not ** (bold)
  const lines = cardText.split('\n').map(l => l.trim()).filter(Boolean);

  for (const line of lines) {
    // Match: *text* (italic) but NOT **text** (bold)
    if (line.length >= 3 && line.startsWith('*') && !line.startsWith('**') && line.endsWith('*') && !line.endsWith('**')) {
      // Strip the surrounding asterisks
      return line.slice(1, -1).trim();
    }
  }
  return null;
}

// Helper: parse member name from card heading (## Name)
function extractMemberName(cardText) {
  if (!cardText) return null;
  const match = cardText.match(/^##\s+(.+)$/m);
  return match ? match[1].trim() : null;
}

// Helper: split deliberation text into individual member cards
function parseCards(deliberationText) {
  if (!deliberationText) return [];

  let cleaned = deliberationText.replace(/^SPEAKING ORDER:.*$/im, '').trim();
  const blocks = cleaned.split(/(?:^|\n)\s*---\s*\n/).map(b => b.trim()).filter(Boolean);

  // Filter out convergence note and other non-member blocks
  return blocks.filter(b => {
    if (b.length < 50) return false;
    if (/^SPEAKING ORDER:/i.test(b)) return false;
    if (/^##\s*The convergence note/i.test(b)) return false;
    if (/\*\*Central Tension:\*\*/i.test(b)) return false;
    if (/\*\*Issue Analysis\*\*/i.test(b)) return false;
    return true;
  });
}

// Helper: convert member name to avatar filename
function nameToAvatarPath(name) {
  if (!name) return null;
  const slug = name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, '')
    .trim()
    .replace(/\s+/g, '_');
  return `https://www.thelongcouncil.com/avatars/avatar_${slug}.webp`;
}

export default async function handler(req, res) {
  const { slug } = req.query;

  if (!slug) {
    return res.status(400).json({ error: 'No slug provided' });
  }

  try {
    const { data: session, error } = await supabase
      .from('sessions')
      .select('original_issue, sharpened_issue, cards, member_names, created_at')
      .eq('slug', slug)
      .single();

    if (error || !session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    const deliberationText = session.cards?.deliberation || '';
    const cards = parseCards(deliberationText);

    // Extract members in speaking order, with their framing line as quote
    const members = cards.map(card => {
      const name = extractMemberName(card);
      const quote = extractFramingLine(card);
      return {
        name,
        portrait: nameToAvatarPath(name),
        quote,
      };
    }).filter(m => m.name && m.quote);

    return res.status(200).json({
      slug,
      question: session.original_issue,
      sharpenedQuestion: session.sharpened_issue,
      members,
      createdAt: session.created_at,
    });
  } catch (err) {
    console.error('[api/session] Error:', err);
    return res.status(500).json({ error: 'Server error' });
  }
}
