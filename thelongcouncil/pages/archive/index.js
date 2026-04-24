import { useState, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

// ── Server-side data fetching ──────────────────────────────────────────
// Runs on the Vercel server for every page load — gives fresh data
// without the user seeing a loading spinner
export async function getServerSideProps() {
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, slug, original_issue, sharpened_issue, member_names, member_types, created_at, cards')
    .order('created_at', { ascending: false })
    .limit(50);

  if (error) {
    console.error('[archive] Failed to load sessions:', error);
    return { props: { sessions: [], error: error.message } };
  }

  // Extract the verdict teaser from the verdict output
  // This is the short 1-2 sentence summary shown under each issue in the timeline
  const enriched = (sessions || []).map(s => ({
    id: s.id,
    slug: s.slug,
    original_issue: s.original_issue,
    sharpened_issue: s.sharpened_issue,
    member_names: s.member_names || [],
    member_types: s.member_types || [],
    created_at: s.created_at,
    teaser: extractTeaser(s.cards),
  }));

  return { props: { sessions: enriched, error: null } };
}

// Pull a short teaser from the verdict markdown
// Looks for the first paragraph after "## Verdict"
function extractTeaser(cards) {
  if (!cards || !cards.verdict) return '';
  const match = cards.verdict.match(/##\s*Verdict\s*\n+([^\n#]+(?:\n[^\n#]+)*)/i);
  if (!match) return '';
  const firstPara = match[1].trim().split(/\n\s*\n/)[0];
  // Trim to reasonable length
  if (firstPara.length > 240) {
    const trimmed = firstPara.substring(0, 240);
    const lastPeriod = trimmed.lastIndexOf('.');
    return lastPeriod > 100 ? trimmed.substring(0, lastPeriod + 1) : trimmed + '…';
  }
  return firstPara;
}

// ── Date formatting ────────────────────────────────────────────────────
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

function getDayOfMonth(iso) {
  return new Date(iso).getDate();
}

// ── Framer set (mirrors Procession.jsx for tier display) ──────────────
const FRAMER_NAMES = new Set([
  'John Maynard Keynes', 'Friedrich Hayek', 'Milton Friedman', 'John Locke',
  'Jean-Jacques Rousseau', 'John Rawls', 'Hannah Arendt', 'Amartya Sen',
  'Albert Hirschman', 'Niccolò Machiavelli', 'Niccolo Machiavelli', 'Confucius',
  'Kautilya', 'Kautilya (Chanakya)', 'Ibn Khaldun', 'Frantz Fanon',
  'Raúl Prebisch', 'Raul Prebisch', 'Ali ibn Abi Talib', 'Elinor Ostrom',
  'Sun Tzu', 'Simón Bolívar', 'Simon Bolivar', 'Julius Nyerere',
  'Eleanor Roosevelt', 'Wangari Maathai', 'Rosa Luxemburg',
]);

function isFramer(name) {
  if (!name) return false;
  const trimmed = name.trim();
  if (FRAMER_NAMES.has(trimmed)) return true;
  // Fuzzy match on last name for when the model says "Schmidt" instead of "Helmut Schmidt"
  for (const full of FRAMER_NAMES) {
    if (full.toLowerCase().includes(trimmed.toLowerCase()) && trimmed.length > 3) {
      return true;
    }
  }
  return false;
}

// ── Page component ─────────────────────────────────────────────────────
export default function Archive({ sessions, error }) {
  const [search, setSearch] = useState('');

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return sessions;
    return sessions.filter(s => {
      const haystack = [
        s.original_issue,
        s.sharpened_issue,
        s.teaser,
        ...(s.member_names || []),
      ].filter(Boolean).join(' ').toLowerCase();
      return haystack.includes(q);
    });
  }, [sessions, search]);

  return (
    <>
      <Head>
        <title>The Archive — The Long Council</title>
        <meta name="description" content="Every issue the council has considered." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      <Link href="/" className="mast mast-link">
        <div className="mast-name">The Long Council</div>
        <div className="mast-tag">History&apos;s counsel on today&apos;s questions</div>
      </Link>

      <nav className="nav">
        <Link href="/council" className="nav-link">The Council</Link>
        <Link href="/archive" className="nav-link nav-active">The Archive</Link>
        <Link href="/about" className="nav-link">About</Link>
        <Link href="/" className="nav-raise">Raise an issue</Link>
      </nav>

      <div className="archive-hd">
        <h2>The Archive</h2>
        <p>
          Every issue the council has considered. Before raising a new question,
          you may find it has already been addressed here.
        </p>
        <input
          className="archive-search"
          type="text"
          placeholder="Search past issues..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="archive-error">
          Something went wrong loading the archive. Please try again in a moment.
        </div>
      )}

      {!error && sessions.length === 0 && (
        <div className="archive-empty">
          <p>The archive is empty.</p>
          <p className="archive-empty-sub">
            <Link href="/">Raise the first issue →</Link>
          </p>
        </div>
      )}

      {!error && sessions.length > 0 && visible.length === 0 && (
        <div className="archive-empty">
          <p>No past issues match your search.</p>
        </div>
      )}

      {visible.length > 0 && (
        <div className="archive-timeline">
          <div className="timeline-rail">
            {visible.map((session, i) => (
              <TimelineEntry
                key={session.id}
                session={session}
                isFirst={i === 0}
              />
            ))}
          </div>
        </div>
      )}

      <footer>
        © The Long Council · AI-generated counsel from historical figures · Not advice
      </footer>

      <style jsx>{`
        .archive-hd {
          max-width: 680px;
          margin: 0 auto 2rem;
          padding: 0 1.25rem;
        }
        .archive-hd h2 {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 28px;
          font-weight: 600;
          color: #0f0f0f;
          margin: 0 0 0.5rem;
          line-height: 1.2;
        }
        .archive-hd p {
          font-family: 'Crimson Pro', Georgia, serif;
          font-size: 16px;
          line-height: 1.6;
          color: #2a2a2a;
          margin: 0 0 1.5rem;
          max-width: 62ch;
        }
        .archive-search {
          width: 100%;
          max-width: 440px;
          font-family: 'Crimson Pro', Georgia, serif;
          font-size: 14px;
          padding: 10px 14px;
          background: #fdfbf6;
          border: 0.5px solid #c4bfb6;
          border-radius: 2px;
          color: #2a2a2a;
          outline: none;
          transition: border-color 0.2s ease;
        }
        .archive-search:focus {
          border-color: #6b1a1a;
        }
        .archive-search::placeholder {
          color: #9a9388;
          font-style: italic;
        }

        .archive-error,
        .archive-empty {
          max-width: 680px;
          margin: 3rem auto;
          padding: 0 1.25rem;
          text-align: center;
          font-family: 'Crimson Pro', Georgia, serif;
          color: #7a7a7a;
          font-size: 15px;
        }
        .archive-empty p {
          margin: 0.25rem 0;
        }
        .archive-empty-sub :global(a) {
          color: #6b1a1a;
          text-decoration: none;
        }
        .archive-empty-sub :global(a:hover) {
          text-decoration: underline;
        }

        .archive-timeline {
          max-width: 680px;
          margin: 0 auto;
          padding: 0 1.25rem;
        }
        .timeline-rail {
          position: relative;
          padding-left: 44px;
        }
        .timeline-rail::before {
          content: "";
          position: absolute;
          left: 17px;
          top: 8px;
          bottom: 8px;
          width: 1px;
          background: #b8ad9c;
          z-index: 0;
        }
      `}</style>
    </>
  );
}

// ── One session in the timeline ─────────────────────────────────────────
function TimelineEntry({ session, isFirst }) {
  const memberChips = session.member_names.map((name, i) => ({
    name,
    framer: isFramer(name),
  }));

  return (
    <Link href={`/archive/${session.slug}`} className="entry-link">
      <div className="entry">
        <div className={`entry-dot ${isFirst ? 'entry-dot-new' : ''}`}>
          {getDayOfMonth(session.created_at)}
        </div>
        <div className="entry-meta">
          {formatDate(session.created_at)}
        </div>
        <div className="entry-title">
          {session.original_issue}
        </div>
        {session.teaser && (
          <div className="entry-teaser">{session.teaser}</div>
        )}
        {memberChips.length > 0 && (
          <div className="entry-members">
            {memberChips.map((m, i) => (
              <span
                key={i}
                className={`member-chip ${m.framer ? 'chip-framer' : 'chip-practitioner'}`}
              >
                {m.name}
              </span>
            ))}
          </div>
        )}
      </div>

      <style jsx>{`
       .entry-link,
        .entry-link :global(*) {
          text-decoration: none !important;
          color: inherit;
        }
        .entry-link {
          display: block;
        }
        .entry {
          position: relative;
          margin-bottom: 2.25rem;
          padding: 0.5rem 0;
          transition: opacity 0.2s ease;
        }
        .entry-link:hover .entry {
          opacity: 0.78;
        }
        .entry-dot {
          position: absolute;
          left: -36px;
          top: 4px;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          background: #f8f6f2;
          color: #2a2a2a;
          border: 1px solid #b8ad9c;
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 10px;
          display: flex;
          align-items: center;
          justify-content: center;
          box-shadow: 0 0 0 2px #f8f6f2;
          z-index: 2;
        }
        .entry-dot-new {
          background: #0f0f0f;
          color: #f8f6f2;
          border-color: #0f0f0f;
        }
        .entry-meta {
          font-family: 'Crimson Pro', Georgia, serif;
          font-size: 11px;
          color: #7a7a7a;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 4px;
        }
        .entry-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 18px;
          color: #0f0f0f;
          font-weight: 600;
          line-height: 1.4;
          margin-bottom: 6px;
          max-width: 62ch;
        }
        .entry-teaser {
          font-family: 'Crimson Pro', Georgia, serif;
          font-size: 14.5px;
          color: #2a2a2a;
          font-style: italic;
          line-height: 1.55;
          max-width: 62ch;
          margin-bottom: 10px;
        }
        .entry-members {
          display: flex;
          gap: 6px;
          flex-wrap: wrap;
        }
        .member-chip {
          font-family: 'Crimson Pro', Georgia, serif;
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 2px;
          white-space: nowrap;
        }
        .chip-practitioner {
          background: #fdf5ec;
          color: #6b1a1a;
          border: 1px solid #c4897a;
        }
        .chip-framer {
          background: #edf4ed;
          color: #2a3a2a;
          border: 1px solid #7a9a7a;
        }

        @media (min-width: 768px) {
          .entry-title { font-size: 19px; }
          .entry-teaser { font-size: 15px; }
        }
      `}</style>
    </Link>
  );
}
