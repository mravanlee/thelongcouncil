import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { supabase } from '../../lib/supabase';

const PAGE_SIZE = 25;
const SCROLL_KEY = 'archive_scroll_y';

export async function getServerSideProps(ctx) {
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, slug, original_issue, sharpened_issue, member_names, member_types, created_at, cards, featured_quote, featured_quote_member')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[archive] Failed to load sessions:', error);
    return { props: { sessions: [], error: error.message, initialFilters: { q: '', theme: null } } };
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
    featured_quote: s.featured_quote || null,
    featured_quote_member: s.featured_quote_member || null,
  }));

  const initialFilters = {
    q: typeof ctx.query.q === 'string' ? ctx.query.q : '',
    theme: typeof ctx.query.theme === 'string' ? ctx.query.theme : null,
  };

  return { props: { sessions: enriched, error: null, initialFilters } };
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

// Mirror of council.js — keep in sync. Lets us link an archive member
// chip to the matching council card anchor even when the session stored
// only a short name ("Machiavelli" → "niccolo_machiavelli").
const AVATAR_NAME_EXPANSIONS = {
  'machiavelli': 'niccolo_machiavelli',
  'keynes': 'john_maynard_keynes',
  'hayek': 'friedrich_hayek',
  'friedman': 'milton_friedman',
  'locke': 'john_locke',
  'rousseau': 'jean_jacques_rousseau',
  'rawls': 'john_rawls',
  'arendt': 'hannah_arendt',
  'sen': 'amartya_sen',
  'hirschman': 'albert_hirschman',
  'fanon': 'frantz_fanon',
  'prebisch': 'raul_prebisch',
  'ostrom': 'elinor_ostrom',
  'bolivar': 'simon_bolivar',
};

function memberToCouncilSlug(name) {
  if (!name) return '';
  const base = stripTierSuffix(name)
    .replace(/\s*\([^)]*\)/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return AVATAR_NAME_EXPANSIONS[base] || base;
}

// Theme → keywords for the tag-chip filter. Each keyword is matched at word-start
// (\b<kw>) so "democra" hits "democracy"/"democratic" but not "epidemic".
// Acronyms with `acronyms` require word boundaries on both sides to avoid
// false positives (e.g. "AI" should not match "Britain", "Maathai").
const THEMES = [
  { label: 'Democracy', keywords: ['democra', 'polaris', 'polariser', 'election', 'electie', 'verkiezing', 'parlement', 'citizen', 'voter', 'vote', 'debate', 'civic', 'rechtsstaat', 'jetten'] },
  { label: 'Geopolitics', keywords: ['geopoli', 'foreign policy', 'sanction', 'alliance', 'autonom', 'sovereign', 'diplomacy', 'kissinger', 'henry kissinger'], acronyms: ['NATO', 'UN'] },
  { label: 'Economy', keywords: ['econom', 'trade', 'handel', 'tariff', 'wealth', 'recession', 'inflation', 'export', 'import', 'monetary', 'fiscal', 'market', 'capital', 'industrial'], acronyms: ['GDP'] },
  { label: 'Europe', keywords: ['europe', 'europ', 'brussels', 'eurozone', 'britain', 'german', 'french', 'italy', 'spain', 'adenauer', 'schmidt', 'monnet', 'de gaulle'], acronyms: ['EU'] },
  { label: 'China', keywords: ['china', 'chinese', 'asia', 'asian', 'beijing', 'taiwan', 'japan', 'korea', 'singapore', 'india', 'mahathir', 'lee kuan', 'deng', 'confucius', 'sun tzu'] },
  { label: 'War', keywords: ['military', 'conflict', 'security', 'defense', 'defence', 'ukraine', 'russia', 'israel', 'gaza', 'warfare', 'sun tzu', 'churchill'], acronyms: ['NATO'] },
  { label: 'Climate', keywords: ['climat', 'energy', 'oil', 'renewable', 'emission', 'carbon', 'fossil', 'groningen', 'sustainab', 'green', 'maathai'] },
  { label: 'AI', keywords: ['artificial intelligence', 'technolog', 'semiconduct', 'algorithm', 'internet', 'social media', 'silicon'], acronyms: ['AI', 'ASML'] },
  { label: 'Netherlands', keywords: ['nederland', 'dutch', 'netherlands', 'jetten', 'groningen', 'curaçao', 'rutte', 'amsterdam', 'haag', 'wilders'], acronyms: ['ASML'] },
];

function escapeRegex(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

const THEME_REGEX = Object.fromEntries(
  THEMES.map(t => {
    const parts = [];
    (t.keywords || []).forEach(k => parts.push('\\b' + escapeRegex(k.toLowerCase())));
    (t.acronyms || []).forEach(a => parts.push('\\b' + escapeRegex(a.toLowerCase()) + '\\b'));
    return [t.label, new RegExp('(' + parts.join('|') + ')', 'i')];
  })
);

export default function Archive({ sessions, error, initialFilters }) {
  const router = useRouter();
  const [search, setSearch] = useState(initialFilters?.q || '');
  const [activeTheme, setActiveTheme] = useState(initialFilters?.theme || null);
  const [page, setPage] = useState(1);

  // Sync state → URL (debounced for search to avoid history spam while typing)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = setTimeout(() => {
      const newQuery = {};
      if (search.trim()) newQuery.q = search.trim();
      if (activeTheme) newQuery.theme = activeTheme;

      const currentRelevant = {};
      ['q', 'theme'].forEach(k => {
        if (router.query[k]) currentRelevant[k] = router.query[k];
      });
      if (JSON.stringify(currentRelevant) === JSON.stringify(newQuery)) return;

      router.replace({ pathname: '/archive', query: newQuery }, undefined, { shallow: true });
    }, 200);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search, activeTheme]);

  // Sync URL → state on browser back/forward
  useEffect(() => {
    const handleRouteChange = (url) => {
      const qs = url.split('?')[1] || '';
      const params = new URLSearchParams(qs);
      const nextQ = params.get('q') || '';
      const nextTheme = params.get('theme') || null;
      setSearch(prev => prev !== nextQ ? nextQ : prev);
      setActiveTheme(prev => prev !== nextTheme ? nextTheme : prev);
    };
    router.events.on('routeChangeComplete', handleRouteChange);
    return () => router.events.off('routeChangeComplete', handleRouteChange);
  }, [router.events]);

  // Reset pagination when filters change
  useEffect(() => { setPage(1); }, [search, activeTheme]);

  // Scroll position memory: when leaving the archive, remember scrollY in
  // sessionStorage. When mounting (page reload OR returning via back button),
  // restore it. Skips restoring if a filter was applied via URL — in that case
  // the user is navigating to a fresh view and should start at the top.
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasUrlFilter = !!(router.query.q || router.query.theme);
    if (!hasUrlFilter) {
      const saved = sessionStorage.getItem(SCROLL_KEY);
      if (saved) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() => window.scrollTo({ top: parseInt(saved, 10), behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' }));
        });
      }
    }
    const save = () => sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    window.addEventListener('beforeunload', save);
    const handleRouteChangeStart = () => save();
    router.events.on('routeChangeStart', handleRouteChangeStart);
    return () => {
      window.removeEventListener('beforeunload', save);
      router.events.off('routeChangeStart', handleRouteChangeStart);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    return sessions.filter(s => {
      const haystack = [s.original_issue, s.sharpened_issue, s.teaser, s.featured_quote, ...(s.member_names || [])]
        .filter(Boolean).join(' ').toLowerCase();
      if (q && !haystack.includes(q)) return false;
      if (activeTheme && !THEME_REGEX[activeTheme]?.test(haystack)) return false;
      return true;
    });
  }, [sessions, search, activeTheme]);

  const paginated = visible.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length > paginated.length;

  const hasActiveFilter = !!(search.trim() || activeTheme);
  const countLabel = hasActiveFilter
    ? `${visible.length} of ${sessions.length} issues`
    : `${sessions.length} issues`;

  function onSearchChange(value) {
    setSearch(value);
    if (value && activeTheme) setActiveTheme(null);
  }

  function onThemeClick(label) {
    if (activeTheme === label) {
      setActiveTheme(null);
    } else {
      setActiveTheme(label);
      setSearch('');
    }
  }

  function onMemberClick(name) {
    const slug = memberToCouncilSlug(name);
    if (!slug) return;
    router.push(`/council#m-${slug}`);
  }

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
      </div>

      <div className="archive-toolbar">
        <div className="toolbar-inner">
          <div className="search-row">
            <div className="search-wrap">
              <svg className="search-icon" viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
                <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.25"/>
                <line x1="10.6" y1="10.6" x2="14" y2="14" stroke="currentColor" strokeWidth="1.25" strokeLinecap="round"/>
              </svg>
              <input
                className="archive-search"
                type="text"
                placeholder="Search past issues..."
                value={search}
                onChange={e => onSearchChange(e.target.value)}
                aria-label="Search archive"
              />
            </div>
            <div className="archive-count">{countLabel}</div>
          </div>
          <div className="tag-block">
            {THEMES.map(t => (
              <button
                key={t.label}
                className={`tag-chip${activeTheme === t.label ? ' active' : ''}`}
                onClick={() => onThemeClick(t.label)}
                aria-pressed={activeTheme === t.label}
                type="button"
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
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
        <div className="archive-empty">
          <p>No issues match your filter.</p>
          <p className="archive-empty-sub"><Link href="/">Raise this issue yourself →</Link></p>
        </div>
      )}

      {paginated.length > 0 && (
        <div className="archive-list">
          {paginated.map((session) => (
            <ArchiveEntry
              key={session.id}
              session={session}
              onMemberClick={onMemberClick}
            />
          ))}
          {hasMore && (
            <button className="load-more" onClick={() => setPage(p => p + 1)} type="button">
              Load older issues  ({visible.length - paginated.length} remaining)
            </button>
          )}
        </div>
      )}

      <footer>The Long Council · Counsel from history&apos;s greatest minds, brought to life by AI</footer>

      <style jsx>{`
        .archive-hd { max-width: 680px; margin: 0 auto 1.25rem; padding: 0 1.25rem; }
        .archive-hd h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 28px; font-weight: 600; color: #0f0f0f; margin: 0 0 0.5rem; line-height: 1.2; }
        .archive-hd p { font-family: 'Crimson Pro', Georgia, serif; font-size: 16px; line-height: 1.6; color: #2a2a2a; margin: 0; max-width: 62ch; }

        /* Toolbar: matches body bg exactly, no border, no backdrop-filter. */
        .archive-toolbar { padding: 0.5rem 1.25rem 0.5rem; margin-bottom: 2.5rem; background: #f8f6f2; }
        .toolbar-inner { max-width: 680px; margin: 0 auto; }
        @media (min-width: 641px) {
          .archive-toolbar { position: sticky; top: 0; z-index: 10; }
        }
        @media (max-width: 640px) {
          /* On mobile, only the search row sticks — themes scroll away with the rest of the header */
          .search-row { position: sticky; top: 0; z-index: 10; background: #f8f6f2; padding: 0.6rem 0; margin: -0.6rem 0 0.6rem; }
        }
        .search-row { display: flex; align-items: center; gap: 0.75rem; }
        .search-wrap { position: relative; flex: 1; min-width: 0; }
        .search-icon { position: absolute; left: 14px; top: 50%; transform: translateY(-50%); width: 14px; height: 14px; color: #9a9388; pointer-events: none; }
        .archive-search { width: 100%; box-sizing: border-box; font-family: 'Crimson Pro', Georgia, serif; font-size: 14px; padding: 9px 14px 9px 38px; background: #fdfbf6; border: 0.5px solid #c4bfb6; border-radius: 2px; color: #2a2a2a; outline: none; transition: border-color 0.2s ease; }
        .archive-search:focus { border-color: #6b1a1a; }
        .archive-search::placeholder { color: #9a9388; font-style: italic; }
        .archive-count { font-family: 'Crimson Pro', Georgia, serif; font-size: 12px; color: #7a7a7a; letter-spacing: 0.04em; white-space: nowrap; }

        .tag-block { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 0.75rem; }
        .tag-chip { font-family: 'Crimson Pro', Georgia, serif; font-size: 11px; letter-spacing: 0.1em; text-transform: uppercase; padding: 8px 14px; background: transparent; border: 0.5px solid #c4bfb6; color: #2a2a2a; border-radius: 2px; cursor: pointer; transition: all 0.15s ease; white-space: nowrap; }
        .tag-chip:hover { border-color: #6b1a1a; color: #6b1a1a; }
        .tag-chip.active { background: #6b1a1a; color: #faf7f0; border-color: #6b1a1a; }

        .archive-error, .archive-empty { max-width: 680px; margin: 3rem auto; padding: 0 1.25rem; text-align: center; font-family: 'Crimson Pro', Georgia, serif; color: #7a7a7a; font-size: 15px; }
        .archive-empty p { margin: 0.25rem 0; }
        .archive-empty-sub :global(a) { color: #6b1a1a; text-decoration: none; }
        .archive-empty-sub :global(a:hover) { text-decoration: underline; }

        .archive-list { max-width: 680px; margin: 0 auto; padding: 0 1.25rem 4rem; }

        .load-more { display: block; margin: 2rem auto 0; font-family: 'Crimson Pro', Georgia, serif; font-size: 12px; letter-spacing: 0.12em; text-transform: uppercase; padding: 11px 22px; background: transparent; border: 0.5px solid #c4bfb6; color: #2a2a2a; border-radius: 2px; cursor: pointer; transition: all 0.15s ease; }
        .load-more:hover { border-color: #6b1a1a; color: #6b1a1a; }

        @media (max-width: 640px) {
          .archive-hd h2 { font-size: 24px; }
          .archive-hd p { font-size: 15px; }
          .search-row { flex-direction: column; align-items: stretch; gap: 6px; }
          .archive-count { text-align: right; }
          .tag-block { gap: 6px; }
          .tag-chip { font-size: 10px; padding: 6px 10px; letter-spacing: 0.08em; }
        }
      `}</style>
    </>
  );
}

function ArchiveEntry({ session, onMemberClick }) {
  return (
    <article className="archive-entry">
      <Link href={`/archive/${session.slug}`} className="entry-link">
        <div className="entry-meta">{formatDate(session.created_at)}</div>
        <h3 className="entry-title">{session.original_issue}</h3>
        {session.teaser && (
          <p className="entry-teaser"><span className="verdict-label">Verdict —</span> {session.teaser}</p>
        )}
      </Link>
      {session.member_names.length > 0 && (
        <div className="entry-members">
          {session.member_names.map((name, i) => {
            const clean = stripTierSuffix(name);
            return (
              <button
                key={i}
                className="member-chip"
                onClick={() => onMemberClick(clean)}
                aria-label={`View ${clean} on the council page`}
                type="button"
              >
                {clean}
              </button>
            );
          })}
        </div>
      )}

      <style jsx>{`
        .archive-entry { display: block; margin-bottom: 2.5rem; }
        .archive-entry:last-child { margin-bottom: 1rem; }
        .entry-link { display: block; text-decoration: none; color: inherit; padding: 0.25rem 0 0; margin-bottom: 14px; transition: color 0.15s ease; }
        .entry-meta { font-family: 'Crimson Pro', Georgia, serif; font-size: 11px; color: #4a4a4a; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 6px; }
        .entry-title { font-family: 'Playfair Display', Georgia, serif; font-size: 20px; color: #0f0f0f; font-weight: 600; line-height: 1.35; margin: 0 0 10px 0; max-width: 62ch; text-decoration: underline; text-decoration-color: transparent; text-decoration-thickness: 1.5px; text-underline-offset: 4px; transition: text-decoration-color 0.18s ease, color 0.18s ease; }
        .entry-link:hover .entry-title { color: #6b1a1a; text-decoration-color: #6b1a1a; }
        .entry-teaser { font-family: 'Crimson Pro', Georgia, serif; font-size: 16px; color: #1a1a1a; line-height: 1.55; margin: 0; }
        .verdict-label { color: #6b1a1a; letter-spacing: 0.12em; text-transform: uppercase; font-size: 13px; margin-right: 4px; }
        .entry-members { display: flex; flex-wrap: wrap; gap: 6px; }
        .member-chip { font-family: 'Crimson Pro', Georgia, serif; font-size: 11px; padding: 2px 8px; border-radius: 2px; white-space: nowrap; background: #f5f1e8; color: #4a4a4a; border: 0.5px solid #d4cfc8; cursor: pointer; transition: all 0.15s ease; }
        .member-chip:hover { background: rgba(107, 26, 26, 0.08); border-color: #6b1a1a; color: #6b1a1a; }

        @media (max-width: 640px) {
          .archive-entry { margin-bottom: 1.75rem; }
          .entry-title { font-size: 18px; }
          .entry-teaser { font-size: 15px; }
          .entry-meta { font-size: 11px; }
          .verdict-label { font-size: 12px; letter-spacing: 0.1em; }
          .member-chip { font-size: 10.5px; padding: 2px 7px; }
        }
      `}</style>
    </article>
  );
}
