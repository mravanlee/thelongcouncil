import { useState, useEffect, useMemo } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { Search } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { resolveAvatarSlug } from '../../lib/avatarSlugs';
import { SERIF, SiteFooter, SiteHeader } from '../../components/SiteChrome';
import { ARCHIVE_THEMES, SESSION_THEMES } from '../../lib/archiveThemes';

const PAGE_SIZE = 25;
const SCROLL_KEY = 'archive_scroll_y';

// "Featured Debates" — a manually curated, representative selection shown as the
// "Start Here" section. Edit this list to recurate. Slugs only; rendered with
// the existing card. Missing slugs are silently skipped.
const FEATURED_SLUGS = [
  'hoe-versterken-we-democratie-aqkx',
  'eu-reduce-dependency-us-chinese-ai-4594',
  'china-surpass-us-economic-output-technological-0x1t',
  'china-invades-taiwan-us-protect-taiwan-dlbh',
  'hoe-zou-de-welvaart-tussen-burgers-vmyl',
  'ai-regulated-hmhh',
  'eu-build-unified-military-force-vj6s',
  'rise-trump-predicted-before-happened-history-mrq5',
];

export async function getServerSideProps(ctx) {
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select(
      'id, slug, original_issue, sharpened_issue, member_names, member_types, created_at, cards, featured_quote, featured_quote_member',
    )
    .order('created_at', { ascending: false });

  if (error) {
    console.error('[archive] Failed to load sessions:', error);
    return {
      props: { sessions: [], error: error.message, initialFilters: { q: '', theme: null } },
    };
  }

  const enriched = (sessions || []).map((s) => ({
    id: s.id,
    slug: s.slug,
    original_issue: s.original_issue,
    // English-first headline: translated question when the original was in
    // another language, otherwise the original. Used for display + SEO.
    display_issue: (s.cards && s.cards.question_en) || s.original_issue,
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

function memberToCouncilSlug(name) {
  if (!name) return '';
  const base = stripTierSuffix(name)
    .replace(/\s*\([^)]*\)/g, '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return resolveAvatarSlug(base);
}

// Themes are derived from the archive's own embeddings (semantic clusters,
// multi-label per debate) — see scripts/generate-themes.mjs → lib/archiveThemes.js.
// This just reads the precomputed assignment; not hardcoded keywords.
function themesForSession(session) {
  return SESSION_THEMES[session.slug] || [];
}

export default function Archive({ sessions, error, initialFilters }) {
  const router = useRouter();
  const [search, setSearch] = useState(initialFilters?.q || '');
  const [activeTheme, setActiveTheme] = useState(initialFilters?.theme || null);
  const [page, setPage] = useState(1);

  // CollectionPage + ItemList of recent sessions. Limit to 50 to keep the
  // JSON-LD payload reasonable; the full set is always in the sitemap.
  const archiveJsonLd = useMemo(() => ({
    '@context': 'https://schema.org',
    '@type': 'CollectionPage',
    '@id': 'https://www.thelongcouncil.com/archive#collection',
    name: 'The Archive',
    description: 'Browse the questions history\'s sharpest minds have debated. Filter by theme or search for a topic.',
    url: 'https://www.thelongcouncil.com/archive',
    inLanguage: 'en',
    isPartOf: {
      '@type': 'WebSite',
      '@id': 'https://www.thelongcouncil.com/#website',
      name: 'The Long Council',
      url: 'https://www.thelongcouncil.com',
    },
    mainEntity: {
      '@type': 'ItemList',
      numberOfItems: sessions.length,
      itemListElement: sessions.slice(0, 50).map((s, i) => ({
        '@type': 'ListItem',
        position: i + 1,
        url: `https://www.thelongcouncil.com/archive/${s.slug}`,
        item: {
          '@type': 'Article',
          '@id': `https://www.thelongcouncil.com/archive/${s.slug}#article`,
          url: `https://www.thelongcouncil.com/archive/${s.slug}`,
          headline: s.display_issue,
          datePublished: s.created_at,
        },
      })),
    },
  }), [sessions]);

  // Sync state → URL (debounced)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const t = setTimeout(() => {
      const newQuery = {};
      if (search.trim()) newQuery.q = search.trim();
      if (activeTheme) newQuery.theme = activeTheme;

      const currentRelevant = {};
      ['q', 'theme'].forEach((k) => {
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
      setSearch((prev) => (prev !== nextQ ? nextQ : prev));
      setActiveTheme((prev) => (prev !== nextTheme ? nextTheme : prev));
    };
    router.events.on('routeChangeComplete', handleRouteChange);
    return () => router.events.off('routeChangeComplete', handleRouteChange);
  }, [router.events]);

  useEffect(() => {
    setPage(1);
  }, [search, activeTheme]);

  // Scroll position memory
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const hasUrlFilter = !!(router.query.q || router.query.theme);
    if (!hasUrlFilter) {
      const saved = sessionStorage.getItem(SCROLL_KEY);
      if (saved) {
        requestAnimationFrame(() => {
          requestAnimationFrame(() =>
            window.scrollTo({ top: parseInt(saved, 10), behavior: 'instant' in document.documentElement.style ? 'instant' : 'auto' }),
          );
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
    return sessions.filter((s) => {
      // Search still includes member names so users can find sessions by speaker.
      const searchHay = [s.display_issue, s.original_issue, s.sharpened_issue, s.teaser, s.featured_quote, ...(s.member_names || [])]
        .filter(Boolean).join(' ').toLowerCase();
      if (q && !searchHay.includes(q)) return false;
      // Theme filter uses the derived multi-label assignment.
      if (activeTheme && !(SESSION_THEMES[s.slug] || []).includes(activeTheme)) return false;
      return true;
    });
  }, [sessions, search, activeTheme]);

  // Curated "Featured Debates", in the order listed, skipping any missing slug.
  const featured = useMemo(() => {
    const bySlug = new Map(sessions.map((s) => [s.slug, s]));
    return FEATURED_SLUGS.map((slug) => bySlug.get(slug)).filter(Boolean);
  }, [sessions]);

  // Debate count per theme (a debate can count toward several).
  const themeCounts = useMemo(() => {
    const counts = Object.fromEntries(ARCHIVE_THEMES.map((l) => [l, 0]));
    sessions.forEach((s) => (SESSION_THEMES[s.slug] || []).forEach((l) => { if (l in counts) counts[l]++; }));
    return counts;
  }, [sessions]);

  const paginated = visible.slice(0, page * PAGE_SIZE);
  const hasMore = visible.length > paginated.length;

  const hasActiveFilter = !!(search.trim() || activeTheme);
  const countLabel = hasActiveFilter
    ? `${visible.length} of ${sessions.length} sessions`
    : `${sessions.length} sessions`;

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
      if (typeof document !== 'undefined') {
        document.getElementById('full-archive')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
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
        <meta
          name="description"
          content="Browse the questions history's sharpest minds have debated. Filter by theme or search for a topic."
        />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="The Archive — The Long Council" />
        <meta
          property="og:description"
          content="Browse the questions history's sharpest minds have debated. Filter by theme or search for a topic."
        />
        <meta property="og:url" content="https://www.thelongcouncil.com/archive" />
        <meta property="og:image" content="https://www.thelongcouncil.com/og-default.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta
          property="og:image:alt"
          content="The Long Council: every session of the council"
        />
        <meta property="og:site_name" content="The Long Council" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="The Archive — The Long Council" />
        <meta
          name="twitter:description"
          content="Browse the questions history's sharpest minds have debated. Filter by theme or search for a topic."
        />
        <meta name="twitter:image" content="https://www.thelongcouncil.com/og-default.png" />
        <link rel="canonical" href="https://www.thelongcouncil.com/archive" />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(archiveJsonLd) }}
        />
      </Head>

      <div className="min-h-screen bg-background text-foreground antialiased">
        <SiteHeader />

        {/* Page title */}
        <section className="border-b border-border/70">
          <div className="mx-auto max-w-5xl px-6 pt-16 pb-10 lg:pt-20">
            <div className="text-[11px] tracking-[0.22em] uppercase text-primary">
              The Archive
            </div>
            <h1
              className="mt-4 text-[32px] leading-[1.12] tracking-tight text-foreground [text-wrap:balance] sm:text-5xl sm:leading-[1.1]"
              style={SERIF}
            >
              <span className="whitespace-nowrap">The questions.</span>{' '}
              <span className="whitespace-nowrap">The debates.</span>{' '}
              <span className="whitespace-nowrap">The verdicts.</span>
            </h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              Explore every session of The Long Council.
            </p>
          </div>
        </section>

        {/* SECTION 2: Featured Debates — the "Start Here" layer */}
        {featured.length > 0 && (
          <section className="border-b border-border/70">
            <div className="mx-auto max-w-5xl px-6 py-12">
              <div className="text-[11px] tracking-[0.22em] uppercase text-primary">Featured Debates</div>
              <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                A curated selection of some of the council&apos;s most important and representative debates.
              </p>
              <ol className="mt-6 divide-y divide-border/70 border-y border-border/70">
                {featured.map((session) => (
                  <ArchiveEntry
                    key={session.id}
                    session={session}
                    themes={themesForSession(session)}
                    onMemberClick={onMemberClick}
                  />
                ))}
              </ol>
            </div>
          </section>
        )}

        {/* SECTION 3: Explore by Theme — derived clusters; clicking filters the archive */}
        <section className="border-b border-border/70">
          <div className="mx-auto max-w-5xl px-6 py-12">
            <div className="text-[11px] tracking-[0.22em] uppercase text-primary">Explore by Theme</div>
            <p className="mt-3 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
              Navigate the archive by the ideas and tensions that recur across debates.
            </p>
            <div className="mt-6 flex flex-wrap gap-2">
              {ARCHIVE_THEMES.map((label) => {
                const active = activeTheme === label;
                return (
                  <button
                    key={label}
                    type="button"
                    onClick={() => onThemeClick(label)}
                    aria-pressed={active}
                    className={`rounded-sm border px-3 py-1.5 text-[11px] tracking-[0.14em] uppercase transition ${
                      active
                        ? 'border-primary bg-primary text-primary-foreground'
                        : 'border-border bg-card text-muted-foreground hover:text-foreground hover:border-foreground/40'
                    }`}
                  >
                    {label} <span className="ml-1 opacity-60">{themeCounts[label] || 0}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* SECTION 4: Full Archive — search + every session */}
        <section id="full-archive" className="scroll-mt-4">
          <div className="border-b border-border/70 bg-background/95 backdrop-blur sm:sticky sm:top-0 sm:z-10">
            <div className="mx-auto max-w-5xl px-6 py-4">
              <div className="mb-3 text-[11px] tracking-[0.22em] uppercase text-primary">Full Archive</div>
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                <div className="relative flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                  <input
                    type="text"
                    value={search}
                    onChange={(e) => onSearchChange(e.target.value)}
                    placeholder="Search sessions"
                    className="h-10 w-full rounded-sm border border-border bg-card pl-9 pr-3 text-[14px] text-foreground placeholder:text-muted-foreground/70 focus:border-primary focus:outline-none"
                    aria-label="Search archive"
                  />
                </div>
                <div className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground whitespace-nowrap">
                  {countLabel}
                </div>
              </div>
            </div>
          </div>

          <div className="mx-auto max-w-5xl px-6 py-12">
            {error && (
              <p className="py-20 text-center text-[14px] text-muted-foreground">
                Something went wrong loading the archive. Please try again in a
                moment.
              </p>
            )}

            {!error && sessions.length === 0 && (
              <div className="py-20 text-center text-[14px] text-muted-foreground">
                <p>The archive is empty.</p>
                <p className="mt-2">
                  <Link href="/" className="text-primary hover:text-foreground">
                    Ask the first question →
                  </Link>
                </p>
              </div>
            )}

            {!error && sessions.length > 0 && visible.length === 0 && (
              <div className="py-20 text-center text-[14px] text-muted-foreground">
                <p>No sessions match your filter.</p>
                <p className="mt-2">
                  <Link href="/" className="text-primary hover:text-foreground">
                    Ask this question yourself →
                  </Link>
                </p>
              </div>
            )}

            {paginated.length > 0 && (
              <>
                <ol className="divide-y divide-border/70 border-y border-border/70">
                  {paginated.map((session) => (
                    <ArchiveEntry
                      key={session.id}
                      session={session}
                      themes={themesForSession(session)}
                      onMemberClick={onMemberClick}
                    />
                  ))}
                </ol>
                {hasMore && (
                  <button
                    type="button"
                    onClick={() => setPage((p) => p + 1)}
                    className="mt-10 mx-auto block rounded-sm border border-border bg-card px-5 py-2 text-[11px] tracking-[0.18em] uppercase text-muted-foreground hover:border-primary hover:text-primary transition"
                  >
                    Load older sessions ({visible.length - paginated.length} remaining)
                  </button>
                )}
              </>
            )}
          </div>
        </section>

        <SiteFooter />
      </div>
    </>
  );
}

function ArchiveEntry({ session, themes, onMemberClick }) {
  return (
    <li className="group py-9 transition hover:bg-card/40">
      <Link href={`/archive/${session.slug}`} className="block">
        <div className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
          {formatDate(session.created_at)}
        </div>
        <h2
          className="mt-3 max-w-3xl text-[22px] leading-[1.3] tracking-tight text-foreground transition group-hover:text-primary sm:text-[26px]"
          style={SERIF}
        >
          {session.display_issue}
        </h2>
        {session.teaser && (
          <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-4">
            <span className="shrink-0 text-[11px] tracking-[0.22em] uppercase text-primary">
              Verdict
            </span>
            <p
              className="max-w-3xl text-[16px] leading-[1.5] text-foreground/85"
              style={SERIF}
            >
              {session.teaser}
            </p>
          </div>
        )}
      </Link>

      {themes.length > 0 && (
        <div className="mt-5 flex flex-wrap gap-2">
          {themes.map((t) => (
            <span
              key={t}
              className="rounded-sm border border-border bg-card px-2 py-1 text-[10px] tracking-[0.18em] uppercase text-muted-foreground"
            >
              {t}
            </span>
          ))}
        </div>
      )}
    </li>
  );
}
