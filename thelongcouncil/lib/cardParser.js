// Card parsing helpers — used by Procession (live session) and Deliberation (archive)
// to render member cards consistently across both surfaces.
//
// Pure data utilities + one inline-markdown renderer. No animation logic here.

export const FRAMER_NAMES = new Set([
  'John Maynard Keynes', 'Friedrich Hayek', 'Milton Friedman', 'John Locke',
  'Jean-Jacques Rousseau', 'John Rawls', 'Hannah Arendt', 'Amartya Sen',
  'Albert Hirschman', 'Niccolò Machiavelli', 'Niccolo Machiavelli', 'Confucius',
  'Kautilya', 'Ibn Khaldun', 'Frantz Fanon', 'Raúl Prebisch', 'Raul Prebisch',
  'Ali ibn Abi Talib', 'Elinor Ostrom', 'Sun Tzu', 'Simón Bolívar',
  'Simon Bolivar', 'Julius Nyerere',
]);

export function getTier(name) {
  if (!name) return 'P';
  return FRAMER_NAMES.has(name.trim()) ? 'F' : 'P';
}

export function getInitials(name) {
  if (!name) return '';
  const cleaned = name.trim().replace(/[.,]/g, '');
  const words = cleaned.split(/\s+/).filter(Boolean);
  if (words.length >= 3) return words.slice(0, 3).map(w => w[0].toUpperCase()).join('');
  if (words.length === 2) return (words[0][0] + words[1][0]).toUpperCase();
  return cleaned.slice(0, 2).toUpperCase();
}

export function slugify(name) {
  if (!name) return '';
  return name
    .replace(/\s*\([^)]*\)/g, '')        // strip "(Chanakya)" and similar
    .normalize('NFD')                      // decompose ò → o + combining grave
    .replace(/[\u0300-\u036f]/g, '')      // remove combining diacritics
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')          // non-alphanumeric → underscore
    .replace(/^_+|_+$/g, '');             // trim leading/trailing underscores
}

// Parse a single card markdown string into structured fields.
// Returns null if the input doesn't look like a card.
export function parseCard(raw) {
  if (!raw || typeof raw !== 'string') return null;
  const lines = raw.split('\n').map(l => l.trim());

  let name = '', role = '', framing = '';
  const body = [];
  let challenge = '';
  let cursor = 0;
  while (cursor < lines.length && lines[cursor] === '') cursor++;
  if (cursor >= lines.length) return null;

  const first = lines[cursor];
  if (first.startsWith('## ')) {
    name = first.slice(3).trim();
    cursor++;
    while (cursor < lines.length && lines[cursor] === '') cursor++;
    if (cursor < lines.length) {
      const candidate = lines[cursor];
      const isFraming = /^\*[^*].*[^*]\*$/.test(candidate);
      const isChallenge = /^\*\*Challenge\b/i.test(candidate);
      const isHeading = candidate.startsWith('#');
      if (!isFraming && !isChallenge && !isHeading && candidate !== '') {
        role = candidate;
        cursor++;
      }
    }
  } else if (first.includes('·')) {
    const [n, ...rest] = first.split('·');
    name = n.trim();
    role = rest.join('·').trim();
    cursor++;
    while (cursor < lines.length && lines[cursor] === '') cursor++;
    if (cursor < lines.length && /^session confidence:/i.test(lines[cursor])) cursor++;
  } else {
    return null;
  }

  const paragraphs = [];
  let current = [];
  for (let i = cursor; i < lines.length; i++) {
    const line = lines[i];
    if (line === '') {
      if (current.length > 0) { paragraphs.push(current.join(' ')); current = []; }
    } else {
      current.push(line);
    }
  }
  if (current.length > 0) paragraphs.push(current.join(' '));

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i];
    if (/^\*[^*].*[^*]\*$/.test(p) && !framing) {
      framing = p.slice(1, -1).trim();
      paragraphs.splice(i, 1);
      break;
    }
  }

  if (paragraphs.length > 0) {
    const last = paragraphs[paragraphs.length - 1];
    if (/^\*\*Challenge\b/i.test(last)) {
      challenge = last;
      paragraphs.pop();
    }
  }

  body.push(...paragraphs);
  return { name, role, framing, body, challenge };
}

// Inline-markdown renderer. Handles: [confidence_tag], **bold**, *italic*.
// Returns React nodes (string array with JSX elements interleaved).
export function renderInline(text) {
  if (!text) return null;
  const parts = [];
  const pattern = /(\[(?:documented|inferred|extrapolated|no documented position)\]|\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0, match, key = 0;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const token = match[0];
    if (/^\[/.test(token)) {
      parts.push(<span key={`s-${key++}`} className="sig">{token.slice(1, -1)}</span>);
    } else if (token.startsWith('**')) {
      parts.push(<strong key={`b-${key++}`}>{token.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={`i-${key++}`}>{token.slice(1, -1)}</em>);
    }
    lastIndex = match.index + token.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length === 0 ? text : parts;
}
