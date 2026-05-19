import { useState, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';

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

function extractTeaser(cards) {
  if (!cards || !cards.verdict) return '';
  const match = cards.verdict.match(/##\s*Verdict\s*\n+([^\n#]+(?:\n[^\n#]+)*)/i);
  if (!match) return '';
 const firstPara = match[1].trim().split(/\n\s*\n/)[0].replace(/\s+/g, ' ').trim();
  if (firstPara.length > 240) {
    const trimmed = firstPara.substring(0, 240);
    const lastPeriod = trimmed.lastIndexOf('.');
    return lastPeriod > 100 ? trimmed.substring(0, lastPeriod + 1) : trimmed + '…';
  }
  return firstPara;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function stripTierSuffix(name) {
  if (!name) return '';
  return name.replace(/\s*[—–-]\s*(Practitioner|Framer|Leader|Thinker|Wildcard)\s*$/i, '').trim();
}

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
        <meta name="description" content="Every issue the council has considered — past debates from history's greatest minds." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="The Archive — The Long Council" />
        <meta property="og:description" content="Every issue the council has considered — past debates from history's greatest minds." />
        <meta property="og:url" content="https://www.thelongcouncil.com/archive" />
        <meta property="og:image" content="https://www.thelongcouncil.com/og-default.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="The Long Council — History's counsel on today's questions" />
        <meta property="og:site_name" content="The Long Council" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="The Archive — The Long Council" />
        <meta name="twitter:description" content="Every issue the council has considered — past debates from history's greatest minds." />
        <meta name="twitter:image" content="https://www.thelongcouncil.com/og-default.png" />
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
        <p>Every issue the council has considered. Before raising a new question, you may find it has already been addressed here.</p>
        <input
          className="archive-search"
          type="text"
          placeholder="Search past issues..."
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
      </div>

      {error && (
        <div className="archive-error">Something went wrong loading the archive. Please try again in a moment.</div>
      )}

      {!error && sessions.length === 0 && (
        <div className="archive-empty">
          <p>The archive is empty.</p>
          <p className="archive-empty-sub"><Link href="/">Raise the first issue →</Link></p>
        </div>
      )}

      {!error && sessions.length > 0 && visible.length === 0 && (
        <div className="archive-empty"><p>No past issues match your search.</p></div>
      )}

      {visible.length > 0 && (
        <div className="archive-timeline">
          <div className="timeline-rail">
            {visible.map((session) => (
              <TimelineEntry key={session.id} session={session} />
            ))}
          </div>
        </div>
      )}

      <footer>The Long Council · Counsel from history&apos;s greatest minds, brought to life by AI</footer>

      <style jsx>{`
        .archive-hd { max-width: 680px; margin: 0 auto 2rem; padding: 0 1.25rem; }
        .archive-hd h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 600; color: #0f0f0f; margin: 0 0 0.5rem; line-height: 1.2; }
        .archive-hd p { font-family: 'Crimson Pro', Georgia, serif; font-size: 16px; line-height: 1.6; color: #2a2a2a; margin: 0 0 1.5rem; max-width: 62ch; }
        .archive-search { width: 100%; max-width: 440px; font-family: 'Crimson Pro', Georgia, serif; font-size: 14px; padding: 10px 14px; background: #fdfbf6; border: 0.5px solid #c4bfb6; border-radius: 2px; color: #2a2a2a; outline: none; transition: border-color 0.2s ease; }
        .archive-search:focus { border-color: #6b1a1a; }
        .archive-search::placeholder { color: #9a9388; font-style: italic; }
        .archive-error, .archive-empty { max-width: 680px; margin: 3rem auto; padding: 0 1.25rem; text-align: center; font-family: 'Crimson Pro', Georgia, serif; color: #7a7a7a; font-size: 15px; }
        .archive-empty p { margin: 0.25rem 0; }
        .archive-empty-sub :global(a) { color: #6b1a1a; text-decoration: none; }
        .archive-empty-sub :global(a:hover) { text-decoration: underline; }
        .archive-timeline { max-width: 680px; margin: 0 auto; padding: 0 1.25rem; }
        .timeline-rail { position: relative; }
      `}</style>
    </>
  );
}

function TimelineEntry({ session }) {
  return (
    <div className="entry">
      <div className="entry-meta">{formatDate(session.created_at)}</div>
      <Link href={`/archive/${session.slug}`} className="entry-title-link">
        <h3 className="entry-title">{session.original_issue}</h3>
      </Link>
      {session.teaser && (
        <div className="entry-teaser">{session.teaser}</div>
      )}
      {session.member_names.length > 0 && (
        <div className="entry-members">
          {session.member_names.map((name, i) => (
            <span key={i} className="member-chip">{stripTierSuffix(name)}</span>
          ))}
        </div>
      )}

      <style jsx>{`
        .entry { position: relative; margin-bottom: 2.25rem; padding: 0.5rem 0; }
        .entry-meta { font-family: 'Crimson Pro', Georgia, serif; font-size: 11px; color: #7a7a7a; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 4px; }
        .entry-title-link, .entry-title-link :global(h3) { display: inline-block; text-decoration: none !important; color: inherit; transition: opacity 0.2s ease; }
        .entry-title-link:hover { opacity: 0.7; }
        .entry-title { font-family: 'Playfair Display', Georgia, serif; font-size: 18px; color: #0f0f0f; font-weight: 600; line-height: 1.4; margin: 0 0 6px 0; max-width: 62ch; }
        .entry-teaser { font-family: 'Crimson Pro', Georgia, serif; font-size: 14.5px; color: #2a2a2a; font-style: italic; line-height: 1.55; max-width: 62ch; margin-bottom: 10px; }
        .entry-members { display: flex; gap: 6px; flex-wrap: wrap; }
        .member-chip { font-family: 'Crimson Pro', Georgia, serif; font-size: 11px; padding: 2px 8px; border-radius: 2px; white-space: nowrap; background: #f5f1e8; color: #4a4a4a; border: 0.5px solid #d4cfc8; }
        @media (min-width: 768px) { .entry-title { font-size: 19px; } .entry-teaser { font-size: 15px; } }
      `}</style>
    </div>
  );
}
