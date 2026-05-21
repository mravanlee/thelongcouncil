import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../../lib/supabase';
import Procession from '../../components/Procession';

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

function nameToAvatarSlug(name) {
  const slug = stripTierSuffix(name).toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[\s.\-]+/g, '_').replace(/[^a-z0-9_]/g, '').replace(/_+/g, '_').replace(/^_|_$/g, '');
  return AVATAR_NAME_EXPANSIONS[slug] || slug;
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
    <div className="cast-row">
      {names.map((name) => {
        const [line1, line2] = splitNameForCast(name);
        const slug = nameToAvatarSlug(name);
        return (
          <div key={name} className="cast-col">
            <div className="cast-avatar">
              <span className="cast-initials">{getInitials(name)}</span>
              <img src={`/avatars/avatar_${slug}.webp`} alt="" className="cast-img" onError={(e) => { e.target.style.display = 'none'; }}/>
            </div>
            <div className="cast-name">{line1}{line2 ? <><br />{line2}</> : null}</div>
          </div>
        );
      })}
      <style jsx>{`
        .cast-row { display: flex; gap: 18px; padding: 4px 0 6px; margin: 0 0 2.5rem; flex-wrap: wrap; }
        .cast-col { display: flex; flex-direction: column; align-items: center; min-width: 64px; }
        .cast-avatar { width: 56px; height: 56px; border-radius: 50%; background: #f3eeea; border: 0.5px solid #c8bdb3; position: relative; display: flex; align-items: center; justify-content: center; overflow: hidden; flex-shrink: 0; }
        .cast-initials { font-family: 'Playfair Display', Georgia, serif; font-size: 14px; font-weight: 600; color: #6b1a1a; letter-spacing: 0.02em; }
        .cast-img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
        .cast-name { font-family: 'Inter', sans-serif; font-size: 11px; color: #4a4a4a; text-align: center; margin-top: 8px; line-height: 1.35; letter-spacing: 0.01em; }
        @media (max-width: 480px) {
          .cast-row { gap: 12px; }
          .cast-col { min-width: 56px; }
          .cast-avatar { width: 48px; height: 48px; }
          .cast-initials { font-size: 12px; }
          .cast-name { font-size: 10.5px; }
        }
      `}</style>
    </div>
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
    <div className="share-row">
      <button className="share-btn" onClick={handleClick} aria-label="Share this session">
        {copied ? (
          <span className="share-btn-content">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
            Link copied
          </span>
        ) : (
          <span className="share-btn-content">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" /><polyline points="16 6 12 2 8 6" /><line x1="12" y1="2" x2="12" y2="15" /></svg>
            Share this session
          </span>
        )}
      </button>
      <style jsx>{`
        .share-row { display: flex; justify-content: center; margin: 2rem 0; }
        .share-btn { display: inline-flex; align-items: center; padding: 12px 24px; background: transparent; border: 1px solid #6b1a1a; color: #6b1a1a; border-radius: 2px; cursor: pointer; font-family: 'Inter', sans-serif; font-size: 14px; letter-spacing: 0.02em; transition: background 0.2s ease, color 0.2s ease; min-width: 200px; justify-content: center; }
        .share-btn:hover { background: #6b1a1a; color: #f8f0e8; }
        .share-btn-content { display: inline-flex; align-items: center; gap: 8px; }
      `}</style>
    </div>
  );
}

function CollapsibleSection({ title, subtitle, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="collapsible">
      <button className="collapsible-header" onClick={() => setOpen(!open)} aria-expanded={open}>
        <div className="collapsible-text">
          <div className="collapsible-title">{title}</div>
          {subtitle && <div className="collapsible-subtitle">{subtitle}</div>}
        </div>
        <span className="collapsible-toggle">{open ? 'Close ↑' : 'Open ↓'}</span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}
      <style jsx>{`
        .collapsible { margin-bottom: 1rem; background: #fdfbf6; border: 0.5px solid #d4cfc8; border-radius: 2px; overflow: hidden; }
        .collapsible-header { width: 100%; display: flex; justify-content: space-between; align-items: center; padding: 1rem 1.25rem; background: transparent; border: none; cursor: pointer; font-family: inherit; text-align: left; color: inherit; }
        .collapsible-header:hover { background: #f5f1e8; }
        .collapsible-title { font-family: 'Playfair Display', Georgia, serif; font-size: 16px; font-weight: 500; color: #0f0f0f; }
        .collapsible-subtitle { font-family: 'Inter', sans-serif; font-size: 13px; color: #7a7a7a; margin-top: 2px; }
        .collapsible-toggle { font-family: 'Inter', sans-serif; font-size: 13px; color: #6b1a1a; white-space: nowrap; margin-left: 12px; }
        .collapsible-body { padding: 0 1.25rem 1.5rem; border-top: 0.5px solid #e8e3d8; }
      `}</style>
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

      <div className="detail-wrap">
        <Link href="/archive" className="back-link">← The Archive</Link>
        <div className="detail-meta">{formatDate(session.created_at)} · {memberCount} member{memberCount !== 1 ? 's' : ''}</div>
        <h1 className="detail-title">{session.original_issue}</h1>
        <VerdictCast names={session.member_names} />

        {verdict && (
          <div className="verdict-block">
            <div className="verdict-label">Verdict</div>
            <div className="verdict-text"><ReactMarkdown>{verdict}</ReactMarkdown></div>
            {reasoning && (
              <>
                <div className="verdict-label verdict-label-second">Reasoning</div>
                <div className="verdict-reasoning"><ReactMarkdown>{reasoning}</ReactMarkdown></div>
              </>
            )}
          </div>
        )}

        {actions.length > 0 && (
          <div className="actions-block">
            <div className="actions-label">What to do now</div>
            <ol className="actions-list">
              {actions.map((action, i) => (
                <li key={i}>{action}</li>
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
          <Link href="/" className="nudge-link">Raise your own issue →</Link>
        </div>
      </div>

      <footer>The Long Council · Counsel from history&apos;s greatest minds, brought to life by AI</footer>

      <style jsx>{`
        .detail-wrap { max-width: 680px; margin: 0 auto; padding: 0 1.25rem; }
        .back-link, .back-link :global(*), .back-link:visited { text-decoration: none !important; color: #7a7a7a !important; }
        .back-link { display: inline-block; font-family: 'Inter', sans-serif; font-size: 13px; margin-top: 2.5rem; margin-bottom: 3rem; transition: color 0.2s ease; }
        .back-link:hover, .back-link:hover :global(*) { color: #6b1a1a !important; }
        .detail-meta { font-family: 'Inter', sans-serif; font-size: 11px; color: #7a7a7a; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 12px; }
        .detail-title { font-family: 'Playfair Display', Georgia, serif; font-size: 26px; color: #0f0f0f; font-weight: 600; line-height: 1.3; margin: 0 0 2.25rem; max-width: 62ch; }
        .verdict-block { background: #f0ede3; border-left: 3px solid #6b1a1a; padding: 1.5rem 1.75rem; border-radius: 0 2px 2px 0; margin-bottom: 2rem; }
        .verdict-label { font-family: 'Inter', sans-serif; font-size: 11px; color: #6b1a1a; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 10px; }
        .verdict-label-second { margin-top: 1.25rem; margin-bottom: 10px; }
        .verdict-text :global(p) { font-family: 'Playfair Display', Georgia, serif; font-size: 18px; color: #0f0f0f; font-weight: 500; line-height: 1.5; margin: 0 0 10px; }
        .verdict-text :global(p:last-child) { margin-bottom: 0; }
        .verdict-reasoning :global(p) { font-family: 'Inter', sans-serif; font-size: 15px; color: #2a2a2a; line-height: 1.7; margin: 0 0 12px; }
        .verdict-reasoning :global(p:last-child) { margin-bottom: 0; }

        .actions-block { background: #efece4; border-left: 3px solid #6b1a1a; padding: 1.25rem 1.5rem 1.4rem; border-radius: 0 2px 2px 0; margin-bottom: 2rem; }
        .actions-label { font-family: 'Inter', sans-serif; font-size: 11px; color: #6b1a1a; letter-spacing: 0.12em; text-transform: uppercase; margin-bottom: 0.85rem; }
        .actions-list { list-style: none; padding: 0; margin: 0; counter-reset: act; }
        .actions-list li { font-family: 'Inter', sans-serif; font-size: 15px; color: #1a1a1a; line-height: 1.55; padding-left: 32px; position: relative; margin-bottom: 0.7rem; }
        .actions-list li:last-child { margin-bottom: 0; }
        .actions-list li::before { counter-increment: act; content: counter(act); position: absolute; left: 0; top: 1px; width: 22px; height: 22px; background: #6b1a1a; color: #faf7f0; border-radius: 50%; font-family: 'Inter', sans-serif; font-size: 11px; font-weight: 600; line-height: 22px; text-align: center; }

        .debate-section { margin: 0 0 2.5rem; }
        .debate-label { font-family: 'Inter', sans-serif; font-size: 11px; color: #7a7a7a; letter-spacing: 0.1em; text-transform: uppercase; margin-bottom: 1.25rem; padding-bottom: 0.75rem; border-bottom: 0.5px solid #d4cfc8; }
        .convergence-block { margin-top: 1.5rem; padding-top: 1.5rem; border-top: 0.5px solid #d4cfc8; }
        .md-body { padding-top: 1rem; font-family: 'Inter', sans-serif; color: #1a1a1a; line-height: 1.7; }
        .md-body :global(h2) { font-family: 'Playfair Display', Georgia, serif; font-size: 20px; color: #0f0f0f; font-weight: 600; margin: 1.75rem 0 0.5rem; line-height: 1.3; }
        .md-body :global(h2:first-child) { margin-top: 0; }
        .md-body :global(h3) { font-family: 'Playfair Display', Georgia, serif; font-size: 17px; color: #0f0f0f; font-weight: 600; margin: 1.25rem 0 0.5rem; }
        .md-body :global(p) { font-size: 15px; margin: 0 0 12px; max-width: 62ch; }
        .md-body :global(em) { font-style: italic; color: #2a2a2a; }
        .md-body :global(strong) { font-weight: 600; color: #0f0f0f; }
        .md-body :global(hr) { border: none; border-top: 0.5px solid #d4cfc8; margin: 1.5rem 0; }
        .md-body :global(ul), .md-body :global(ol) { padding-left: 1.25rem; margin: 0 0 12px; }
        .md-body :global(li) { font-size: 15px; margin-bottom: 4px; }
        .detail-nudge { margin-top: 3rem; padding-top: 1.5rem; border-top: 0.5px solid #d4cfc8; font-family: 'Inter', sans-serif; font-size: 13px; color: #7a7a7a; text-align: center; }
        .detail-nudge > div { margin-bottom: 0.5rem; }
        .nudge-link, .nudge-link :global(*), .nudge-link:hover, .nudge-link:visited { color: #6b1a1a !important; text-decoration: none !important; }
        .nudge-link:hover { opacity: 0.75; }
        @media (min-width: 768px) {
          .detail-title { font-size: 28px; }
          .md-body :global(p), .md-body :global(li) { font-size: 15.5px; }
        }
      `}</style>
    </>
  );
}
