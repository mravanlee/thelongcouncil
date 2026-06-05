import Head from 'next/head';
import { useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { supabase } from '../../lib/supabase';

export async function getServerSideProps(context) {
  const { slug } = context.params;
  const { data: session, error } = await supabase
    .from('sessions')
    .select('*')
    .eq('slug', slug)
    .single();
  if (error || !session) return { notFound: true };
  return { props: { session } };
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

function stripTierSuffix(name) {
  return (name || '').replace(/\s*[—–-]\s*(Practitioner|Framer|Leader|Thinker|Wildcard)(\/\w+)?\s*$/i, '').trim();
}

const normName = (s) => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z]/g, '');
function lookupByName(map, name) {
  if (!map || !name) return null;
  const want = normName(stripTierSuffix(name));
  for (const key of Object.keys(map)) if (normName(stripTierSuffix(key)) === want) return map[key];
  const wl = normName(stripTierSuffix(name).split(/\s+/).pop());
  for (const key of Object.keys(map)) { const kl = normName(stripTierSuffix(key).split(/\s+/).pop()); if (kl && kl.length >= 3 && kl === wl) return map[key]; }
  return null;
}

function parseVerdict(verdictMd) {
  if (!verdictMd) return { verdict: '', reasoning: '' };
  const cleaned = verdictMd.replace(/^CONCLUSION TYPE:.*$/m, '').trim();
  const vM = cleaned.match(/##\s*Verdict\s*\n+([\s\S]*?)(?=\n##\s*Reasoning|$)/i);
  const rM = cleaned.match(/##\s*Reasoning\s*\n+([\s\S]*?)(?=\n---|$)/i);
  return {
    verdict: vM ? vM[1].trim().replace(/^---\s*/m, '').replace(/\s*---\s*$/, '').trim() : '',
    reasoning: rM ? rM[1].trim().replace(/\s*---\s*$/, '').trim() : '',
  };
}

function ActionBlock({ name, actions }) {
  if (!actions || actions.length === 0) return null;
  return (
    <div className="acts">
      <div className="acts-label">What {stripTierSuffix(name)} would do</div>
      {actions.map((a, i) => (
        <div className="act" key={i}><span className="arr">→</span><span>{a}</span></div>
      ))}
    </div>
  );
}

// The brief with each member's actions interleaved under their section-2 paragraph.
function BriefBody({ briefText, memberActions }) {
  const hasActions = memberActions && Object.keys(memberActions).length > 0;
  const m = hasActions ? briefText.match(/^([\s\S]*?##\s*2\.[^\n]*\n)([\s\S]*?)(\n##\s*3\.[\s\S]*)$/) : null;
  if (!m) return <div className="md"><ReactMarkdown>{briefText}</ReactMarkdown></div>;
  const [, before, section2, after] = m;
  const paragraphs = section2.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  return (
    <div className="md">
      <ReactMarkdown>{before}</ReactMarkdown>
      {paragraphs.map((p, i) => {
        const nm = p.match(/^\*\*([^*]+)\*\*/);
        const name = nm ? nm[1] : '';
        const acts = name ? lookupByName(memberActions, name) : null;
        return (
          <div className="mblock" key={i}>
            <ReactMarkdown>{p}</ReactMarkdown>
            {acts && <ActionBlock name={name} actions={acts} />}
          </div>
        );
      })}
      <ReactMarkdown>{after}</ReactMarkdown>
    </div>
  );
}

export default function BriefPrint({ session }) {
  const cards = session.cards || {};
  const question = cards.question_en || session.original_issue || '';
  const date = formatDate(session.created_at);
  const members = (session.member_names || []).map(stripTierSuffix).filter(Boolean).join(', ');
  const { verdict, reasoning } = parseVerdict(cards.verdict);
  const memberActions = cards.member_actions || {};

  // Normalise the section-5 label and drop the brief's own redundant title/tags
  // header (the question + date are already in the document header above).
  let briefText = (cards.brief || '').replace(/What only the policymaker can resolve|What the policymaker must decide/gi, 'For a policymaker to decide on');
  briefText = briefText.replace(/^[\s\S]*?(\*\*Confidence summary:\*\*)/i, '$1');

  // Auto-open the print dialog once the page has settled (fonts loaded).
  useEffect(() => {
    const t = setTimeout(() => { try { window.print(); } catch (e) {} }, 700);
    return () => clearTimeout(t);
  }, []);

  return (
    <>
      <Head>
        <title>{(question || 'Policy brief').slice(0, 70)} — The Long Council</title>
        <meta name="robots" content="noindex" />
      </Head>

      <div className="page">
        <div className="toolbar no-print">
          <button type="button" onClick={() => window.print()} className="savebtn">Save as PDF</button>
          <span className="hint">Choose “Save as PDF” as the destination.</span>
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
            <h1 className="q">{question}</h1>
            <div className="meta">Policy brief · {date}{members ? ` · ${members}` : ''}</div>
          </header>

          {verdict && (
            <section className="verdict">
              <div className="sec-label">Verdict</div>
              <p className="v-line">{verdict}</p>
              {reasoning && <div className="md v-reason"><ReactMarkdown>{reasoning}</ReactMarkdown></div>}
            </section>
          )}

          <hr className="rule" />

          <BriefBody briefText={briefText} memberActions={memberActions} />

          <footer className="doc-foot">
            thelongcouncil.com/archive/{session.slug}
          </footer>
        </article>
      </div>

      <style jsx global>{`
        @page { margin: 18mm 16mm; }
        html, body { background: #ffffff; }
        .page { background: #efe9e1; min-height: 100vh; padding: 28px 16px 60px; }
        .toolbar { max-width: 720px; margin: 0 auto 18px; display: flex; align-items: center; gap: 14px; }
        .savebtn { font-family: 'Inter', sans-serif; font-size: 13px; font-weight: 600; letter-spacing: 0.02em; color: #fff; background: var(--primary); border: none; border-radius: 5px; padding: 9px 16px; cursor: pointer; }
        .savebtn:hover { opacity: 0.9; }
        .hint { font-family: 'Inter', sans-serif; font-size: 12px; color: var(--muted-foreground); }

        .doc { max-width: 720px; margin: 0 auto; background: #fff; color: #1c1714; padding: 46px 52px 40px; box-shadow: 0 1px 14px rgba(0,0,0,0.10); }
        .doc-head { border-bottom: 1px solid rgba(28,23,20,0.14); padding-bottom: 18px; margin-bottom: 22px; }
        .brand { display: inline-flex; align-items: center; gap: 7px; color: var(--primary); font-family: 'Playfair Display', serif; font-size: 13px; font-weight: 600; letter-spacing: 0.14em; text-transform: uppercase; margin-bottom: 14px; }
        .q { font-family: 'Playfair Display', serif; font-size: 27px; line-height: 1.2; font-weight: 600; margin: 0 0 12px; color: #16110e; letter-spacing: -0.01em; }
        .meta { font-family: 'Inter', sans-serif; font-size: 12.5px; color: #6a5d52; }

        .sec-label { font-family: 'Inter', sans-serif; font-size: 10.5px; letter-spacing: 0.14em; text-transform: uppercase; color: var(--primary); font-weight: 700; margin-bottom: 8px; }
        .verdict { margin-bottom: 22px; }
        .v-line { font-family: 'Playfair Display', serif; font-size: 18px; line-height: 1.4; font-weight: 600; margin: 0 0 10px; color: #16110e; }
        .v-reason :global(p) { margin: 0 0 9px; }
        .rule { border: none; border-top: 1px solid rgba(28,23,20,0.14); margin: 0 0 22px; }

        .md { font-family: 'Inter', sans-serif; font-size: 13.5px; line-height: 1.62; color: #1c1714; }
        .md :global(h2) { font-family: 'Playfair Display', serif; font-size: 17px; font-weight: 600; color: #16110e; margin: 1.5rem 0 0.5rem; line-height: 1.3; break-after: avoid; }
        .md :global(h2:first-child) { margin-top: 0; }
        .md :global(p) { margin: 0 0 10px; }
        .md :global(strong) { font-weight: 600; color: #16110e; }
        .md :global(em) { font-style: italic; }
        .mblock { break-inside: avoid; }

        .acts { background: #f3ece0; border: 0.5px solid rgba(28,23,20,0.16); border-radius: 4px; padding: 11px 14px; margin: 8px 0 16px; break-inside: avoid; }
        .acts-label { font-family: 'Inter', sans-serif; font-size: 9.5px; letter-spacing: 0.13em; text-transform: uppercase; color: var(--primary); font-weight: 700; margin-bottom: 8px; }
        .act { display: flex; gap: 9px; font-size: 13px; line-height: 1.5; margin-bottom: 6px; }
        .act:last-child { margin-bottom: 0; }
        .arr { color: var(--primary); font-weight: 700; flex: 0 0 auto; }

        .doc-foot { margin-top: 30px; padding-top: 14px; border-top: 1px solid rgba(28,23,20,0.14); font-family: 'Inter', sans-serif; font-size: 11px; color: #8a7d70; }

        @media print {
          .page { background: #fff; padding: 0; }
          .no-print { display: none !important; }
          .doc { max-width: none; margin: 0; padding: 0; box-shadow: none; }
          .mblock, .acts, .md :global(h2) { break-inside: avoid; }
        }
      `}</style>
    </>
  );
}
