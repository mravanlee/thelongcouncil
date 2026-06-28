import { supabase } from '../lib/supabase';
import { THEMES, themeSlug } from '../lib/themes';

const SITE_URL = 'https://www.thelongcouncil.com';

// Static pages with their relative priority and update frequency.
// Priority is a hint to crawlers (0.0–1.0) — higher means more important
// relative to other URLs on this site. The homepage and archive list are
// the main entry points; About changes rarely.
const STATIC_PAGES = [
  { path: '/',         changefreq: 'daily',   priority: '1.0' },
  { path: '/council',  changefreq: 'monthly', priority: '0.8' },
  { path: '/archive',  changefreq: 'daily',   priority: '0.9' },
  { path: '/themes',   changefreq: 'weekly',  priority: '0.8' },
  { path: '/about',    changefreq: 'monthly', priority: '0.5' },
];

// One hub page per theme. Theme hubs are strong topical landing pages, so they
// get a high priority and a weekly changefreq (counts shift as debates land).
const THEME_PAGES = THEMES.map((t) => ({
  path: `/themes/${themeSlug(t.label)}`,
  changefreq: 'weekly',
  priority: '0.8',
}));

function escapeXml(unsafe) {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function buildSitemap(staticPages, sessions) {
  const today = new Date().toISOString().split('T')[0];

  const staticEntries = staticPages.map(({ path, changefreq, priority }) => `
  <url>
    <loc>${SITE_URL}${path}</loc>
    <lastmod>${today}</lastmod>
    <changefreq>${changefreq}</changefreq>
    <priority>${priority}</priority>
  </url>`).join('');

  const sessionEntries = sessions.map(({ slug, created_at }) => {
    const lastmod = new Date(created_at).toISOString().split('T')[0];
    const esc = escapeXml(slug);
    // Each session has three indexable pages: the debate (primary, 0.7), its
    // standalone Policy Brief (0.6), and the panel page "Who was selected, and
    // why" (0.6).
    return `
  <url>
    <loc>${SITE_URL}/archive/${esc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.7</priority>
  </url>
  <url>
    <loc>${SITE_URL}/brief/${esc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>
  <url>
    <loc>${SITE_URL}/who/${esc}</loc>
    <lastmod>${lastmod}</lastmod>
    <changefreq>monthly</changefreq>
    <priority>0.6</priority>
  </url>`;
  }).join('');

  return `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${staticEntries}${sessionEntries}
</urlset>`;
}

export async function getServerSideProps({ res }) {
  // Fetch all completed archive sessions. We only include sessions with
  // a finished brief — pre-created but unfinished sessions shouldn't
  // appear in search results.
  let sessions = [];
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('slug, created_at, cards')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('[sitemap] Supabase error:', error);
    } else {
      sessions = (data || [])
        .filter(s => s.slug && s.cards && s.cards.brief)
        .map(s => ({ slug: s.slug, created_at: s.created_at }));
    }
  } catch (e) {
    console.error('[sitemap] Failed to fetch sessions:', e);
  }

  const xml = buildSitemap([...STATIC_PAGES, ...THEME_PAGES], sessions);

  res.setHeader('Content-Type', 'application/xml; charset=utf-8');
  // Cache for 1 hour at the CDN edge, allow stale-while-revalidate for 24h.
  // Sitemap doesn't need to be perfectly fresh — a one-hour lag is fine for
  // crawlers and saves a Supabase query on every crawler hit.
  res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  res.write(xml);
  res.end();

  return { props: {} };
}

// This page never renders — getServerSideProps writes the response directly.
export default function Sitemap() {
  return null;
}
