// TEMPORARY MOCKUP — visual preview of a theme hub page (/themes/[theme]).
// Hardcoded to the Economy theme. Not linked anywhere, not in the sitemap.
// Will be deleted when Phase 2 promotes this into pages/themes/[theme].js.
import { useState } from 'react';
import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../lib/supabase';
import { resolveAvatarSlug } from '../lib/avatarSlugs';
import { SERIF, SiteHeader, SiteFooter } from '../components/SiteChrome';
import { matchingThemes } from '../lib/themes';

const THEME = 'Economy';

// Identity-first copy. Foregrounds the council, not the archive. (Per-theme copy
// in the real build; this is the Economy mock.)
const INTRO = {
  lede: 'Not an archive of articles. This is how history’s leaders and thinkers have argued the economy, where they agree, where they split, and what they conclude.',
  covers:
    'Economy gathers the debates about how societies steer their material life: taxation and redistribution, trade and tariffs, industrial policy, inflation, and the role of markets versus the state. Each question forces a choice between competing goods, growth and equality, efficiency and resilience, freedom and security, and the council is built to hold that tension rather than resolve it cheaply. The recurring fault line runs between those who trust markets to allocate best and those who see a decisive role for public power.',
};

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
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function stripTierSuffix(name) {
  if (!name) return '';
  return name.replace(/\s*[—–-]\s*(Practitioner|Framer|Leader|Thinker|Wildcard)\s*$/i, '').trim();
}

function memberSlug(name) {
  const base = stripTierSuffix(name)
    .replace(/\s*\([^)]*\)/g, '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return resolveAvatarSlug(base);
}

function monogram(name) {
  return stripTierSuffix(name).split(/\s+/).filter(Boolean).map((p) => p[0]).join('').toUpperCase().slice(0, 2);
}

export async function getServerSideProps() {
  const { data: rows } = await supabase
    .from('sessions')
    .select('id, slug, original_issue, sharpened_issue, member_names, created_at, cards, featured_quote, featured_quote_member')
    .order('created_at', { ascending: false });

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
    featured_quote_member: s.featured_quote_member || null,
  }));

  const inTheme = all.map((s) => ({ ...s, themes: matchingThemes(s) })).filter((s) => s.themes.includes(THEME));

  const featured = inTheme.filter((s) => s.featured_quote).slice(0, 3);

  // Council members, by how often they sit on this theme's debates.
  const memberCount = {};
  for (const s of inTheme) for (const n of s.member_names) {
    const clean = stripTierSuffix(n);
    if (clean) memberCount[clean] = (memberCount[clean] || 0) + 1;
  }
  const members = Object.entries(memberCount).sort((a, b) => b[1] - a[1])
    .map(([name, count]) => ({ name, count, slug: memberSlug(name), monogram: monogram(name) }));

  // Related themes by co-occurrence.
  const coCount = {};
  for (const s of inTheme) for (const t of s.themes) if (t !== THEME) coCount[t] = (coCount[t] || 0) + 1;
  const related = Object.entries(coCount).sort((a, b) => b[1] - a[1]).slice(0, 5).map(([label, count]) => ({ label, count }));

  // D — Head to head: debates where two thinkers proposed concrete, different
  // moves. Pulled straight from member_actions, so nothing is inferred.
  const headToHead = inTheme
    .map((s) => {
      const names = Object.keys(s.member_actions || {}).filter((n) => (s.member_actions[n] || []).length);
      if (names.length < 2) return null;
      const [a, b] = names;
      return {
        slug: s.slug,
        question: s.display_issue,
        a: { name: stripTierSuffix(a), slug: memberSlug(a), action: s.member_actions[a][0] },
        b: { name: stripTierSuffix(b), slug: memberSlug(b), action: s.member_actions[b][0] },
      };
    })
    .filter(Boolean)
    .slice(0, 4);

  // B — The fault line. The TENSION is the real, valuable framing. The camp
  // split below is ILLUSTRATIVE (hardcoded for this Economy mock): a lexical
  // lean over action text misclassifies (it read Friedman's "block any state
  // body" as pro-state). The real build needs a validated stance signal
  // (panel_summary where present, otherwise a small LLM classification pass).
  const faultLine = {
    tension: 'Should the state steer the economy, or should markets be left to clear?',
    poles: [
      { label: 'Trust the market', names: ['Friedrich Hayek', 'Milton Friedman', 'Lee Kuan Yew', 'Deng Xiaoping'] },
      { label: 'A decisive role for the state', names: ['John Maynard Keynes', 'Amartya Sen', 'John Rawls', 'Helmut Schmidt'] },
    ],
  };

  const list = inTheme.map(({ member_names, featured_quote, featured_quote_member, themes, ...rest }) => rest);

  return {
    props: {
      count: inTheme.length,
      memberTotal: Object.keys(memberCount).length,
      lastUpdated: inTheme[0]?.created_at || null,
      faultLine,
      headToHead,
      members,
      related,
      list,
    },
  };
}

function MemberTile({ m }) {
  const [failed, setFailed] = useState(false);
  return (
    <Link href={`/council#m-${m.slug}`} className="group flex flex-col items-center text-center w-[88px]">
      <div className="relative grid h-[72px] w-[72px] place-items-center overflow-hidden rounded-full border border-border bg-secondary transition group-hover:border-primary">
        <span className="text-[17px] font-semibold text-primary" style={SERIF}>{m.monogram}</span>
        {!failed && m.slug && (
          <img src={`/avatars/avatar_${m.slug}.webp`} alt="" className="absolute inset-0 h-full w-full object-cover" onError={() => setFailed(true)} />
        )}
      </div>
      <div className="mt-2 text-[12px] leading-tight text-foreground transition group-hover:text-primary" style={SERIF}>{m.name}</div>
      <div className="text-[10px] tracking-[0.16em] uppercase text-muted-foreground">{m.count} debates</div>
    </Link>
  );
}

export default function ThemeHubMock({ count, memberTotal, lastUpdated, faultLine, headToHead, members, related, list }) {
  const firstPage = list.slice(0, 25);
  const topMembers = members.slice(0, 8);
  return (
    <>
      <Head>
        <title>{THEME} — The Long Council</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="min-h-screen bg-background text-foreground antialiased">
        <SiteHeader />

        {/* Title + identity lede */}
        <section className="border-b border-border/70">
          <div className="mx-auto max-w-5xl px-6 pt-16 pb-9 lg:pt-20">
            <div className="text-[11px] tracking-[0.22em] uppercase text-primary">
              <Link href="/archive" className="hover:text-foreground">Themes</Link>
              <span className="mx-2 text-muted-foreground">/</span>
              <span className="text-muted-foreground">{THEME}</span>
            </div>
            <h1 className="mt-4 text-[40px] leading-[1.1] tracking-tight text-foreground sm:text-6xl" style={SERIF}>{THEME}</h1>
            <p className="mt-5 max-w-2xl text-[17px] leading-relaxed text-foreground/80" style={SERIF}>{INTRO.lede}</p>

            {/* At a glance */}
            <dl className="mt-8 flex flex-wrap gap-x-10 gap-y-4">
              {[
                ['Debates', count],
                ['Council voices', memberTotal],
                ['Most paired with', related[0] ? related[0].label : '—'],
                ['Last debated', lastUpdated ? formatDate(lastUpdated) : '—'],
              ].map(([k, v]) => (
                <div key={k}>
                  <dt className="text-[10px] tracking-[0.2em] uppercase text-muted-foreground">{k}</dt>
                  <dd className="mt-1 text-[18px] text-foreground" style={SERIF}>{v}</dd>
                </div>
              ))}
            </dl>
          </div>
        </section>

        {/* B — The fault line */}
        <section className="border-b border-border/70">
          <div className="mx-auto max-w-5xl px-6 py-12">
            <div className="text-[11px] tracking-[0.22em] uppercase text-primary mb-4">The fault line</div>
            <p className="max-w-3xl text-[22px] leading-[1.35] text-foreground" style={SERIF}>{faultLine.tension}</p>
            <div className="mt-8 grid gap-6 sm:grid-cols-2">
              {faultLine.poles.map((p) => (
                <div key={p.label} className="border-t-[2px] border-t-primary border border-border bg-card p-6">
                  <div className="text-[13px] tracking-[0.06em] uppercase text-primary mb-3" style={SERIF}>{p.label}</div>
                  <div className="text-[16px] leading-[1.5] text-foreground/85" style={SERIF}>{p.names.join(' · ')}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* The council on this theme */}
        {topMembers.length > 0 && (
          <section className="border-b border-border/70 bg-card/30">
            <div className="mx-auto max-w-5xl px-6 py-11">
              <div className="text-[11px] tracking-[0.22em] uppercase text-primary mb-7">The voices most present on {THEME}</div>
              <div className="flex flex-wrap gap-x-6 gap-y-8">
                {topMembers.map((m) => <MemberTile key={m.name} m={m} />)}
              </div>
            </div>
          </section>
        )}

        {/* D — Head to head: concrete opposing moves, straight from member_actions */}
        {headToHead.length > 0 && (
          <section className="border-b border-border/70">
            <div className="mx-auto max-w-5xl px-6 py-12">
              <div className="text-[11px] tracking-[0.22em] uppercase text-primary mb-2">Head to head</div>
              <p className="text-[14px] text-muted-foreground mb-8 max-w-2xl">What different members would actually do, on the same question.</p>
              <div className="flex flex-col gap-5">
                {headToHead.map((h) => (
                  <div key={h.slug} className="border border-border bg-card p-6">
                    <Link href={`/archive/${h.slug}`} className="group block">
                      <h3 className="text-[18px] leading-[1.3] text-foreground transition group-hover:text-primary" style={SERIF}>{h.question}</h3>
                    </Link>
                    <div className="mt-5 grid gap-5 sm:grid-cols-2">
                      {[h.a, h.b].map((side, i) => (
                        <div key={i} className={i === 0 ? 'sm:pr-5 sm:border-r border-border' : ''}>
                          <div className="text-[11px] tracking-[0.16em] uppercase text-primary mb-2">{side.name}</div>
                          <p className="text-[15px] leading-[1.5] text-foreground/85" style={SERIF}>{side.action}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* What this theme covers */}
        <section className="border-b border-border/70">
          <div className="mx-auto max-w-5xl px-6 py-12">
            <div className="text-[11px] tracking-[0.22em] uppercase text-primary mb-4">What this theme covers</div>
            <p className="max-w-3xl text-[16px] leading-[1.7] text-foreground/85">{INTRO.covers}</p>
          </div>
        </section>

        {/* All debates */}
        <section>
          <div className="mx-auto max-w-5xl px-6 py-12">
            <div className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground mb-2">All {THEME} debates</div>
            <ol className="divide-y divide-border/70 border-y border-border/70">
              {firstPage.map((s) => (
                <li key={s.id} className="group py-9 transition hover:bg-card/40">
                  <Link href={`/archive/${s.slug}`} className="block">
                    <div className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">{formatDate(s.created_at)}</div>
                    <h2 className="mt-3 max-w-3xl text-[22px] leading-[1.3] tracking-tight text-foreground transition group-hover:text-primary sm:text-[26px]" style={SERIF}>{s.display_issue}</h2>
                    {s.teaser && (
                      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-baseline sm:gap-4">
                        <span className="shrink-0 text-[11px] tracking-[0.22em] uppercase text-primary">Verdict</span>
                        <p className="max-w-3xl text-[16px] leading-[1.5] text-foreground/85" style={SERIF}>{s.teaser}</p>
                      </div>
                    )}
                  </Link>
                </li>
              ))}
            </ol>
            {list.length > firstPage.length && (
              <div className="mt-10 text-center text-[11px] tracking-[0.18em] uppercase text-muted-foreground">+ {list.length - firstPage.length} more (pagination)</div>
            )}
          </div>
        </section>

        {/* Related themes */}
        <section className="border-t border-border/70 bg-card/30">
          <div className="mx-auto max-w-5xl px-6 py-11">
            <div className="text-[11px] tracking-[0.22em] uppercase text-primary mb-5">Related themes</div>
            <div className="flex flex-wrap gap-2">
              {related.map((r) => (
                <Link key={r.label} href="/themes-mockup" className="rounded-sm border border-border bg-background px-3 py-1.5 text-[11px] tracking-[0.18em] uppercase text-muted-foreground hover:border-primary hover:text-primary transition">
                  {r.label} <span className="text-foreground/40">{r.count}</span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        <SiteFooter />
      </div>
    </>
  );
}
