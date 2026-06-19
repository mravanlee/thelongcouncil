import Head from 'next/head';
import Link from 'next/link';
import { supabase } from '../../lib/supabase';
import { resolveAvatarSlug, KNOWN_AVATAR_SLUGS } from '../../lib/avatarSlugs';
import { doctrineTagsForSlug } from '../../lib/doctrineTags';

export async function getServerSideProps(context) {
  const { slug } = context.params;
  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error || !session) return { notFound: true };
  // No assembly yet (pre-created / unfinished session) → 404, so we never index
  // a thin/empty panel page.
  if (!session.cards || !session.cards.assembly) return { notFound: true };
  return { props: { session } };
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function stripTierSuffix(name) {
  return (name || '').replace(/\s*[—–-]\s*(Practitioner|Framer|Leader|Thinker|Wildcard)(\/\w+)?\s*$/i, '').trim();
}

const normName = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

function nameToAvatarSlug(name) {
  const naive = stripTierSuffix(name).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[\s.\-]+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return resolveAvatarSlug(naive);
}

function getInitials(name) {
  return stripTierSuffix(name).split(' ').filter(Boolean).map((p) => p[0]).join('').toUpperCase().slice(0, 3);
}

// Resolve a short label from POLES & BALANCE (e.g. "de Gaulle", "Schmidt") to the
// full member name, so avatars + display use the canonical form.
function matchFull(token, memberNames) {
  const t = normName(token);
  for (const full of memberNames) {
    const nf = normName(stripTierSuffix(full));
    if (nf.includes(t) || t.includes(normName(stripTierSuffix(full).split(' ').pop()))) return stripTierSuffix(full);
  }
  const tl = normName(token.split(/\s+/).pop());
  for (const full of memberNames) {
    if (normName(stripTierSuffix(full).split(' ').pop()) === tl) return stripTierSuffix(full);
  }
  return stripTierSuffix(token);
}

function Avatar({ name, size }) {
  const slug = nameToAvatarSlug(name);
  const clean = stripTierSuffix(name);
  const known = KNOWN_AVATAR_SLUGS.has(slug);
  const cls = size === 'sm' ? 'av av-sm' : 'av';
  const inner = known
    ? <img src={`/avatars/avatar_${slug}.webp`} alt={clean} className="av-img" />
    : <span className="av-mono">{getInitials(name)}</span>;
  if (!known) return <span className={cls} aria-hidden="true">{inner}</span>;
  return (
    <Link href={`/council#m-${slug}`} className={cls} title={`${clean} — view profile`} aria-label={`${clean} profile`}>
      {inner}
    </Link>
  );
}

// Parse the Prompt-1 assembly into the structured pieces the panel page shows.
function parseAssembly(raw) {
  let text = raw || '';
  // Strip tier labels (any format) + the internal coverage tag, mirroring the
  // debate page's cleanup so names render canonically.
  text = text.replace(/(\*\*[^*\n]*?)\s*[—–-]\s*(?:Practitioner|Framer|Leader|Thinker|Wildcard)(?:\s*\/\s*(?:Practitioner|Framer|Leader|Thinker|Wildcard))?(\*\*)/g, '$1$2');
  text = text.replace(/(\*\*[^*\n]+?\*\*|[^\n—–-]+?)\s*[—–-]\s*(?:Practitioner|Framer|Leader|Thinker|Wildcard)(?:\s*\/\s*(?:Practitioner|Framer|Leader|Thinker|Wildcard))?(?=\s*$)/gim, '$1');
  // Strip confidence tags, tolerating extra text inside the brackets such as
  // "[extrapolated — must be flagged]" or "[documented] —".
  text = text.replace(/\[(?:documented|inferred|extrapolated)[^\]]*\]\s*[—–-]?\s*/gi, '');

  const LABELS = 'ISSUE SUMMARY|TAXONOMY TAGS|CENTRAL TENSION|POLES & BALANCE|SELECTED MEMBERS|MEMBERS CONSIDERED BUT NOT SELECTED|CONFIDENCE NOTE';
  const grab = (label) => {
    const re = new RegExp(label + ':\\s*([\\s\\S]*?)(?=\\n\\s*(?:' + LABELS + ')\\s*:|$)', 'i');
    const m = text.match(re);
    return m ? m[1].trim() : '';
  };

  // Render targets are plain text, so drop any leftover markdown emphasis (* / **).
  const stripMd = (v) => (v || '').replace(/\*+/g, '').replace(/\s+/g, ' ').trim();

  const tension = stripMd(grab('CENTRAL TENSION'));
  const issue = stripMd(grab('ISSUE SUMMARY'));
  const polesRaw = grab('POLES & BALANCE');
  const confidence = grab('CONFIDENCE NOTE');

  // POLES & BALANCE comes either as a "Label: names | Label: names" single line
  // (the spec) or, more often now, a bullet list "- **Label:** Name (2) — N voices".
  // Drop the trailing "— N voices"/"(count)" bookkeeping and keep label + names.
  const poleNames = (s) => s.replace(/\s*[—–-].*$/, '').split(',').map((x) => x.replace(/\(\d+\)/g, '').trim()).filter(Boolean);
  const poleLines = polesRaw.split('\n').map((l) => l.trim()).filter((l) => /^[-*]/.test(l));
  const poles = (poleLines.length >= 2
    ? poleLines.map((l) => stripMd(l.replace(/^[-*]\s*/, '')))
    : polesRaw.split('|').map((seg) => stripMd(seg))
  ).map((seg) => {
    const mm = seg.match(/^(.*?):\s*(.*)$/);
    if (!mm) return null;
    const names = poleNames(mm[2]);
    return names.length ? { label: mm[1].trim(), names } : null;
  }).filter(Boolean);

  // The model emits member headers as "**N. Name — Tier**" (bold, numbered) with
  // "---" separators and the occasional "[Special flag: ...]" note between entries —
  // not the bare "N. Name" the older parser assumed. Strip the separators/flags,
  // then split on numbered headers tolerating the leading "**".
  let selBlock = (text.match(/SELECTED MEMBERS:[^\n]*\n+([\s\S]*?)(?=\n\s*(?:MEMBERS CONSIDERED BUT NOT SELECTED|CONFIDENCE NOTE)\s*:|$)/i) || [])[1] || '';
  selBlock = selBlock.replace(/^[ \t]*[-–—]{3,}[ \t]*$/gm, '').replace(/\[Special flag:[\s\S]*?\]/gi, '');
  const selected = selBlock.split(/\n(?=[ \t]*(?:\*\*)?[ \t]*\d+\.[ \t])/).map((e) => e.trim()).filter(Boolean).map((entry) => {
    const firstLine = (entry.split('\n')[0] || '');
    const name = stripTierSuffix(firstLine.replace(/^[ \t]*(?:\*\*)?[ \t]*\d+\.[ \t]*/, '').replace(/\*\*/g, '').trim());
    const field = (k) => {
      const m = entry.match(new RegExp('^\\s*' + k + ':\\s*([\\s\\S]*?)(?=\\n\\s*(?:Relevance|Coverage|Will argue):|$)', 'im'));
      return m ? stripMd(m[1]) : '';
    };
    return { name, relevance: field('Relevance'), coverage: field('Coverage'), willArgue: field('Will argue') };
  }).filter((x) => x.name && !/^(Relevance|Coverage|Will argue)$/i.test(x.name));

  // Considered-but-not-selected entries are blank-line-separated paragraphs of the
  // form "**Name** — reason", not a bullet list.
  const notBlock = (text.match(/MEMBERS CONSIDERED BUT NOT SELECTED:\s*\n?([\s\S]*?)(?=\n\s*CONFIDENCE NOTE\s*:|$)/i) || [])[1] || '';
  const notSelected = notBlock.split(/\n\s*\n/).map((b) => b.trim()).filter(Boolean).map((b) => {
    const flat = b.replace(/\s+/g, ' ').trim();
    const m = flat.match(/^[-*]?\s*\*\*([^*]+)\*\*\s*[—–:-]?\s*([\s\S]*)$/) || flat.match(/^[-*]?\s*([^:—–]+)[:—–]\s*([\s\S]*)$/);
    return m ? { name: stripTierSuffix(m[1].trim()), reason: stripMd(m[2]) } : { name: '', reason: '' };
  }).filter((x) => x.name);

  return { tension, issue, poles, selected, notSelected, confidence };
}

export default function WhoPage({ session }) {
  const cards = session.cards || {};
  const question = cards.question_en || session.original_issue || '';
  const date = formatDate(session.created_at);
  const memberNames = (session.member_names || []).map(stripTierSuffix).filter(Boolean);
  const { tension, issue, poles, selected, notSelected } = parseAssembly(cards.assembly);

  // ── Standalone, indexable panel page (SEO) ─────────────────────────────
  const baseUrl = 'https://www.thelongcouncil.com';
  const debateUrl = `${baseUrl}/archive/${session.slug}`;
  const briefUrl = `${baseUrl}/brief/${session.slug}`;
  const canonicalUrl = `${baseUrl}/who/${session.slug}`;
  const hasBrief = !!cards.brief;
  const pageTitle = `Who was selected, and why | ${question} | The Long Council`;
  const aboutPhrase = `The Long Council's panel for ${question}`.replace(/[?.!]+\s*$/, '');
  let metaDescription = `${aboutPhrase}: who was selected and why, the two opposing camps, and who was considered but left out.`.replace(/\s+/g, ' ').trim();
  if (metaDescription.length > 158) metaDescription = metaDescription.slice(0, 158).replace(/\s+\S*$/, '') + '…';
  const ogImage = (session.og_images && session.og_images.__canonical__) || `${baseUrl}/api/og/vs/${session.slug}`;
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline: `Who was selected, and why: ${question}`.slice(0, 110),
    description: metaDescription,
    about: question,
    articleSection: 'The Panel',
    url: canonicalUrl,
    mainEntityOfPage: canonicalUrl,
    datePublished: session.created_at,
    inLanguage: 'en',
    author: { '@type': 'Organization', name: 'The Long Council', url: baseUrl },
    publisher: { '@type': 'Organization', name: 'The Long Council', url: baseUrl },
    isPartOf: { '@type': 'WebSite', name: 'The Long Council', url: baseUrl },
  };

  return (
    <>
      <Head>
        <title>{pageTitle}</title>
        <meta name="description" content={metaDescription} />
        <link rel="canonical" href={canonicalUrl} />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={pageTitle} />
        <meta property="og:description" content={metaDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={ogImage} />
        <meta property="og:site_name" content="The Long Council" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={pageTitle} />
        <meta name="twitter:description" content={metaDescription} />
        <meta name="twitter:image" content={ogImage} />
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }} />
      </Head>

      <div className="page">
        <div className="toolbar">
          <a href={debateUrl} className="tlink">← View the full debate</a>
          {hasBrief && <a href={briefUrl} className="tlink tlink-r">Read the policy brief →</a>}
        </div>

        <article className="doc">
          <header className="doc-head">
            <div className="brand">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="m16.24 7.76-1.804 5.411a2 2 0 0 1-1.265 1.265L7.76 16.24l1.804-5.411a2 2 0 0 1 1.265-1.265z" />
              </svg>
              <span>The Long Council</span>
            </div>
            <h1 className="title">Who was selected, and why</h1>
            <p className="q">{question}</p>
            <div className="meta">The panel · {date}{selected.length ? ` · ${selected.length} voices` : ''}</div>
          </header>

          {(tension || issue) && (
            <section className="lead">
              <div className="sec-label">The central tension</div>
              <p className="lead-line">{tension || issue}</p>
            </section>
          )}

          {poles.length >= 2 && (
            <section>
              <div className="sec-label">The two poles</div>
              <div className="poles">
                {poles.map((p, i) => (
                  <div className="pole" key={i}>
                    <div className="pole-label">{p.label}</div>
                    {p.names.map((n, j) => {
                      const full = matchFull(n, memberNames);
                      return (
                        <div className="pole-m" key={j}>
                          <Avatar name={full} size="sm" />
                          <span>{full}</span>
                        </div>
                      );
                    })}
                  </div>
                ))}
              </div>
            </section>
          )}

          {selected.length > 0 && (
            <section>
              <div className="sec-label">Selected members</div>
              {selected.map((m, i) => {
                const tags = doctrineTagsForSlug(nameToAvatarSlug(m.name));
                return (
                <div className="mrow" key={i}>
                  <Avatar name={m.name} />
                  <div className="mbody">
                    <div className="m-name">{m.name}</div>
                    {tags && tags.length > 0 && (
                      <div className="m-tags">{tags.map((t, j) => <span key={j} className="m-tag">{t}</span>)}</div>
                    )}
                    {m.willArgue && <div className="m-arg"><span className="lbl">Will argue: </span>{m.willArgue}</div>}
                    {(m.relevance || m.coverage) && (
                      <div className="m-rel">{[m.relevance, m.coverage].filter(Boolean).join(' · ')}</div>
                    )}
                  </div>
                </div>
                );
              })}
            </section>
          )}

          {notSelected.length > 0 && (
            <section className="notsel">
              <div className="sec-label">Considered but not selected</div>
              {notSelected.map((n, i) => (
                <div className="notsel-item" key={i}>
                  <b>{n.name}</b>{n.reason ? <span>: {n.reason}</span> : null}
                </div>
              ))}
            </section>
          )}

          <footer className="doc-foot">
            <a href={debateUrl} className="foot-link">View the full debate →</a>
          </footer>
        </article>
      </div>

      <style jsx global>{`
        html, body { background: #ffffff; }
        .page { background: #efe9e1; min-height: 100vh; padding: 28px 16px 60px; }
        .toolbar { max-width: 720px; margin: 0 auto 18px; display: flex; align-items: center; gap: 14px; }
        .tlink { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.02em; color: var(--primary); text-decoration: none; }
        .tlink-r { margin-left: auto; }
        .tlink:hover { text-decoration: underline; }

        .doc { max-width: 720px; margin: 0 auto; background: #fff; color: #1c1714; padding: 46px 52px 40px; box-shadow: 0 1px 14px rgba(0,0,0,0.10); }
        .doc-head { border-bottom: 1px solid rgba(28,23,20,0.14); padding-bottom: 18px; margin-bottom: 24px; }
        .brand { display: inline-flex; align-items: center; gap: 7px; color: var(--primary); font-family: 'Playfair Display', serif; font-size: 13px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 14px; }
        .title { font-family: 'Playfair Display', serif; font-size: 27px; line-height: 1.2; font-weight: 600; margin: 0 0 8px; color: #16110e; letter-spacing: -0.01em; }
        .q { font-family: 'Playfair Display', serif; font-size: 17px; line-height: 1.35; font-weight: 500; font-style: italic; color: #4a3f36; margin: 0 0 12px; }
        .meta { font-family: 'Inter', sans-serif; font-size: 12.5px; color: #6a5d52; }

        .sec-label { font-family: 'Inter', sans-serif; font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--primary); font-weight: 700; margin-bottom: 11px; }
        .lead { margin-bottom: 26px; }
        .lead-line { font-family: 'Playfair Display', serif; font-size: 18px; line-height: 1.45; font-weight: 500; margin: 0; color: #16110e; }

        .poles { display: flex; gap: 12px; flex-wrap: wrap; margin: 0 0 30px; }
        .pole { flex: 1 1 220px; background: #f7f1e8; border: 0.5px solid rgba(28,23,20,0.16); border-radius: 5px; padding: 13px 15px; }
        .pole-label { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 700; color: #16110e; margin-bottom: 10px; }
        .pole-m { display: flex; align-items: center; gap: 9px; margin-bottom: 8px; font-family: 'Inter', sans-serif; font-size: 13.5px; color: #1c1714; }
        .pole-m:last-child { margin-bottom: 0; }

        .mrow { display: flex; gap: 14px; margin: 0 0 20px; }
        .mbody { flex: 1; }
        .m-name { font-family: 'Playfair Display', serif; font-size: 17px; font-weight: 600; color: #16110e; }
        .m-tags { margin-top: 3px; line-height: 1.5; }
        .m-tag { font-family: 'Inter', sans-serif; font-size: 10px; letter-spacing: 0.09em; text-transform: uppercase; color: #8a7d70; }
        .m-tag:not(:last-child)::after { content: '·'; margin: 0 7px; opacity: 0.5; }
        .m-arg { font-family: 'Inter', sans-serif; font-size: 13.5px; line-height: 1.55; color: #1c1714; margin-top: 4px; }
        .m-arg .lbl { color: #8a7d70; }
        .m-rel { font-family: 'Inter', sans-serif; font-size: 12px; line-height: 1.5; color: #6a5d52; margin-top: 6px; }

        .notsel { background: #f3ece0; border: 0.5px solid rgba(28,23,20,0.16); border-radius: 4px; padding: 15px 18px; margin: 6px 0 0; }
        .notsel-item { font-family: 'Inter', sans-serif; font-size: 13px; line-height: 1.7; color: #1c1714; }
        .notsel-item b { font-weight: 600; color: #16110e; }
        .notsel-item span { color: #6a5d52; }

        .av { flex: 0 0 auto; width: 44px; height: 44px; border-radius: 50%; overflow: hidden; display: inline-flex; align-items: center; justify-content: center; background: #efe7db; text-decoration: none; }
        .av-sm { width: 28px; height: 28px; }
        .av-img { width: 100%; height: 100%; object-fit: cover; }
        .av-mono { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 700; color: var(--primary); }
        .av-sm .av-mono { font-size: 10px; }

        .doc-foot { margin-top: 30px; padding-top: 14px; border-top: 1px solid rgba(28,23,20,0.14); font-family: 'Inter', sans-serif; font-size: 12px; color: #8a7d70; }
        .foot-link { color: var(--primary); text-decoration: none; font-weight: 600; }
        .foot-link:hover { text-decoration: underline; }

        @media (max-width: 560px) {
          .doc { padding: 34px 24px 32px; }
          .title { font-size: 23px; }
        }
      `}</style>
    </>
  );
}
