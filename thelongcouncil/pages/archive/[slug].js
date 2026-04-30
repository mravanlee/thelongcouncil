import Head from 'next/head';
import Link from 'next/link';
import { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../../lib/supabase';
import Procession from '../../components/Procession';

// ── Server-side data fetching ──────────────────────────────────────────
export async function getServerSideProps(context) {
  const { slug } = context.params;

  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !session) {
    return { notFound: true };
  }

  return { props: { session } };
}

// ── Helpers ────────────────────────────────────────────────────────────
function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
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
  return md
    .replace(/^SPEAKING ORDER:.*$/m, '')
    .trim();
}

function parseDeliberation(deliberationText) {
  if (!deliberationText) return { cards: [], convergence: null };
  const blocks = deliberationText
    .split(/(?:^|\n)\s*---\s*\n/)
    .map(b => b.trim())
    .filter(Boolean);

  const cards = [];
  let convergence = null;

  for (const block of blocks) {
    if (/^##\s+The convergence note/i.test(block)) {
      convergence = block;
    } else if (block.startsWith('## ') || block.includes('·')) {
      cards.push(block);
    }
  }

  return { cards, convergence };
}

// ── Collapsible section component ──────────────────────────────────────
function CollapsibleSection({ title, subtitle, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="collapsible">
      <button
        className="collapsible-header"
        onClick={() => setOpen(!open)}
        aria-expanded={open}
      >
        <div className="collapsible-text">
          <div className="collapsible-title">{title}</div>
          {subtitle && <div className="collapsible-subtitle">{subtitle}</div>}
        </div>
        <span className="collapsible-toggle">{open ? 'Close ↑' : 'Open ↓'}</span>
      </button>
      {open && <div className="collapsible-body">{children}</div>}

      <style jsx>{`
        .collapsible {
          margin-bottom: 1rem;
          background: #fdfbf6;
          border: 0.5px solid #d4cfc8;
          border-radius: 2px;
          overflow: hidden;
        }
        .collapsible-header {
          width: 100%;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 1rem 1.25rem;
          background: transparent;
          border: none;
          cursor: pointer;
          font-family: inherit;
          text-align: left;
          color: inherit;
        }
        .collapsible-header:hover {
          background: #f5f1e8;
        }
        .collapsible-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 16px;
          font-weight: 500;
          color: #0f0f0f;
        }
        .collapsible-subtitle {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          color: #7a7a7a;
          margin-top: 2px;
        }
        .collapsible-toggle {
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          color: #6b1a1a;
          white-space: nowrap;
          margin-left: 12px;
        }
        .collapsible-body {
          padding: 0 1.25rem 1.5rem;
          border-top: 0.5px solid #e8e3d8;
        }
      `}</style>
    </div>
  );
}

// ── Page component ─────────────────────────────────────────────────────
export default function ArchiveDetail({ session }) {
  const cards = session.cards || {};
  const { verdict, reasoning } = parseVerdict(cards.verdict);
  const deliberationText = cleanDeliberation(cards.deliberation);
  const { cards: deliberationCards, convergence } = parseDeliberation(deliberationText);
  const briefText = cards.brief || '';
  const assemblyText = cards.assembly || '';

  const memberCount = session.member_names ? session.member_names.length : 0;
  const memberSummary = session.member_names && session.member_names.length > 0
    ? session.member_names.slice(0, 4).join(', ') + (session.member_names.length > 4 ? `, +${session.member_names.length - 4} more` : '')
    : '';

  return (
    <>
      <Head>
        <title>{session.original_issue ? session.original_issue.substring(0, 60) : 'Archive'} — The Long Council</title>
        <meta name="description" content={verdict ? verdict.substring(0, 155) : 'A past council deliberation.'} />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
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

        <div className="detail-meta">
          {formatDate(session.created_at)} · {memberCount} member{memberCount !== 1 ? 's' : ''}
        </div>

        <h1 className="detail-title">{session.original_issue}</h1>

        {verdict && (
          <div className="verdict-block">
            <div className="verdict-label">Verdict</div>
            <div className="verdict-text">
              <ReactMarkdown>{verdict}</ReactMarkdown>
            </div>
            {reasoning && (
              <>
                <div className="verdict-label verdict-label-second">Reasoning</div>
                <div className="verdict-reasoning">
                  <ReactMarkdown>{reasoning}</ReactMarkdown>
                </div>
              </>
            )}
          </div>
        )}

        {deliberationText && (
          <CollapsibleSection
            title="The deliberation"
            subtitle={memberSummary ? `Hear from each member in turn — ${memberSummary}` : 'Hear from each member in turn'}
          >
            {deliberationCards.length > 0 ? (
              <div className="deliberation-procession">
                <Procession cards={deliberationCards} instant={true} />
              </div>
            ) : (
              <div className="md-body">
                <ReactMarkdown>{deliberationText}</ReactMarkdown>
              </div>
            )}
            {convergence && (
              <div className="md-body convergence-block">
                <ReactMarkdown>{convergence}</ReactMarkdown>
              </div>
            )}
          </CollapsibleSection>
        )}

        {briefText && (
          <CollapsibleSection
            title="The policy brief"
            subtitle="The analyst's synthesis — what would change the verdict"
          >
            <div className="md-body">
              <ReactMarkdown>{briefText}</ReactMarkdown>
            </div>
          </CollapsibleSection>
        )}

        {assemblyText && (
          <CollapsibleSection
            title="Who was selected, and why"
            subtitle="The assembly reasoning — who was at the table and who wasn't"
          >
            <div className="md-body">
              <ReactMarkdown>{assemblyText}</ReactMarkdown>
            </div>
          </CollapsibleSection>
        )}

        <div className="detail-nudge">
          <div>Does this not quite answer your question?</div>
          <Link href="/" className="nudge-link">Raise your own issue →</Link>
        </div>
      </div>

      <footer>
        The Long Council · Counsel from history's greatest minds, brought to life by AI
      </footer>

      <style jsx>{`
        .detail-wrap {
          max-width: 680px;
          margin: 0 auto;
          padding: 0 1.25rem;
        }
        .back-link,
        .back-link :global(*),
        .back-link:visited {
          text-decoration: none !important;
          color: #7a7a7a !important;
        }
       .back-link {
          display: inline-block;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          margin-top: 2.5rem;
          margin-bottom: 3rem;
          transition: color 0.2s ease;
        }
        .back-link:hover,
        .back-link:hover :global(*) {
          color: #6b1a1a !important;
        }

       .detail-meta {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          color: #7a7a7a;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 12px;
        }

        .detail-title {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 26px;
          color: #0f0f0f;
          font-weight: 600;
          line-height: 1.3;
          margin: 0 0 2rem;
          max-width: 62ch;
        }

        .verdict-block {
          background: #f0ede3;
          border-left: 3px solid #6b1a1a;
          padding: 1.5rem 1.75rem;
          border-radius: 0 2px 2px 0;
          margin-bottom: 2rem;
        }
        .verdict-label {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          color: #6b1a1a;
          letter-spacing: 0.12em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        .verdict-label-second {
          margin-top: 1.25rem;
          margin-bottom: 10px;
        }
        .verdict-text :global(p) {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 18px;
          color: #0f0f0f;
          font-weight: 500;
          line-height: 1.5;
          margin: 0 0 10px;
        }
        .verdict-text :global(p:last-child) { margin-bottom: 0; }
        .verdict-reasoning :global(p) {
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          color: #2a2a2a;
          line-height: 1.7;
          margin: 0 0 12px;
        }
        .verdict-reasoning :global(p:last-child) { margin-bottom: 0; }

        .deliberation-procession {
          padding-top: 1.25rem;
        }
        .convergence-block {
          margin-top: 1.5rem;
          padding-top: 1.5rem;
          border-top: 0.5px solid #d4cfc8;
        }

        .md-body {
          padding-top: 1rem;
          font-family: 'Inter', sans-serif;
          color: #1a1a1a;
          line-height: 1.7;
        }
        .md-body :global(h2) {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 20px;
          color: #0f0f0f;
          font-weight: 600;
          margin: 1.75rem 0 0.5rem;
          line-height: 1.3;
        }
        .md-body :global(h2:first-child) {
          margin-top: 0;
        }
        .md-body :global(h3) {
          font-family: 'Playfair Display', Georgia, serif;
          font-size: 17px;
          color: #0f0f0f;
          font-weight: 600;
          margin: 1.25rem 0 0.5rem;
        }
        .md-body :global(p) {
          font-size: 15px;
          margin: 0 0 12px;
          max-width: 62ch;
        }
        .md-body :global(em) {
          font-style: italic;
          color: #2a2a2a;
        }
        .md-body :global(strong) {
          font-weight: 600;
          color: #0f0f0f;
        }
        .md-body :global(hr) {
          border: none;
          border-top: 0.5px solid #d4cfc8;
          margin: 1.5rem 0;
        }
        .md-body :global(ul),
        .md-body :global(ol) {
          padding-left: 1.25rem;
          margin: 0 0 12px;
        }
        .md-body :global(li) {
          font-size: 15px;
          margin-bottom: 4px;
        }

        .detail-nudge {
          margin-top: 3rem;
          padding-top: 1.5rem;
          border-top: 0.5px solid #d4cfc8;
          font-family: 'Inter', sans-serif;
          font-size: 13px;
          color: #7a7a7a;
          text-align: center;
        }
        .detail-nudge > div {
          margin-bottom: 0.5rem;
        }
        .nudge-link,
        .nudge-link :global(*),
        .nudge-link:hover,
        .nudge-link:visited {
          color: #6b1a1a !important;
          text-decoration: none !important;
        }
        .nudge-link:hover {
          opacity: 0.75;
        }

        @media (min-width: 768px) {
          .detail-title { font-size: 28px; }
          .md-body :global(p),
          .md-body :global(li) { font-size: 15.5px; }
        }
      `}</style>
    </>
  );
}
