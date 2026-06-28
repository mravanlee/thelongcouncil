import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { SERIF, SiteHeader, SiteFooter } from '../../components/SiteChrome';
import { THEMES, matchingThemes, themeSlug } from '../../lib/themes';
import { themeContent, themeDisplay } from '../../lib/themeContent';

const SITE = 'https://www.thelongcouncil.com';
// THEMES order is place-first, then topic; the first four are the place themes.
const PLACE = new Set(['US', 'EU', 'China', 'Netherlands']);

export async function getServerSideProps(context) {
  const { data: rows } = await supabase
    .from('sessions')
    .select('original_issue, sharpened_issue, cards');
  const all = (rows || []).map((s) => ({
    display_issue: (s.cards && s.cards.question_en) || s.original_issue,
    original_issue: s.original_issue,
    sharpened_issue: s.sharpened_issue,
  }));
  const counts = Object.fromEntries(THEMES.map((t) => [t.label, 0]));
  for (const s of all) for (const l of matchingThemes(s)) counts[l] = (counts[l] || 0) + 1;

  const themes = THEMES.map((t) => ({
    label: t.label,
    name: themeDisplay(t.label).name,
    slug: themeSlug(t.label),
    count: counts[t.label] || 0,
    intro: themeContent(t.label)?.intro || '',
    place: PLACE.has(t.label),
  })).filter((t) => t.count > 0);

  context.res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');
  return { props: { themes } };
}

function ThemeCard({ t }) {
  return (
    <Link href={`/themes/${t.slug}`} className="group block border border-border border-t-[2px] border-t-primary bg-card p-6 transition hover:-translate-y-0.5 hover:shadow-md">
      <h2 className="flex min-h-[2.2em] items-start text-[22px] leading-[1.08] text-foreground transition group-hover:text-primary [text-wrap:balance]" style={SERIF}>{t.name}</h2>
      <div className="mt-2 text-[10px] tracking-[0.16em] uppercase text-muted-foreground">{t.count} debates</div>
      {t.intro && <p className="mt-3 text-[14px] leading-[1.6] text-foreground/75">{(t.intro.match(/^.*?[.?!]/) || [t.intro])[0]}</p>}
    </Link>
  );
}

export default function ThemesIndex({ themes }) {
  const place = themes.filter((t) => t.place);
  const topic = themes.filter((t) => !t.place);
  const canonical = `${SITE}/themes`;
  return (
    <>
      <Head>
        <title>Themes — The Long Council</title>
        <meta name="description" content="Browse the council’s debates by theme: from the economy and democracy to war, climate and AI, and by place from the US to the EU and China." />
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content="Themes — The Long Council" />
        <meta property="og:description" content="Browse the council’s debates by theme." />
        <meta property="og:url" content={canonical} />
        <meta property="og:site_name" content="The Long Council" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`${SITE}/og-default.png`} />
      </Head>

      <div className="min-h-screen bg-background text-foreground antialiased">
        <SiteHeader />

        <section className="border-b border-border/70">
          <div className="mx-auto max-w-5xl px-6 pt-16 pb-10 lg:pt-20">
            <div className="text-[11px] tracking-[0.22em] uppercase text-primary">Themes</div>
            <h1 className="mt-4 text-[36px] leading-[1.12] tracking-tight text-foreground sm:text-5xl" style={SERIF}>Many minds, many eras, rarely one answer</h1>
            <p className="mt-5 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">Browse the council’s debates by topic and by place. Thirty-seven historic leaders and thinkers, from Confucius to Keynes, the questions they took on, and the very different conclusions they reached.</p>
          </div>
        </section>

        <section>
          <div className="mx-auto max-w-5xl px-6 py-12">
            <div className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground mb-6">By place</div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
              {place.map((t) => <ThemeCard key={t.label} t={t} />)}
            </div>
            <div className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground mt-14 mb-6">By topic</div>
            <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
              {topic.map((t) => <ThemeCard key={t.label} t={t} />)}
            </div>
          </div>
        </section>

        <SiteFooter />
      </div>
    </>
  );
}
