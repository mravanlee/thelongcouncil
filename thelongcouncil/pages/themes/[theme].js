import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { resolveAvatarSlug } from '../../lib/avatarSlugs';
import { SERIF, SiteHeader, SiteFooter } from '../../components/SiteChrome';
import { matchingThemes, themeBySlug, themeSlug } from '../../lib/themes';
import { themeContent, themeDisplay } from '../../lib/themeContent';

const SITE = 'https://www.thelongcouncil.com';
const MIN_INDEXABLE = 5; // below this a hub is too thin to index

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

function stripTierSuffix(name) {
  if (!name) return '';
  return name.replace(/\s*[—–-]\s*(Practitioner|Framer|Leader|Thinker|Wildcard)\s*$/i, '').trim();
}

function memberSlug(name) {
  const base = stripTierSuffix(name).replace(/\s*\([^)]*\)/g, '').normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return resolveAvatarSlug(base);
}

function monogram(name) {
  return stripTierSuffix(name).split(/\s+/).filter(Boolean).map((p) => p[0]).join('').toUpperCase().slice(0, 2);
}

function clusterRegex(c) {
  const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const parts = [
    ...(c.words || []).map((w) => '\\b' + esc(w.toLowerCase())),
    ...(c.acronyms || []).map((a) => '\\b' + esc(a.toLowerCase()) + '\\b'),
  ];
  return new RegExp('(' + parts.join('|') + ')', 'i');
}

export async function getServerSideProps(context) {
  const theme = themeBySlug(context.params.theme);
  if (!theme) return { notFound: true };
  const label = theme.label;
  const content = themeContent(label);

  const { data: rows, error } = await supabase
    .from('sessions')
    .select('id, slug, original_issue, sharpened_issue, member_names, created_at, cards, featured_quote, featured_quote_member')
    .order('created_at', { ascending: false });
  if (error) return { props: { error: true, label, slug: context.params.theme } };

  const all = (rows || []).map((s) => ({
    id: s.id,
    slug: s.slug,
    display_issue: (s.cards && s.cards.question_en) || s.original_issue,
    original_issue: s.original_issue,
    sharpened_issue: s.sharpened_issue,
    teaser: extractTeaser(s.cards),
    created_at: s.created_at,
    member_names: s.member_names || [],
    member_actions: (s.cards && s.cards.member_actions) || {},
    featured_quote: s.featured_quote || null,
  }));
  const inTheme = all.map((s) => ({ ...s, themes: matchingThemes(s) })).filter((s) => s.themes.includes(label));
  if (inTheme.length === 0) return { notFound: true };

  // Members by presence on this theme.
  const memberCount = {};
  for (const s of inTheme) for (const n of s.member_names) {
    const clean = stripTierSuffix(n);
    if (clean) memberCount[clean] = (memberCount[clean] || 0) + 1;
  }
  const members = Object.entries(memberCount).sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, slug: memberSlug(name), monogram: monogram(name) }));

  // "What would they do" — surface each thinker's concrete moves from the policy
  // brief (cards.member_actions). Rank a member's moves by how much they are
  // actually about THIS theme (theme words in the move, then in the question),
  // so a place theme that a debate only mentions in passing (e.g. China inside
  // an "what should the EU do" debate) surfaces the China-relevant moves first.
  const themeRx = clusterRegex({ words: theme.keywords, acronyms: theme.acronyms });
  const actionsByMember = {};
  for (const s of inTheme) for (const [rawName, acts] of Object.entries(s.member_actions || {})) {
    const name = stripTierSuffix(rawName);
    if (!acts || !acts.length) continue;
    const qHit = themeRx.test(s.display_issue || '') ? 1 : 0;
    for (const text of acts) {
      const score = (themeRx.test(text) ? 2 : 0) + qHit;
      (actionsByMember[name] = actionsByMember[name] || []).push({ text, slug: s.slug, question: s.display_issue, score });
    }
  }
  const whatWouldThey = members.filter((m) => actionsByMember[m.name]).slice(0, 5).map((m) => {
    const actions = actionsByMember[m.name].slice().sort((a, b) => b.score - a.score).slice(0, 3);
    return { name: m.name, slug: m.slug, monogram: m.monogram, actions };
  });

  // Policy clusters.
  const clusterHay = (s) => [s.display_issue, s.original_issue, s.sharpened_issue].filter(Boolean).join(' ').toLowerCase();
  const clusters = (content?.clusters || []).map((c) => {
    const rx = clusterRegex(c);
    const hits = inTheme.filter((s) => rx.test(clusterHay(s)));
    return { label: c.label, dilemma: c.dilemma, count: hits.length, debates: hits.slice(0, 6).map((s) => ({ slug: s.slug, q: s.display_issue })) };
  }).filter((c) => c.count >= 3);
  // Only present clusters when there are at least two; a single bucket is not a
  // useful breakdown (a cross-cutting theme like Geopolitics falls back to the
  // hero + the full debate list instead).
  const useClusters = clusters.length >= 2 ? clusters : [];

  // Related themes by co-occurrence.
  const coCount = {};
  for (const s of inTheme) for (const t of s.themes) if (t !== label) coCount[t] = (coCount[t] || 0) + 1;
  const related = Object.entries(coCount).sort((a, b) => b[1] - a[1]).slice(0, 5)
    .map(([l, count]) => ({ label: l, slug: themeSlug(l), count }));

  const itemList = inTheme.map((s, i) => ({ pos: i + 1, slug: s.slug, q: s.display_issue }));

  // Immutable-ish landing page; let the edge CDN cache it (counts shift slowly).
  context.res.setHeader('Cache-Control', 'public, s-maxage=3600, stale-while-revalidate=86400');

  const disp = themeDisplay(label);
  return {
    props: {
      label,
      displayName: disp.name,
      aboutPhrase: disp.about,
      slug: context.params.theme,
      intro: content?.intro || `How the council has debated ${label.toLowerCase()}.`,
      count: inTheme.length,
      memberTotal: Object.keys(memberCount).length,
      lastUpdated: inTheme[0]?.created_at || null,
      indexable: inTheme.length >= MIN_INDEXABLE,
      whatWouldThey,
      clusters: useClusters,
      related,
      itemList,
    },
  };
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function MemberHead({ m }) {
  const [failed, setFailed] = useState(false);
  const lastName = m.name.split(' ').slice(-1)[0];
  return (
    <Link href={`/council#m-${m.slug}`} className="group flex shrink-0 items-center gap-4 sm:w-[200px] sm:flex-col sm:items-start sm:gap-3">
      <div className="relative grid h-[84px] w-[84px] shrink-0 place-items-center overflow-hidden rounded-full bg-secondary ring-2 ring-primary/30 transition group-hover:ring-primary">
        <span className="text-[19px] font-semibold text-primary" style={SERIF}>{m.monogram}</span>
        {!failed && m.slug && (
          <img src={`/avatars/avatar_${m.slug}.webp`} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setFailed(true)} />
        )}
      </div>
      <div>
        <div className="text-[20px] leading-tight text-primary" style={SERIF}>{m.name}</div>
        <span className="mt-1.5 inline-block text-[10px] tracking-[0.14em] uppercase text-primary/70 transition group-hover:text-primary">Explore {lastName} →</span>
      </div>
    </Link>
  );
}

export default function ThemeHub({ label, displayName, aboutPhrase, slug, intro, count, memberTotal, lastUpdated, indexable, whatWouldThey, clusters, related, itemList, error }) {
  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground antialiased">
        <SiteHeader />
        <main className="mx-auto max-w-5xl px-6 py-24 text-center text-[15px] text-muted-foreground">Could not load this theme. Please try again in a moment.</main>
        <SiteFooter />
      </div>
    );
  }

  const canonical = `${SITE}/themes/${slug}`;
  const name = displayName || label;
  const title = `${name} — The Long Council`;
  const desc = (intro || '').replace(/\s+/g, ' ').slice(0, 155);
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      { '@type': 'BreadcrumbList', itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: `${SITE}/` },
        { '@type': 'ListItem', position: 2, name: 'Themes', item: `${SITE}/themes` },
        { '@type': 'ListItem', position: 3, name },
      ] },
      { '@type': 'CollectionPage', '@id': canonical, name: title, about: { '@type': 'Thing', name }, description: desc,
        mainEntity: { '@type': 'ItemList', numberOfItems: itemList.length,
          itemListElement: itemList.map((d) => ({ '@type': 'ListItem', position: d.pos, url: `${SITE}/archive/${d.slug}`, name: d.q })) } },
    ],
  };

  return (
    <>
      <Head>
        <title>{title}</title>
        <meta name="description" content={desc} />
        {!indexable && <meta name="robots" content="noindex,follow" />}
        <link rel="canonical" href={canonical} />
        <meta property="og:title" content={title} />
        <meta property="og:description" content={desc} />
        <meta property="og:type" content="website" />
        <meta property="og:url" content={canonical} />
        <meta property="og:site_name" content="The Long Council" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:image" content={`${SITE}/og-default.png`} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </Head>

      <div className="min-h-screen bg-background text-foreground antialiased">
        <SiteHeader />

        {/* Title + intro + at a glance + topic chips */}
        <section className="border-b border-border/70">
          <div className="mx-auto max-w-5xl px-6 pt-16 pb-9 lg:pt-20">
            <div className="text-[11px] tracking-[0.22em] uppercase text-primary">
              <Link href="/themes" className="hover:text-foreground">Themes</Link>
              <span className="mx-2 text-muted-foreground">/</span>
              <span className="text-muted-foreground">{name}</span>
            </div>
            <h1 className="mt-4 text-[40px] leading-[1.1] tracking-tight text-foreground sm:text-6xl" style={SERIF}>{name}</h1>
            <p className="mt-5 max-w-3xl text-[17px] leading-[1.6] text-foreground/80" style={SERIF}>{intro}</p>

            <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
              {[['Debates', count], ['Council voices', memberTotal], ['Last debated', lastUpdated ? formatDate(lastUpdated) : '—']].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">{k}</dt>
                  <dd className="mt-1 text-[18px] text-foreground" style={SERIF}>{v}</dd>
                </div>
              ))}
            </dl>

            {clusters.length > 0 && (
              <div className="mt-8 flex flex-wrap gap-2">
                {clusters.map((c) => (
                  <a key={c.label} href="#topics" className="rounded-sm border border-border bg-card px-3 py-1.5 text-[11px] tracking-[0.1em] uppercase text-foreground/80 hover:border-primary hover:text-primary transition">{c.label}</a>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* What would they do */}
        {whatWouldThey.length > 0 && (
          <section className="border-b border-border/70 bg-card/30">
            <div className="mx-auto max-w-5xl px-6 py-14">
              <div className="text-[11px] tracking-[0.22em] uppercase text-primary mb-3">The council in action</div>
              <h2 className="text-[30px] leading-[1.15] text-foreground" style={SERIF}>What would they do about {aboutPhrase}?</h2>
              <p className="mt-3 text-[15px] text-muted-foreground max-w-2xl">Each thinker’s concrete moves, drawn straight from their debates.</p>
              <div className="mt-10 space-y-5">
                {whatWouldThey.map((m) => (
                  <div key={m.name} className="border border-border border-l-[3px] border-l-primary bg-background p-6 sm:p-7">
                    <div className="flex flex-col gap-6 sm:flex-row sm:gap-9">
                      <MemberHead m={m} />
                      <ul className="flex-1 space-y-3">
                        {m.actions.map((a, i) => (
                          <li key={i}>
                            <Link href={`/archive/${a.slug}`} className="group block rounded-sm border-l-[3px] border-l-primary bg-primary/[0.05] px-5 py-4 transition hover:bg-primary/[0.09]">
                              <span className="text-[17px] leading-[1.45] text-foreground" style={SERIF}>{a.text}</span>
                              <span className="mt-2.5 flex items-center gap-1.5 text-[13px] text-primary transition group-hover:text-foreground">
                                <span className="italic" style={SERIF}>{a.question}</span><span aria-hidden>→</span>
                              </span>
                            </Link>
                          </li>
                        ))}
                      </ul>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* Policy clusters */}
        {clusters.length > 0 && (
          <section id="topics" className="border-b border-border/70 scroll-mt-6">
            <div className="mx-auto max-w-5xl px-6 py-14">
              <div className="text-[11px] tracking-[0.22em] uppercase text-primary mb-3">Browse by topic</div>
              <h2 className="text-[30px] leading-[1.15] text-foreground" style={SERIF}>Recurring dilemmas</h2>
              <div className="mt-10 grid gap-6 sm:grid-cols-2">
                {clusters.map((c) => (
                  <div key={c.label} className="border border-border border-t-[2px] border-t-primary bg-card p-6 sm:p-7">
                    <div className="flex items-baseline justify-between gap-3">
                      <h3 className="text-[20px] text-foreground" style={SERIF}>{c.label}</h3>
                      <span className="shrink-0 text-[10px] tracking-[0.16em] uppercase text-muted-foreground">{c.count} debates</span>
                    </div>
                    <p className="mt-3 text-[14px] leading-[1.6] text-foreground/75">{c.dilemma}</p>
                    <ul className="mt-5 space-y-2.5 border-t border-border/60 pt-5">
                      {c.debates.map((d) => (
                        <li key={d.slug} className="flex gap-2.5">
                          <span className="mt-[9px] h-[5px] w-[5px] shrink-0 rounded-full bg-primary/70" />
                          <Link href={`/archive/${d.slug}`} className="text-[15px] leading-[1.4] text-foreground/90 hover:text-primary transition" style={SERIF}>{d.q}</Link>
                        </li>
                      ))}
                    </ul>
                    {c.count > c.debates.length && (
                      <Link href={`/archive?theme=${encodeURIComponent(label)}`} className="mt-4 inline-block text-[11px] tracking-[0.1em] uppercase text-primary/70 hover:text-primary">+ {c.count - c.debates.length} more in {c.label} →</Link>
                    )}
                  </div>
                ))}
              </div>
              <div className="mt-10">
                <Link href={`/archive?theme=${encodeURIComponent(label)}`} className="text-[12px] tracking-[0.14em] uppercase text-primary hover:text-foreground">See all {count} debates →</Link>
              </div>
            </div>
          </section>
        )}

        {/* Fallback debate list when the theme does not break into clusters */}
        {clusters.length === 0 && itemList.length > 0 && (
          <section className="border-b border-border/70">
            <div className="mx-auto max-w-5xl px-6 py-12">
              <div className="text-[11px] tracking-[0.22em] uppercase text-primary mb-6">The debates</div>
              <ul className="divide-y divide-border/70 border-y border-border/70">
                {itemList.slice(0, 25).map((d) => (
                  <li key={d.slug} className="py-6">
                    <Link href={`/archive/${d.slug}`} className="text-[18px] leading-[1.35] text-foreground hover:text-primary transition" style={SERIF}>{d.q}</Link>
                  </li>
                ))}
              </ul>
              {itemList.length > 25 && (
                <Link href={`/archive?theme=${encodeURIComponent(label)}`} className="mt-8 inline-block text-[12px] tracking-[0.14em] uppercase text-primary hover:text-foreground">See all {count} debates →</Link>
              )}
            </div>
          </section>
        )}

        {/* Related themes */}
        {related.length > 0 && (
          <section className="border-t border-border/70 bg-card/30">
            <div className="mx-auto max-w-5xl px-6 py-11">
              <div className="text-[11px] tracking-[0.22em] uppercase text-primary mb-5">Related themes</div>
              <div className="flex flex-wrap gap-2">
                {related.map((r) => (
                  <Link key={r.label} href={`/themes/${r.slug}`} className="rounded-sm border border-border bg-background px-3 py-1.5 text-[11px] tracking-[0.18em] uppercase text-muted-foreground hover:border-primary hover:text-primary transition">
                    {r.label} <span className="text-foreground/40">{r.count}</span>
                  </Link>
                ))}
              </div>
            </div>
          </section>
        )}

        <SiteFooter />
      </div>
    </>
  );
}
