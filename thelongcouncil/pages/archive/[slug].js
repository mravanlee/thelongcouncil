import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ArrowLeft, Languages } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import Procession from '../../components/Procession';
import { resolveAvatarSlug, KNOWN_AVATAR_SLUGS } from '../../lib/avatarSlugs';
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

const normName = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');

// Match a name against the keys of a {name: value} object, tolerant of tier
// suffixes, accents and last-name-only references. Returns the value or null.
function lookupByName(map, name) {
  if (!map || !name) return null;
  const want = normName(stripTierSuffix(name));
  const wantLast = normName(stripTierSuffix(name).split(/\s+/).pop());
  for (const key of Object.keys(map)) {
    const k = normName(stripTierSuffix(key));
    if (k === want) return map[key];
  }
  for (const key of Object.keys(map)) {
    const kLast = normName(stripTierSuffix(key).split(/\s+/).pop());
    if (kLast && kLast.length >= 3 && kLast === wantLast) return map[key];
  }
  return null;
}

// The headline size follows the question length so short questions stay
// dramatic and long ones stay readable. Tiers: <=70, 71-140, >140 chars.
function detailTitleSize(len) {
  if (len <= 70) return 'text-[28px] sm:text-[36px]';
  if (len <= 140) return 'text-[24px] sm:text-[30px]';
  return 'text-[22px] sm:text-[26px]';
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

// "Who was selected" renders the original Prompt-1 assembly as a single markdown
// block (exactly the original layout), with three light touches on the source
// text: strip the tier labels (Framer/Practitioner/Leader/Thinker/Wildcard),
// drop the internal [documented]/[inferred]/[extrapolated] coverage tag, and
// inject each member's single strongest real quote as a blockquote under their
// entry in SELECTED MEMBERS. Verified to keep the ordered list intact.
// A member avatar that links to their profile on the council page. Falls back
// to a monogram (no link) for wildcard / off-roster members without an avatar.
function MemberAvatar({ name }) {
  const slug = nameToAvatarSlug(name);
  const clean = stripTierSuffix(name);
  const known = KNOWN_AVATAR_SLUGS.has(slug);
  const inner = known
    ? <img src={`/avatars/avatar_${slug}.webp`} alt={clean} className="mav-img" />
    : <span className="mav-mono">{getInitials(name)}</span>;
  if (!known) return <span className="mav mav-static" aria-hidden="true">{inner}</span>;
  return (
    <Link href={`/council#m-${slug}`} className="mav" title={`${clean} — bekijk profiel`} aria-label={`${clean} profiel`}>
      {inner}
    </Link>
  );
}

// Bold the top-level scaffolding labels so the section has clear hierarchy
// (these structural markers should read above the member names/field labels).
const boldAssemblyLabels = (s) => s.replace(/^(\s*)(ISSUE SUMMARY|TAXONOMY TAGS|CENTRAL TENSION|POLES & BALANCE|SELECTED MEMBERS|MEMBERS CONSIDERED BUT NOT SELECTED|CONFIDENCE NOTE)(\s*:)/gim, '$1**$2$3**');

// Format one SELECTED MEMBERS entry into the markdown shown beside the avatar:
// drop the leading number and the bold name line (the name is in the row header),
// bold Relevance / Coverage / Will argue on their own lines, append the quote.
function buildMemberContent(entry, briefQuotes) {
  let e = entry.replace(/^\s*\d+\.\s*/, '');
  // The first line is the member name. The model formats it inconsistently
  // ("**Name** — Tier", "**Name — Tier**", or bare "Name — Tier"), so don't
  // match a fixed shape: take the whole first line, strip bold + tier to get
  // the name, then drop the entire line (the name is shown in the row header).
  // This keeps the tier from ever leaking into the body, in any format.
  const firstLine = (e.split('\n')[0] || '');
  const name = stripTierSuffix(firstLine.replace(/\*\*/g, '').trim());
  e = e.replace(/^[^\n]*\n?/, '');
  e = e.replace(/(Relevance|Coverage|Will argue)\s*:/gi, '**$1:**');
  e = e.replace(/[ \t]*\n[ \t]*(\*\*(?:Relevance|Coverage|Will argue):\*\*)/g, '  \n$1');
  e = e.trim();
  const info = (briefQuotes && name) ? lookupByName(briefQuotes, name) : null;
  const q = info && info.quotes && info.quotes[0];
  if (q && q.text) {
    const src = q.source + (q.translation ? `, ${q.translation}` : '');
    e += `\n\n> “${q.text}”\n>\n> — ${src}`;
  }
  return { name, md: e };
}

function WhoWasSelected({ assembly, briefQuotes }) {
  let text = assembly || '';
  // Strip the tier label in any format the model emits: inside the bold
  // ("**John Rawls — Framer**"), after the bold ("**John Rawls** — Framer"),
  // or bare ("John Rawls — Framer"). This also cleans the names listed in the
  // "Members considered but not selected" section.
  text = text.replace(/(\*\*[^*\n]*?)\s*[—–-]\s*(?:Practitioner|Framer|Leader|Thinker|Wildcard)(?:\s*\/\s*(?:Practitioner|Framer|Leader|Thinker|Wildcard))?(\*\*)/g, '$1$2');
  text = text.replace(/(\*\*[^*\n]+?\*\*|[^\n—–-]+?)\s*[—–-]\s*(?:Practitioner|Framer|Leader|Thinker|Wildcard)(?:\s*\/\s*(?:Practitioner|Framer|Leader|Thinker|Wildcard))?(?=\s*$)/gim, '$1');
  // Drop the internal coverage tag, e.g. "[documented] — ".
  text = text.replace(/\[(?:documented|inferred|extrapolated)\]\s*[—–-]?\s*/gi, '');
  const m = text.match(/(SELECTED MEMBERS:[^\n]*\n+)([\s\S]*?)(\n\s*(?:MEMBERS CONSIDERED BUT NOT SELECTED|CONFIDENCE NOTE)\s*:[\s\S]*|$)/i);
  if (!m) return <div className="md-body"><ReactMarkdown>{boldAssemblyLabels(text)}</ReactMarkdown></div>;
  const before = boldAssemblyLabels(text.slice(0, m.index) + m[1]);
  const after = boldAssemblyLabels(m[3]);
  const entries = m[2].split(/\n(?=\s*\d+\.\s)/).map((e) => e.trim()).filter(Boolean);
  return (
    <div className="md-body">
      <ReactMarkdown>{before}</ReactMarkdown>
      {entries.map((entry, i) => {
        const { name, md } = buildMemberContent(entry, briefQuotes);
        return (
          <div className="member-row" key={i}>
            <MemberAvatar name={name} />
            <div className="member-content">
              <div className="member-name">{name}</div>
              <ReactMarkdown>{md}</ReactMarkdown>
            </div>
          </div>
        );
      })}
      <ReactMarkdown>{after}</ReactMarkdown>
    </div>
  );
}

// The policy brief, with each member's "What X would do" actions interleaved
// directly under their paragraph in section 2. Falls back to a plain render if
// the brief lacks the expected section structure or has no member actions.
function MemberActionBlock({ name, actions }) {
  if (!actions || actions.length === 0) return null;
  return (
    <div className="bm-actions">
      <div className="bm-actions-label">What {stripTierSuffix(name)} would do</div>
      {actions.map((act, i) => (
        <div className="bm-action" key={i}><span className="bm-arrow">→</span><span>{act}</span></div>
      ))}
    </div>
  );
}

function BriefWithActions({ briefText, memberActions }) {
  const hasActions = memberActions && Object.keys(memberActions).length > 0;
  const m = hasActions ? briefText.match(/^([\s\S]*?##\s*2\.[^\n]*\n)([\s\S]*?)(\n##\s*3\.[\s\S]*)$/) : null;
  if (!m) return <div className="md-body"><ReactMarkdown>{briefText}</ReactMarkdown></div>;
  const [, before, section2, after] = m;
  const paragraphs = section2.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="md-body">
      <ReactMarkdown>{before}</ReactMarkdown>
      {paragraphs.map((p, i) => {
        const nm = p.match(/^\*\*([^*]+)\*\*/);
        const name = nm ? nm[1] : '';
        const acts = name ? lookupByName(memberActions, name) : null;
        if (!name) return <div className="bm-block" key={i}><ReactMarkdown>{p}</ReactMarkdown></div>;
        return (
          <div className="member-row" key={i}>
            <MemberAvatar name={name} />
            <div className="member-content">
              <ReactMarkdown>{p}</ReactMarkdown>
              {acts && <MemberActionBlock name={name} actions={acts} />}
            </div>
          </div>
        );
      })}
      <ReactMarkdown>{after}</ReactMarkdown>
    </div>
  );
}

function VerdictCast({ names }) {
  if (!names || names.length === 0) return null;
  return (
    <ul className="mb-10 mt-10 flex flex-wrap gap-x-3 gap-y-4 sm:gap-x-4">
      {names.map((name) => {
        const [line1, line2] = splitNameForCast(name);
        const slug = nameToAvatarSlug(name);
        const anchor = `speaker-${slug}`;
        return (
          <li
            key={name}
            className="flex w-14 flex-col items-center text-center sm:w-16"
          >
            <a
              href={`#${anchor}`}
              title={`Jump to ${stripTierSuffix(name)}'s contribution`}
              onClick={(e) => {
                if (typeof document === 'undefined') return;
                const el = document.getElementById(anchor);
                if (!el) return;
                e.preventDefault();
                el.scrollIntoView({ behavior: 'smooth', block: 'start' });
                if (window.history && window.history.replaceState) {
                  window.history.replaceState(null, '', `#${anchor}`);
                }
              }}
              className="group flex flex-col items-center"
            >
              <div className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-full border border-border bg-secondary transition group-hover:border-primary group-hover:ring-2 group-hover:ring-primary/30 sm:h-14 sm:w-14">
                <span
                  className="text-[12px] font-semibold text-primary sm:text-[13px]"
                  style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
                >
                  {getInitials(name)}
                </span>
                {KNOWN_AVATAR_SLUGS.has(slug) && (
                  <img
                    src={`/avatars/avatar_${slug}.webp`}
                    alt=""
                    className="absolute inset-0 h-full w-full object-cover"
                    onError={(e) => {
                      e.target.style.display = 'none';
                    }}
                  />
                )}
              </div>
              <div className="mt-2 text-[10px] leading-tight text-muted-foreground transition group-hover:text-foreground sm:text-[11px]">
                {line1}
                {line2 ? (
                  <>
                    <br />
                    {line2}
                  </>
                ) : null}
              </div>
            </a>
          </li>
        );
      })}
    </ul>
  );
}

// Sharing the card IMAGE as media — not the link — is what makes the preview
// reliable. A link preview depends on X/WhatsApp asynchronously crawling a
// brand-new URL, which loses a race when you share a just-created session
// (especially in a reply), so the card silently fails to appear. Attaching the
// PNG as media removes that dependency entirely: the image always shows,
// standalone or reply, fresh or not. Each tier below degrades safely to the
// next, so the worst case is exactly the old link-copy behaviour.
async function fetchCardFile(imageUrl) {
  if (!imageUrl) return null;
  const res = await fetch(imageUrl);
  if (!res.ok) return null;
  const blob = await res.blob();
  return new File([blob], 'the-long-council.png', { type: blob.type || 'image/png' });
}

function ShareButton({ url, question, imageUrl }) {
  const [status, setStatus] = useState('idle'); // 'idle' | 'img' | 'link'
  const cleanQuestion = (question || '').trim().replace(/\s+/g, ' ');
  const shareText = `"${cleanQuestion}" — debated by The Long Council`;
  const linkText = `${shareText}\n\n${url}`;

  async function handleClick() {
    // 1) Native share sheet with the card image attached — touch devices only.
    //    On desktop the OS sheet often lacks X as a target, so desktop skips to
    //    the clipboard path (paste into the composer). Image rides along as
    //    media either way, so the preview never depends on a crawl.
    const isTouch = typeof window !== 'undefined' && window.matchMedia && window.matchMedia('(pointer: coarse)').matches;
    if (isTouch && typeof navigator !== 'undefined' && navigator.canShare && imageUrl) {
      try {
        const file = await fetchCardFile(imageUrl);
        if (file && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: shareText, url });
          return;
        }
      } catch (e) { if (e && e.name === 'AbortError') return; }
    }

    // 2) Desktop: copy the card image to the clipboard so it can be pasted
    //    straight into the post composer (⌘/Ctrl+V) as an always-visible image.
    //    The promise form keeps Safari's user-activation valid through the fetch.
    if (typeof navigator !== 'undefined' && navigator.clipboard && typeof window !== 'undefined' && window.ClipboardItem && imageUrl) {
      try {
        const item = new window.ClipboardItem({ 'image/png': fetch(imageUrl).then((r) => r.blob()) });
        await navigator.clipboard.write([item]);
        setStatus('img');
        setTimeout(() => setStatus('idle'), 3000);
        return;
      } catch (e) {}
    }

    // 3) Last resort: copy the link (the preview then waits on the crawl).
    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(linkText);
        setStatus('link');
        setTimeout(() => setStatus('idle'), 2000);
        return;
      } catch (e) {}
    }
    if (typeof window !== 'undefined') window.prompt('Copy this link:', linkText);
  }

  const done = status !== 'idle';
  const label = status === 'img' ? 'Card image copied' : status === 'link' ? 'Link copied' : 'Share this session';

  return (
    <div className="flex flex-col items-center my-8">
      <button
        onClick={handleClick}
        aria-label="Share this session"
        className="group inline-flex min-w-[200px] items-center justify-center gap-2 rounded-sm border border-primary px-6 py-3 text-[13px] tracking-wide text-primary transition hover:bg-primary"
      >
        {done ? (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="transition group-hover:[stroke:var(--color-primary-foreground)]"><polyline points="20 6 9 17 4 12" /></svg>
            <span className="transition group-hover:[color:var(--color-primary-foreground)]">{label}</span>
          </>
        ) : (
          <>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="transition group-hover:[stroke:var(--color-primary-foreground)]"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
            <span className="transition group-hover:[color:var(--color-primary-foreground)]">Share this session</span>
          </>
        )}
      </button>
      {status === 'img' && (
        <div className="mt-2 text-[12px] text-muted-foreground">Paste it into your post (⌘/Ctrl+V) — the preview always shows.</div>
      )}
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
  // Rename the old "What only the policymaker can resolve" heading/label to the
  // clearer "What the policymaker must decide" for existing sessions too.
  const PM_OLD = /What only the policymaker can resolve|What the policymaker must decide/gi;
  const PM_NEW = 'For a policymaker to decide on';
  const deliberationText = cleanDeliberation(cards.deliberation).replace(PM_OLD, PM_NEW);
  const { cards: deliberationCards, convergence } = parseDeliberation(deliberationText);
  const briefText = (cards.brief || '').replace(PM_OLD, PM_NEW);
  const assemblyText = cards.assembly || '';
  const actions = Array.isArray(cards.actions) ? cards.actions.filter(Boolean) : [];

  // Questions asked in another language are stored translated (cards.question_en)
  // with the source language name (cards.question_lang). The site is English-first:
  // the English version is the canonical headline used everywhere (title, OG,
  // structured data, share), and the detail page offers an X-style toggle to view
  // the original. Sessions without a translation fall back to the original question.
  const questionLang = cards.question_lang || null;
  const hasTranslation = !!(cards.question_en && questionLang && !/^english$/i.test(questionLang));
  const englishQuestion = cards.question_en || session.original_issue;
  const [showOriginal, setShowOriginal] = useState(false);
  const displayQuestion = hasTranslation && showOriginal ? session.original_issue : englishQuestion;
  // Size by the longer of both versions so the headline never overflows and
  // does not jump size when toggling between English and the original.
  const titleSizeClass = detailTitleSize(Math.max((englishQuestion || '').length, (session.original_issue || '').length));

  const memberCount = session.member_names ? session.member_names.length : 0;
  const memberSummary = session.member_names && session.member_names.length > 0
    ? session.member_names.slice(0, 4).map(stripTierSuffix).join(', ') + (session.member_names.length > 4 ? `, +${session.member_names.length - 4} more` : '')
    : '';

  const pageTitle = englishQuestion ? englishQuestion.substring(0, 60) : 'Archive';
  const pageDescription = verdict ? verdict.substring(0, 155) : 'A past council debate.';

  const baseShareUrl = `https://www.thelongcouncil.com/archive/${session.slug}`;
  const canonicalUrl = memberQuery ? `${baseShareUrl}?member=${encodeURIComponent(memberQuery)}` : baseShareUrl;
  // Per-member shares (?member=) get THAT member's card. The OG endpoint now
  // handles ?member safely: it features the member when they have a portrait,
  // and falls back to a roster member with a portrait otherwise — so the card is
  // never empty/broken (this used to return a 0-byte PNG, hence the old caveat).
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
        '@type': 'BreadcrumbList',
        '@id': `${baseShareUrl}#breadcrumbs`,
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: 'Home', item: 'https://www.thelongcouncil.com/' },
          { '@type': 'ListItem', position: 2, name: 'The Archive', item: 'https://www.thelongcouncil.com/archive' },
          { '@type': 'ListItem', position: 3, name: englishQuestion },
        ],
      },
      {
        '@type': 'Article',
        '@id': `${baseShareUrl}#article`,
        headline: englishQuestion,
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
          name: englishQuestion,
          text: englishQuestion,
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
                url: wikipediaUrl,
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
        <meta property="og:title" content={englishQuestion || 'The Long Council'} />
        <meta property="og:description" content={pageDescription} />
        <meta property="og:url" content={canonicalUrl} />
        <meta property="og:image" content={ogImageUrl} />
        <meta property="og:image:width" content="840" />
        <meta property="og:image:height" content="441" />
        <meta property="og:image:alt" content={`${englishQuestion}, The Long Council`} />
        <meta property="og:site_name" content="The Long Council" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content={englishQuestion || 'The Long Council'} />
        <meta name="twitter:description" content={pageDescription} />
        <meta name="twitter:image" content={ogImageUrl} />
        <link rel="canonical" href={canonicalUrl} />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
        />
      </Head>

      <div className="min-h-screen bg-background text-foreground antialiased">
      <SiteHeader />

      <section className="border-b border-border/70">
        <div className="mx-auto max-w-[680px] px-5 pt-10 pb-10">
          <Link
            href="/archive"
            className="inline-flex items-center gap-2 text-[11px] tracking-[0.22em] uppercase text-primary transition hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            The Archive
          </Link>
          <div className="mt-4 text-[11px] tracking-[0.22em] uppercase text-muted-foreground">
            {formatDate(session.created_at)} · {memberCount} member{memberCount !== 1 ? 's' : ''}
          </div>
          <h1
            className={`mt-4 max-w-[62ch] ${titleSizeClass} font-semibold leading-[1.18] tracking-tight text-foreground`}
            style={{ fontFamily: "'Playfair Display', Georgia, serif" }}
          >
            {displayQuestion}
          </h1>
          {hasTranslation && (
            <button
              type="button"
              onClick={() => setShowOriginal((v) => !v)}
              className="mt-3 inline-flex items-center gap-2 text-[12px] text-muted-foreground transition hover:text-foreground"
              aria-label={showOriginal ? 'Show the English translation' : `Show the original ${questionLang} question`}
            >
              <Languages className="h-3.5 w-3.5 shrink-0" />
              {showOriginal ? (
                <span>
                  <span className="text-foreground">{questionLang} (original)</span>
                  {' · '}
                  <span className="font-semibold text-primary">Show English</span>
                </span>
              ) : (
                <span>
                  Translated from {questionLang}
                  {' · '}
                  <span className="font-semibold text-primary">Show original</span>
                </span>
              )}
            </button>
          )}
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

        <ShareButton url={baseShareUrl} question={englishQuestion || 'The Long Council'} imageUrl={ogImageUrl} />

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
            <a href={`/brief/${session.slug}`} target="_blank" rel="noopener noreferrer" className="brief-save">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                <polyline points="7 10 12 15 17 10" />
                <line x1="12" y1="15" x2="12" y2="3" />
              </svg>
              <span>Save policy brief</span>
            </a>
            <BriefWithActions briefText={briefText} memberActions={cards.member_actions || {}} />
          </CollapsibleSection>
        )}

        {assemblyText && (
          <CollapsibleSection title="Who was selected, and why" subtitle="The table — who was at it, who wasn't, and in their own words">
            <WhoWasSelected assembly={assemblyText} briefQuotes={cards.brief_quotes || {}} />
          </CollapsibleSection>
        )}

        <div className="detail-nudge">
          <div>Does this not quite answer your question?</div>
          <Link href="/" className="nudge-link">Ask your own question →</Link>
        </div>
      </div>

      <SiteFooter />
      </div>

      <style jsx>{`
        .detail-wrap { max-width: 680px; margin: 0 auto; padding: 0 1.25rem; }
        .brief-save { display: inline-flex; align-items: center; gap: 0.5rem; margin: 0.6rem 0 0.2rem; font-family: 'Inter', sans-serif; font-size: 11.5px; font-weight: 600; letter-spacing: 0.06em; text-transform: uppercase; color: var(--primary); text-decoration: none; border: 0.5px solid var(--border); border-radius: 5px; padding: 0.5rem 0.85rem; transition: border-color 0.15s, background 0.15s; }
        .brief-save:hover { border-color: var(--primary); background: var(--secondary); }
        /* Verdict + actions + header now use Tailwind tokens — see JSX above.
           Markdown inner paragraph margins still need a global hook: */
        .verdict-md :global(p) { margin: 0 0 10px; }
        .verdict-md :global(p:last-child) { margin: 0; }
        .reasoning-md :global(p) { margin: 0 0 12px; }
        .reasoning-md :global(p:last-child) { margin: 0; }

        .debate-section { margin: 0 0 2.5rem; }
        .debate-label { font-family: 'Inter', sans-serif; font-size: 11px; color: var(--muted-foreground); letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 0.5px solid var(--border); }
        .convergence-block { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 0.5px solid var(--border); }
        .detail-nudge { margin-top: 3rem; padding-top: 1.5rem; border-top: 0.5px solid var(--border); font-family: 'Inter', sans-serif; font-size: 13px; color: var(--muted-foreground); text-align: center; }
        .detail-nudge > div { margin-bottom: 0.5rem; }
        .nudge-link, .nudge-link :global(*), .nudge-link:hover, .nudge-link:visited { color: var(--primary) !important; text-decoration: none !important; }
        .nudge-link:hover { opacity: 0.75; }
      `}</style>
      <style jsx global>{`
        /* These render inside child components (WhoWasSelected, BriefWithActions),
           which fall outside this page's styled-jsx scope, so their styles must
           be global. */
        .md-body { padding-top: 1.5rem; font-family: 'Inter', sans-serif; color: var(--foreground); line-height: 1.7; }
        .md-body h2 { font-family: 'Playfair Display', Georgia, serif; font-size: 20px; color: var(--foreground); font-weight: 600; margin: 1.75rem 0 0.5rem; line-height: 1.3; }
        .md-body h2:first-child { margin-top: 0; }
        .md-body h3 { font-family: 'Playfair Display', Georgia, serif; font-size: 17px; color: var(--foreground); font-weight: 600; margin: 1.25rem 0 0.5rem; }
        .md-body p { font-size: 15px; margin: 0 0 12px; max-width: 62ch; }
        .md-body em { font-style: italic; color: var(--foreground); opacity: 0.85; }
        .md-body strong { font-weight: 600; color: var(--foreground); }
        .md-body hr { border: none; border-top: 0.5px solid var(--border); margin: 1.5rem 0; }
        .md-body ul, .md-body ol { padding-left: 1.25rem; margin: 0 0 12px; }
        .md-body li { font-size: 15px; margin-bottom: 6px; }
        /* clear separation between the numbered members in "Who was selected" */
        .md-body ol > li { margin-bottom: 1.9rem; }
        .md-body ol > li:last-child { margin-bottom: 0.5rem; }
        /* one real quote under each member in "Who was selected" */
        .md-body blockquote { margin: 1.1rem 0 0.4rem; padding: 0.2rem 0 0.2rem 1.1rem; border-left: 2px solid var(--border); }
        .md-body blockquote p { font-family: 'Playfair Display', Georgia, serif; font-style: italic; font-size: 16px; line-height: 1.45; color: var(--foreground); margin: 0; max-width: 62ch; }
        .md-body blockquote p + p { font-family: 'Inter', sans-serif; font-style: normal; font-size: 12px; color: var(--muted-foreground); margin: 0.25rem 0 0; }
        /* per-member "What X would do" action box in the policy brief */
        .bm-block { margin-bottom: 0.6rem; }
        .bm-actions { background: var(--secondary, #ede4d3); border: 0.5px solid var(--border); border-radius: 4px; padding: 1.05rem 1.25rem; margin: 1rem 0 2.4rem; }
        .bm-actions-label { font-family: 'Inter', sans-serif; font-size: 10.5px; letter-spacing: 0.12em; text-transform: uppercase; color: var(--primary); font-weight: 600; margin-bottom: 0.85rem; }
        .bm-action { display: flex; gap: 0.6rem; font-size: 14px; line-height: 1.55; color: var(--foreground); margin-bottom: 0.7rem; font-family: 'Inter', sans-serif; }
        .bm-action:last-child { margin-bottom: 0; }
        .bm-arrow { color: var(--primary); font-weight: 700; flex: 0 0 auto; }
        /* Member rows with a clickable avatar (brief section 2 + who-was-selected) */
        .member-row { display: flex; gap: 0.9rem; align-items: flex-start; margin-top: 1.7rem; padding-top: 1.7rem; border-top: 0.5px solid var(--border); }
        .member-row:last-of-type { margin-bottom: 0.4rem; }
        .member-content { flex: 1; min-width: 0; }
        .member-content > p:first-child { margin-top: 0; }
        .member-content .bm-actions:last-child { margin-bottom: 0; }
        .member-name { font-family: 'Inter', sans-serif; font-weight: 600; font-size: 16px; color: var(--foreground); margin: 0.1rem 0 0.45rem; }
        .mav { flex: 0 0 auto; display: block; width: 42px; height: 42px; border-radius: 9999px; overflow: hidden; border: 0.5px solid var(--border); background: var(--secondary, #ede4d3); text-decoration: none; }
        .mav-img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .mav-mono { display: flex; align-items: center; justify-content: center; width: 100%; height: 100%; font-family: 'Playfair Display', Georgia, serif; font-size: 14px; font-weight: 600; color: var(--primary); }
        a.mav { transition: border-color 0.15s, box-shadow 0.15s; }
        a.mav:hover { border-color: var(--primary); box-shadow: 0 0 0 2px rgba(107,26,26,0.15); }
        @media (min-width: 768px) {
          .md-body p, .md-body li { font-size: 15.5px; }
        }
      `}</style>
    </>
  );
}
