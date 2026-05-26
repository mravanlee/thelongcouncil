import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Procession from '../../components/Procession';
import { resolveAvatarSlug } from '../../lib/avatarSlugs';
import { parseCard } from '../../lib/cardParser';
import { SiteFooter, SiteHeader } from '../../components/SiteChrome';

export async function getServerSideProps(context) {
  const { slug } = context.params;
  const memberQuery = (context.query && context.query.member) ? String(context.query.member) : null;
  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error || !session) return { notFound: true };
  return { props: { session, memberQuery } };
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function parseVerdict(verdictMd) {
  if (!verdictMd) return { verdict: '', reasoning: '' };
  const cleaned = verdictMd.replace(/^CONCLUSION TYPE:.*$/m, '').trim();
  const verdictMatch = cleaned.match(/##\s*Verdict\s*\n+([\s\S]*?)(?=\n##\s*Reasoning|$)/i);
  const reasoningMatch = cleaned.match(/##\s*Reasoning\s*\n+([\s\S]*?)(?=\n---|$)/i);
  return {
    verdict: verdictMatch ? verdictMatch[1].trim().replace(/^---\s*/m, '').replace(/\s*---\s*$/, '').trim() : '',
    reasoning: reasoningMatch ? reasoningMatch[1].trim().replace(/\s*---\s*$/, '').trim() : '',
  };
}

function cleanDeliberation(md) {
  if (!md) return '';
  return md.replace(/^SPEAKING ORDER:.*$/m, '').trim();
}

function parseDeliberation(deliberationText) {
  if (!deliberationText) return { cards: [], convergence: null };
  const blocks = deliberationText.split(/(?:^|\n)\s*---\s*\n/).map(b => b.trim()).filter(Boolean);
  const cards = [];
  let convergence = null;
  for (const block of blocks) {
    if (/^##\s+The convergence note/i.test(block)) convergence = block;
    else if (block.startsWith('## ') || block.includes('·')) cards.push(block);
  }
  return { cards, convergence };
}

function stripTierSuffix(name) {
  return name.replace(/\s*[—–-]\s*(Practitioner|Framer|Leader|Thinker|Wildcard)(\/\w+)?\s*$/i, '').trim();
}

function nameToAvatarSlug(name) {
  const naive = stripTierSuffix(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s.\-]+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return resolveAvatarSlug(naive);
}

function splitNameForCast(name) {
  const clean = stripTierSuffix(name);
  const parts = clean.split(' ');
  if (parts.length === 1) return [clean, ''];
  return [parts.slice(0, -1).join(' '), parts[parts.length - 1]];
}

function getInitials(name) {
  return stripTierSuffix(name).split(' ').filter(Boolean).map(p => p[0]).join('').toUpperCase().slice(0, 3);
}

function VerdictCast({ names }) {
  if (!names || names.length === 0) return null;
  return (
    <ul className="mb-10 mt-10 flex flex-wrap gap-x-3 gap-y-4 sm:gap-x-4">
      {names.map((name) => {
        const [line1, line2] = splitNameForCast(name);
        const slug = nameToAvatarSlug(name);
        return (
          <li
            key={name}
            className="flex w-14 flex-col items-center text-center sm:w-16"
          >
            <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-secondary sm:h-14 sm:w-14">
              <span
                className="text-[12px] font-semibold text-primary sm:text-[13px]"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                {getInitials(name)}
              </span>
              <img
                src={`/avatars/avatar_${slug}.webp`}
                alt=""
                className="absolute inset-0 h-full w-full object-cover"
                onError={(e) => {
                  e.target.style.display = 'none';
                }}
              />
            </div>
            <div className="mt-2 text-[10px] leading-tight text-muted-foreground sm:text-[11px]">
              {line1}
              {line2 ? (
                <>
                  <br />
                  {line2}
                </>
              ) : null}
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function ShareButton({ url, question }) {
  const [copied, setCopied] = useState(false);
  const cleanQuestion = (question || '').trim().replace(/\s+/g, ' ');
  const shareText = `"${cleanQuestion}" — debated by The Long Council\n\n${url}`;

  async function handleClick() {
    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: 'The Long Council', text: `"${cleanQuestion}" — debated by The Long Council`, url });
        return;
      } catch (e) { if (e && e.name === 'AbortError') return; }
    }
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
        return;
      } catch (e) {}
    }
    if (typeof window !== 'undefined') window.prompt('Copy this link:', shareText);
  }

  return (
    <div className="flex justify-center my-8">
      <button
        onClick={handleClick}
        aria-label="Share this session"
        className="group inline-flex min-w-[200px] items-center justify-center gap-2 rounded-sm border border-primary px-6 py-3 text-[13px] tracking-wide text-primary transition hover:bg-primary"
      >
        {copied ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition group-hover:[stroke:var(--color-primary-foreground)]"><polyline points="20 6 9 17 4 12" /></svg>
            <span className="transition group-hover:[color:var(--color-primary-foreground)]">Link copied</span>
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition group-hover:[stroke:var(--color-primary-foreground)]"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
            <span className="transition group-hover:[color:var(--color-primary-foreground)]">Share this session</span>
          </>
        )}
      </button>
    </div>
  );
}

function CollapsibleSection({ title, subtitle, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mb-4 overflow-hidden rounded-sm border border-border bg-card">
      <button
        onClick={() => setOpen(!open)}
        aria-expanded={open}
        className="flex w-full items-center justify-between px-5 py-4 text-left transition hover:bg-secondary"
      >
        <div className="flex flex-col">
          <div
            className="text-[16px] font-medium leading-tight text-foreground"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {title}
          </div>
          {subtitle && (
            <div className="mt-1 text-[13px] text-muted-foreground">
              {subtitle}
            </div>
          )}
        </div>
        <span className="ml-3 whitespace-nowrap text-[13px] text-primary">
          {open ? 'Close ↑' : 'Open ↓'}
        </span>
      </button>
      {open && (
        <div className="border-t border-border/70 px-5 pb-6">{children}</div>
      )}
    </div>
  );
}

export default function ArchiveDetail({ session, memberQuery }) {
  const cards = session.cards || {};
  const { verdict, reasoning } = parseVerdict(cards.verdict);
  const deliberationText = cleanDeliberation(cards.deliberation);
  const { cards: deliberationCards, convergence } = parseDeliberation(deliberationText);
  const briefText = cards.brief || '';
  const assemblyText = cards.assembly || '';
  const actions = Array.isArray(cards.actions) ? cards.actions.filter(Boolean) : [];

  const memberCount = session.member_names ? session.member_names.length : 0;
  const memberSummary = session.member_names && session.member_names.length > 0
    ? session.member_names.slice(0, 4).map(stripTierSuffix).join(', ') + (session.member_names.length > 4 ? `, +${session.member_names.length - 4} more` : '')
    : '';

  const pageTitle = session.original_issue ? session.original_issue.substring(0, 60) : 'Archive';
  const pageDescription = verdict ? verdict.substring(0, 155) : 'A past council debate.';

  const baseShareUrl = `https://www.thelongcouncil.com/archive/${session.slug}`;
  const canonicalUrl = memberQuery ? `${baseShareUrl}?member=${encodeURIComponent(memberQuery)}` : baseShareUrl;
  const ogImageUrl = memberQuery
    ? `https://www.thelongcouncil.com/api/og/vs/${session.slug}?member=${encodeURIComponent(memberQuery)}`
    : `https://www.thelongcouncil.com/api/og/vs/${session.slug}`;

  // Structured data for AI search engines (Google AI Overview, Perplexity, ChatGPT Search, etc).
  // We expose two graphs:
  //  - Article: standard editorial metadata so AI agents recognise the page as
  //    primary, dated, attributed content.
  //  - QAPage: explicit question + acceptedAnswer (verdict) + suggestedAnswer[] per
  //    speaker (each tied to its historical Person), which is exactly the structure
  //    AI summarisation pipelines look for when citing multi-perspective debates.
  const speakers = deliberationCards.map(parseCard).filter(Boolean);
  const verdictText = verdict + (reasoning ? `\n\n${reasoning}` : '');
  const orgPublisher = {
    '@type': 'Organization',
    name: 'The Long Council',
    url: 'https://www.thelongcouncil.com',
    logo: { '@type': 'ImageObject', url: 'https://www.thelongcouncil.com/favicon.svg' },
  };
  const jsonLd = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'Article',
        '@id': `${baseShareUrl}#article`,
        headline: session.original_issue,
        description: pageDescription,
        datePublished: session.created_at,
        dateModified: session.updated_at || session.created_at,
        author: orgPublisher,
        publisher: orgPublisher,
        image: ogImageUrl,
        mainEntityOfPage: { '@type': 'WebPage', '@id': baseShareUrl },
        inLanguage: 'en',
      },
      {
        '@type': 'QAPage',
        '@id': `${baseShareUrl}#qa`,
        mainEntity: {
          '@type': 'Question',
          name: session.original_issue,
          text: session.original_issue,
          answerCount: 1 + speakers.length,
          dateCreated: session.created_at,
          author: orgPublisher,
          acceptedAnswer: verdict ? {
            '@type': 'Answer',
            text: verdictText,
            dateCreated: session.created_at,
            url: baseShareUrl,
            author: orgPublisher,
            upvoteCount: 0,
          } : undefined,
          suggestedAnswer: speakers.map((s) => {
            const cleanName = stripTierSuffix(s.name);
            const bodyParts = Array.isArray(s.body) ? s.body : (s.body ? [s.body] : []);
            const fullText = [s.framing, ...bodyParts, s.challenge].filter(Boolean).join('\n\n');
            // Wikipedia URL by name slug. Works for the vast majority of council
            // members; AI agents use this for entity-matching to Wikidata.
            const wikipediaUrl = `https://en.wikipedia.org/wiki/${encodeURIComponent(cleanName.replace(/ /g, '_'))}`;
            return {
              '@type': 'Answer',
              text: fullText,
              dateCreated: session.created_at,
              url: `${baseShareUrl}?member=${encodeURIComponent(cleanName)}`,
              upvoteCount: 0,
              author: {
                '@type': 'Person',
                name: cleanName,
                ...(s.role ? { description: s.role } : {}),
                sameAs: [wikipediaUrl],
              },
            };
          }),
        },
      },
    ],
  };

  return (
    <>
      <Head>
        <title>{pageTitle} — The Long Council</title>
        <meta name="description" content={pageDescription} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta property="og:type" content="article" />
        <meta property="og:title" content={session.original_issue || 'The Long Council'} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content={`${session.original_issue} — The Long Council`} />
        <meta property="og:site_name" content="The Long Council" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={session.original_issue || 'The Long Council'} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={ogImageUrl} />
        <link rel="canonical" href={canonicalUrl} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </Head>

      <SiteHeader />

      <section className="border-b border-border/70">
        <div className="mx-auto max-w-[680px] px-5 pt-10 pb-10">
          <Link
            href="/archive"
            className="inline-flex items-center gap-2 text-[11px] tracking-[0.22em] uppercase text-muted-foreground transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            The Archive
          </Link>
          <div className="mt-4 text-[11px] tracking-[0.22em] uppercase text-muted-foreground">
            {formatDate(session.created_at)} · {memberCount} member{memberCount !== 1 ? 's' : ''}
          </div>
          <h1
            className="mt-4 max-w-[62ch] text-[28px] font-semibold leading-[1.18] tracking-tight text-foreground sm:text-[36px]"
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {session.original_issue}
          </h1>
        </div>
      </section>

      <div className="detail-wrap">
        <VerdictCast names={session.member_names} />

        {verdict && (
          <div className="bg-secondary border border-border p-6 sm:p-8 mb-8">
            <div className="text-[10px] tracking-[0.22em] uppercase text-primary">
              Verdict
            </div>
            <div className="relative mt-4">
              <span
                aria-hidden
                className="pointer-events-none absolute -top-4 -left-1 select-none text-[56px] leading-none text-primary/20 sm:-top-6 sm:-left-2 sm:text-[72px]"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                &ldquo;
              </span>
              <div
                className="verdict-md relative pl-6 text-[22px] font-medium leading-[1.3] tracking-tight text-foreground sm:pl-10 sm:text-[26px]"
                style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
              >
                <ReactMarkdown>{verdict}</ReactMarkdown>
              </div>
            </div>
            {reasoning && (
              <>
                <div className="mt-8 text-[10px] tracking-[0.22em] uppercase text-primary">
                  Reasoning
                </div>
                <div className="reasoning-md mt-3 text-[15px] leading-[1.7] text-foreground/85">
                  <ReactMarkdown>{reasoning}</ReactMarkdown>
                </div>
              </>
            )}
          </div>
        )}

        {actions.length > 0 && (
          <div className="bg-secondary border border-border p-6 mb-8">
            <div className="text-[10px] tracking-[0.22em] uppercase text-primary">
              What to do now
            </div>
            <ol className="mt-4 space-y-3">
              {actions.map((action, i) => (
                <li
                  key={i}
                  className="flex gap-3 text-[14px] leading-[1.55] text-foreground/90"
                >
                  <span className="mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full bg-primary text-[11px]"
                    style={{ color: 'var(--color-primary-foreground)' }}>
                    {i + 1}
                  </span>
                  <span>{action}</span>
                </li>
              ))}
            </ol>
          </div>
        )}

        <ShareButton url={baseShareUrl} question={session.original_issue || 'The Long Council'} />

        {deliberationText && (
          <div className="debate-section">
            <div className="debate-label">The debate</div>
            {deliberationCards.length > 0 ? (
              <Procession cards={deliberationCards} instant={true} scrollReveal={true} sessionSlug={session.slug} />
            ) : (
              <div className="md-body"><ReactMarkdown>{deliberationText}</ReactMarkdown></div>
            )}
            {convergence && <div className="md-body convergence-block"><ReactMarkdown>{convergence}</ReactMarkdown></div>}
          </div>
        )}

        {briefText && (
          <CollapsibleSection title="The policy brief" subtitle="The analyst's synthesis — what would change the verdict">
            <div className="md-body"><ReactMarkdown>{briefText}</ReactMarkdown></div>
          </CollapsibleSection>
        )}

        {assemblyText && (
          <CollapsibleSection title="Who was selected, and why" subtitle="The assembly reasoning — who was at the table and who wasn't">
            <div className="md-body"><ReactMarkdown>{assemblyText}</ReactMarkdown></div>
          </CollapsibleSection>
        )}

        <div className="detail-nudge">
          <div>Does this not quite answer your question?</div>
          <Link href="/" className="nudge-link">Ask your own question →</Link>
        </div>
      </div>

      <SiteFooter />

      <style jsx>{`
        .detail-wrap { max-width: 680px; margin: 0 auto; padding: 0 1.25rem; }
        /* Verdict + actions + header now use Tailwind tokens — see JSX above.
           Markdown inner paragraph margins still need a global hook: */
        .verdict-md :global(p) { margin: 0 0 10px; }
        .verdict-md :global(p:last-child) { margin: 0; }
        .reasoning-md :global(p) { margin: 0 0 12px; }
        .reasoning-md :global(p:last-child) { margin: 0; }

        .debate-section { margin: 0 0 2.5rem; }
        .debate-label { font-family: 'Inter', sans-serif; font-size: 11px; color: var(--muted-foreground); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 0.5px solid var(--border); }
        .convergence-block { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 0.5px solid var(--border); }
        .md-body { padding-top: 1rem; font-family: 'Inter', sans-serif; color: var(--foreground); line-height: 1.7; }
        .md-body :global(h2) { font-family: 'Playfair Display', Georgia, serif; font-size: 20px; color: var(--foreground); font-weight: 600; margin: 1.75rem 0 0.5rem; line-height: 1.3; }
        .md-body :global(h2:first-child) { margin-top: 0; }
        .md-body :global(h3) { font-family: 'Playfair Display', Georgia, serif; font-size: 17px; color: var(--foreground); font-weight: 600; margin: 1.25rem 0 0.5rem; }
        .md-body :global(p) { font-size: 15px; margin: 0 0 12px; max-width: 62ch; }
        .md-body :global(em) { font-style: italic; color: var(--foreground); opacity: 0.85; }
        .md-body :global(strong) { font-weight: 600; color: var(--foreground); }
        .md-body :global(hr) { border: none; border-top: 0.5px solid var(--border); margin: 1.5rem 0; }
        .md-body :global(ul), .md-body :global(ol) { padding-left: 1.25rem; margin: 0 0 12px; }
        .md-body :global(li) { font-size: 15px; margin-bottom: 4px; }
        .detail-nudge { margin-top: 3rem; padding-top: 1.5rem; border-top: 0.5px solid var(--border); font-family: 'Inter', sans-serif; font-size: 13px; color: var(--muted-foreground); text-align: center; }
        .detail-nudge > div { margin-bottom: 0.5rem; }
        .nudge-link, .nudge-link :global(*), .nudge-link:hover, .nudge-link:visited { color: var(--primary) !important; text-decoration: none !important; }
        .nudge-link:hover { opacity: 0.75; }
        @media (min-width: 768px) {
          .md-body :global(p), .md-body :global(li) { font-size: 15.5px; }
        }
      `}</style>
    </>
  );
}
