import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Procession from '../components/Procession';
import { supabase } from '../lib/supabase';
import { SiteFooter, SiteHeader, SERIF } from '../components/SiteChrome';
import { Check, FileText, MessagesSquare, Scale, Users } from 'lucide-react';

function StepDot({ state, Icon }) {
  if (state === 'done') {
    return (
      <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground">
        <Check className="h-4 w-4" strokeWidth={3} />
      </span>
    );
  }
  if (state === 'active') {
    return (
      <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center">
        <span className="absolute inset-0 rounded-full bg-primary/25 animate-ping" />
        <span className="relative grid h-10 w-10 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm">
          <Icon className="h-4 w-4" strokeWidth={2} />
        </span>
      </span>
    );
  }
  return (
    <span className="relative z-10 grid h-10 w-10 shrink-0 place-items-center rounded-full border border-border bg-background text-muted-foreground/60">
      <Icon className="h-4 w-4" strokeWidth={1.75} />
    </span>
  );
}

// ── Recovery polling constants ──────────────────────────────────────────
const FINALIZE_POLL_INTERVAL_MS = 5000;
const FINALIZE_MAX_ATTEMPTS = 60;
const RECENT_SESSION_WINDOW_MINUTES = 10;

// ── Wake Lock helpers ───────────────────────────────────────────────────
async function acquireScreenLock(ref) {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
  try { ref.current = await navigator.wakeLock.request('screen'); } catch (e) {}
}

async function releaseScreenLock(ref) {
  if (!ref || !ref.current) return;
  try { await ref.current.release(); } catch (e) {}
  ref.current = null;
}

// ── Format session counter ──────────────────────────────────────────────
function formatSessionCount(n) {
  if (n == null) return '000';
  if (n < 1000) return n.toString().padStart(3, '0');
  return n.toLocaleString('en-US');
}

// ── Council member metadata ─────────────────────────────────────────────
// SYNC: also defined in pages/council.js, Procession.jsx, archive/[slug].js.
// Keep these aligned when adding new members. See CLAUDE.md sync rules.
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

const MEMBER_ROLES = {
  'Albert Hirschman': 'Economist · Exit, Voice and Loyalty',
  'Ali ibn Abi Talib': 'Fourth Caliph of Islam',
  'Amartya Sen': 'Economist · Development as Freedom',
  'Confucius': 'Philosopher · The Analects',
  'David Ben-Gurion': 'Prime Minister, Israel 1948–63',
  'Deng Xiaoping': 'Paramount Leader, China 1978–92',
  'Eleanor Roosevelt': 'Human rights architect',
  'Elinor Ostrom': 'Economist · Governing the Commons',
  'Ellen Johnson Sirleaf': 'President, Liberia 2006–18',
  'Franklin D. Roosevelt': 'President, United States 1933–45',
  'Frantz Fanon': 'Philosopher · The Wretched of the Earth',
  'Friedrich Hayek': 'Economist · The Road to Serfdom',
  'Hannah Arendt': 'Philosopher · The Origins of Totalitarianism',
  'Helmut Schmidt': 'Chancellor, West Germany 1974–82',
  'Ibn Khaldun': 'Historian · The Muqaddimah',
  'Indira Gandhi': 'Prime Minister, India 1966–84',
  'Jawaharlal Nehru': 'Prime Minister, India 1947–64',
  'Jean-Jacques Rousseau': 'Philosopher · The Social Contract',
  'John Locke': 'Philosopher · Two Treatises of Government',
  'John Maynard Keynes': 'Economist · The General Theory',
  'John Rawls': 'Philosopher · A Theory of Justice',
  'Julius Nyerere': 'President, Tanzania 1964–85',
  'Kautilya': 'Statesman · The Arthashastra',
  'Konrad Adenauer': 'Chancellor, West Germany 1949–63',
  'Lee Kuan Yew': 'Prime Minister, Singapore 1959–90',
  'Mahathir Mohamad': 'Prime Minister, Malaysia 1981–2003',
  'Margaret Thatcher': 'Prime Minister, United Kingdom 1979–90',
  'Milton Friedman': 'Economist · Capitalism and Freedom',
  'Mustafa Kemal Ataturk': 'President, Turkey 1923–38',
  'Nelson Mandela': 'President, South Africa 1994–99',
  'Niccolo Machiavelli': 'Statesman · The Prince',
  'Olof Palme': 'Prime Minister, Sweden 1969–86',
  'Raul Prebisch': 'Economist · Dependency Theory',
  'Rosa Luxemburg': 'Revolutionary theorist',
  'Simon Bolivar': 'President, Gran Colombia 1819–30',
  'Sun Tzu': 'Strategist · The Art of War',
  'Wangari Maathai': 'Political ecologist · The Green Belt Movement',
};

function normalizeAccents(s) {
  return (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '');
}

function memberSlug(name) {
  if (!name) return '';
  const base = normalizeAccents(name)
    .replace(/\s*\([^)]*\)/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return AVATAR_NAME_EXPANSIONS[base] || base;
}

function memberRole(name) {
  if (!name) return '';
  // Direct hit
  if (MEMBER_ROLES[name]) return MEMBER_ROLES[name];
  // Try accent-normalized match
  const target = normalizeAccents(name).toLowerCase();
  for (const [k, v] of Object.entries(MEMBER_ROLES)) {
    if (normalizeAccents(k).toLowerCase() === target) return v;
  }
  return '';
}

function memberMonogram(name) {
  if (!name) return '?';
  const words = name.split(/\s+/).filter(w => w && !/^(de|von|van|ibn|al)$/i.test(w));
  if (words.length === 1) return words[0][0].toUpperCase();
  return (words[0][0] + words[words.length - 1][0]).toUpperCase();
}

// ── Server-side props ───────────────────────────────────────────────────
export async function getServerSideProps() {
  const recentPromise = supabase
    .from('sessions')
    .select('id, slug, original_issue, created_at, cards, featured_quote, featured_quote_member, member_names, member_types')
    .order('created_at', { ascending: false })
    .limit(4);

  const countPromise = supabase
    .from('sessions')
    .select('*', { count: 'exact', head: true });

  const [recentResult, countResult] = await Promise.all([recentPromise, countPromise]);

  if (recentResult.error) console.error('[homepage] Failed to load recent sessions:', recentResult.error);
  if (countResult.error) console.error('[homepage] Failed to load session count:', countResult.error);

  const sessions = recentResult.data || [];
  const sessionCount = countResult.count ?? 0;

  const enriched = sessions
    .filter(s => s.cards && s.cards.brief)
    .map(s => ({
      id: s.id,
      slug: s.slug,
      original_issue: s.original_issue,
      created_at: s.created_at,
      teaser: extractTeaser(s.cards),
      featured_quote: s.featured_quote || null,
      featured_quote_member: s.featured_quote_member || null,
      member_names: (s.member_names || []).slice(0, 5),
    }));

  return { props: { recentSessions: enriched, sessionCount } };
}

function stripTier(name) {
  return (name || '').replace(/\s*[—–-]\s*(Practitioner|Framer|Leader|Thinker|Wildcard)(\/\w+)?\s*$/i, '').trim();
}

const EXAMPLE_QUESTIONS = [
  'Should the EU build an army?',
  'How can we protect democratic institutions?',
  'Should AI be regulated?',
  'How should wealth be redistributed?',
];

function extractTeaser(cards) {
  if (!cards || !cards.verdict) return '';
  const match = cards.verdict.match(/##\s*Verdict\s*\n+([^\n#]+(?:\n[^\n#]+)*)/i);
  if (!match) return '';
  const firstPara = match[1].trim().split(/\n\s*\n/)[0].replace(/\s+/g, ' ');
  if (firstPara.length > 240) {
    const trimmed = firstPara.substring(0, 240);
    const lastPeriod = trimmed.lastIndexOf('.');
    return lastPeriod > 100 ? trimmed.substring(0, lastPeriod + 1) : trimmed + '…';
  }
  return firstPara;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

// ── Recent session card with avatar + pull-quote ───────────────────────
// Monogram is rendered up front; the image is layered on top and removes
// itself via onError when the file is missing (e.g. when the pipeline added
// a non-roster historical figure). This avoids the browser-default broken
// image icon flashing while React updates state.
function RecentSessionAvatar({ name }) {
  const slug = memberSlug(name);
  return (
    <div className="rs-avatar" aria-hidden="true">
      <span className="rs-avatar-monogram">{memberMonogram(name)}</span>
      {slug && (
        <img
          src={`/avatars/avatar_${slug}.webp`}
          alt=""
          onError={(e) => { e.target.style.display = 'none'; }}
        />
      )}
    </div>
  );
}

function RecentSessionCard({ session }) {
  const s = session;
  const hasQuote = !!(s.featured_quote && s.featured_quote_member);
  return (
    <Link href={`/archive/${s.slug}`} className="recent-item">
      {hasQuote ? (
        <>
          <div className="rs-header">
            <RecentSessionAvatar name={s.featured_quote_member} />
            <div className="rs-byline">
              <div className="rs-name">{s.featured_quote_member}</div>
              {memberRole(s.featured_quote_member) && (
                <div className="rs-role">{memberRole(s.featured_quote_member)}</div>
              )}
              <div className="rs-date">{formatDate(s.created_at)}</div>
            </div>
          </div>
          <p className="rs-quote">{s.featured_quote}</p>
          <p className="rs-question">On: <span>{s.original_issue}</span></p>
        </>
      ) : (
        <>
          <div className="recent-date">{formatDate(s.created_at)}</div>
          <h3 className="recent-title">{s.original_issue}</h3>
          {s.teaser && <p className="recent-teaser">{s.teaser}</p>}
        </>
      )}
    </Link>
  );
}

async function findRecentSessionByQuestion(question) {
  const sinceIso = new Date(Date.now() - RECENT_SESSION_WINDOW_MINUTES * 60_000).toISOString();
  try {
    const { data, error } = await supabase
      .from('sessions')
      .select('slug, cards, created_at')
      .eq('original_issue', question)
      .gte('created_at', sinceIso)
      .order('created_at', { ascending: false })
      .limit(1);
    if (error) return null;
    if (!data || data.length === 0) return null;
    const session = data[0];
    if (!session.cards || !session.cards.brief) return null;
    return session;
  } catch (e) { return null; }
}

// ── VerdictCast helpers ─────────────────────────────────────────────────
// NOTE: stripTierSuffix handles both old (Practitioner|Framer) and new (Leader|Thinker) suffixes.
// Do not remove Practitioner|Framer — old sessions in Supabase use those values.
function stripTierSuffix(name) {
  return name.replace(/\s*[—–-]\s*(Practitioner|Framer|Leader|Thinker|Wildcard)\s*$/i, '').trim();
}

function nameToAvatarSlug(name) {
  return stripTierSuffix(name)
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[\s.\-]+/g, '_')
    .replace(/[^a-z0-9_]/g, '')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '');
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

function extractMemberNamesFromCards(cards) {
  return cards.map(card => {
    const match = card.match(/^##\s+(.+)$/m);
    return match ? match[1].trim() : null;
  }).filter(Boolean);
}

// ── VerdictCast component ───────────────────────────────────────────────
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
              <img src={`/avatars/avatar_${slug}.webp`} alt="" className="cast-img" onError={(e) => { e.target.style.display = 'none'; }} />
            </div>
            <div className="cast-name">{line1}{line2 ? <><br />{line2}</> : null}</div>
          </div>
        );
      })}
      <style jsx>{`
        .cast-row { display: flex; gap: 18px; padding: 4px 0 6px; margin: 0 0 2rem; flex-wrap: wrap; }
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

// ── ShareButton component ───────────────────────────────────────────────
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

// ── Markdown renderer ───────────────────────────────────────────────────
function Markdown({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  const blocks = [];
  let currentPara = [];

  const flushPara = () => {
    if (currentPara.length > 0) {
      blocks.push({ type: 'p', content: currentPara.join(' ') });
      currentPara = [];
    }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) { flushPara(); continue; }
    if (line.startsWith('### ')) { flushPara(); blocks.push({ type: 'h3', content: line.slice(4) }); }
    else if (line.startsWith('## ')) { flushPara(); blocks.push({ type: 'h2', content: line.slice(3) }); }
    else if (line.startsWith('# ')) { flushPara(); blocks.push({ type: 'h1', content: line.slice(2) }); }
    else if (line === '---' || line === '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━') { flushPara(); }
    else { currentPara.push(line); }
  }
  flushPara();

  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === 'h1') return <h1 key={i} className="md-h1">{renderInline(block.content)}</h1>;
        if (block.type === 'h2') return <h2 key={i} className="md-h2">{renderInline(block.content)}</h2>;
        if (block.type === 'h3') return <h3 key={i} className="md-h3">{renderInline(block.content)}</h3>;

        const raw = block.content;
        const isFraming = raw.length >= 3 && raw[0] === '*' && raw[1] !== '*' && raw[raw.length - 1] === '*' && raw[raw.length - 2] !== '*';
        const isChallenge = /^\*\*Challenge\b/i.test(raw);

        if (isFraming) return <p key={i} className="md-framing">{renderInline(raw.slice(1, -1))}</p>;
        if (isChallenge) return <p key={i} className="md-challenge">{renderInline(raw)}</p>;
        return <p key={i} className="md-p">{renderInline(raw)}</p>;
      })}
    </>
  );
}

function renderInline(text) {
  const parts = [];
  const pattern = /(\*\*[^*]+\*\*|\*[^*]+\*)/g;
  let lastIndex = 0;
  let key = 0;
  let match;
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index));
    const m = match[0];
    if (m.startsWith('**')) parts.push(<strong key={key++}>{m.slice(2, -2)}</strong>);
    else parts.push(<em key={key++}>{m.slice(1, -1)}</em>);
    lastIndex = match.index + m.length;
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex));
  return parts.length === 0 ? text : parts;
}

function parseCards(deliberationText) {
  if (!deliberationText) return [];
  let cleaned = deliberationText.replace(/^SPEAKING ORDER:.*$/im, '').trim();
  const blocks = cleaned.split(/(?:^|\n)\s*---\s*\n/).map(b => b.trim()).filter(Boolean);
  const PREAMBLE_KEYWORDS = /\b(engine|output|analysis|preamble|overview|assembly|session context|introduction|deliberation engine|verdict engine|conclusion type)\b/i;
  return blocks.filter(b => {
    if (b.length < 50) return false;
    if (/^SPEAKING ORDER:/i.test(b)) return false;
    if (/^CONVERGENCE/i.test(b)) return false;
    if (/^##\s*The convergence note/i.test(b)) return false;
    const firstHeadingMatch = b.match(/^##\s+(.+)$/m);
    if (firstHeadingMatch) {
      const headingText = firstHeadingMatch[1].trim();
      const looksLikeName = /^[A-ZÀ-Ý][\wÀ-ÿ'-]*(\s+(?:[a-zA-ZÀ-ÿ][\wÀ-ÿ'-]*))*$/.test(headingText);
      if (PREAMBLE_KEYWORDS.test(headingText) && !looksLikeName) return false;
    }
    if (/\*\*Central Tension:\*\*/i.test(b)) return false;
    if (/\*\*Issue Analysis\*\*/i.test(b)) return false;
    return true;
  });
}

function parseConvergence(deliberationText) {
  if (!deliberationText) return null;
  const blocks = deliberationText.split(/(?:^|\n)\s*---\s*\n/).map(b => b.trim()).filter(Boolean);
  const newBlock = blocks.find(b => /^##\s*The convergence note/i.test(b));
  if (newBlock) return newBlock;
  const oldMatch = deliberationText.match(/CONVERGENCE NOTE:\s*([\s\S]*?)$/i);
  return oldMatch ? oldMatch[1].trim() : null;
}

function parseVerdict(verdictText) {
  if (!verdictText) return { verdict: '', summary: '' };
  const newVerdictMatch = verdictText.match(/##\s*Verdict\s*\n([\s\S]*?)(?=\n##\s*Reasoning|$)/i);
  const newReasoningMatch = verdictText.match(/##\s*Reasoning\s*\n([\s\S]*?)(?=\n---|$)/i);
  if (newVerdictMatch) {
    return {
      verdict: newVerdictMatch[1].trim(),
      summary: newReasoningMatch ? newReasoningMatch[1].trim() : '',
    };
  }
  const oldVerdictMatch = verdictText.match(/VERDICT:\s*([\s\S]*?)(?=REASONING SUMMARY:|$)/i);
  const oldSummaryMatch = verdictText.match(/REASONING SUMMARY:\s*([\s\S]*?)(?=---|$)/i);
  return {
    verdict: oldVerdictMatch ? oldVerdictMatch[1].trim() : verdictText,
    summary: oldSummaryMatch ? oldSummaryMatch[1].trim() : '',
  };
}

// ── Main component ──────────────────────────────────────────────────────
export default function Home({ recentSessions = [], sessionCount = 0 }) {
  const router = useRouter();

  const [screen, setScreen] = useState('landing');
  const [question, setQuestion] = useState('');

  const [chatHistory, setChatHistory] = useState([]);
  const [sharpenerMode, setSharpenerMode] = useState(null);
  const [readyQuestion, setReadyQuestion] = useState(null);
  const [clarifyingQuestion, setClarifyingQuestion] = useState(null);
  const [sharpenerExplanation, setSharpenerExplanation] = useState('');
  const [sharpenerInput, setSharpenerInput] = useState('');
  const [sharpenerLoading, setSharpenerLoading] = useState(false);

  const [confirmedQuestion, setConfirmedQuestion] = useState('');
  const [loadingStep, setLoadingStep] = useState(0);
  const [loadingMessage, setLoadingMessage] = useState('');

  const [sessionData, setSessionData] = useState(null);
  const [sessionSlug, setSessionSlug] = useState(null);
  const [showConclusion, setShowConclusion] = useState(false);
  const [showBriefToggle, setShowBriefToggle] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);

  const [error, setError] = useState(null);

  const textareaRef = useRef(null);
  const wakeLockRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [question]);

  useEffect(() => {
    return () => {
      if (wakeLockRef.current) {
        wakeLockRef.current.release().catch(() => {});
        wakeLockRef.current = null;
      }
    };
  }, []);

  function applySharpenerResponse(data) {
    setSharpenerMode(data.mode);
    setSharpenerExplanation(data.explanation || '');
    if (data.mode === 'ready') {
      setReadyQuestion(data.question);
      setClarifyingQuestion(null);
    } else if (data.mode === 'clarify') {
      setClarifyingQuestion(data.clarifyingQuestion);
      setReadyQuestion(null);
    }
  }

  async function handleSubmit() {
    const q = question.trim();
    if (!q) return;
    setError(null);
    setSharpenerLoading(true);
    try {
      const msgs = [{ role: 'user', content: q }];
      const res = await fetch('/api/sharpen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'The sharpener could not process your question.');
      const assistantMsg = { role: 'assistant', content: data.raw || '' };
      setChatHistory([...msgs, assistantMsg]);
      applySharpenerResponse(data);
      setScreen('sharpening');
    } catch (e) {
      setError({ title: 'Something went wrong', message: e.message || 'The council could not be reached. Please try again.', action: 'submit' });
      setScreen('error');
    } finally {
      setSharpenerLoading(false);
    }
  }

  async function handleSharpenerReply() {
    const reply = sharpenerInput.trim();
    if (!reply || sharpenerLoading) return;
    const newUserMsg = { role: 'user', content: reply };
    const updatedHistory = [...chatHistory, newUserMsg];
    setSharpenerInput('');
    setError(null);
    setSharpenerLoading(true);
    try {
      const res = await fetch('/api/sharpen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedHistory }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'The sharpener could not process your reply.');
      const assistantMsg = { role: 'assistant', content: data.raw || '' };
      setChatHistory([...updatedHistory, assistantMsg]);
      applySharpenerResponse(data);
    } catch (e) {
      setError({ title: 'Something went wrong', message: e.message || 'The council could not be reached. Please try again.', action: 'reply' });
      setScreen('error');
    } finally {
      setSharpenerLoading(false);
    }
  }

  async function pollForCompletedSession(originalQuestion) {
    for (let attempt = 0; attempt < FINALIZE_MAX_ATTEMPTS; attempt++) {
      const session = await findRecentSessionByQuestion(originalQuestion);
      if (session && session.slug) return session.slug;
      await new Promise(resolve => setTimeout(resolve, FINALIZE_POLL_INTERVAL_MS));
    }
    return null;
  }

  async function runPipeline(finalQuestion) {
    setConfirmedQuestion(finalQuestion);
    setError(null);
    setSessionSlug(null);
    setScreen('loading');
    setLoadingStep(1);
    setLoadingMessage('Assembling the council...');

    await acquireScreenLock(wakeLockRef);

    try {
      const res = await fetch('/api/pipeline', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: finalQuestion }),
      });

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let currentEvent = '';
      const result = {};

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('event: ')) {
            currentEvent = line.slice(7).trim();
          } else if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6));
              if (currentEvent === 'session-started') {
                if (data.slug) setSessionSlug(data.slug);
              } else if (currentEvent === 'progress') {
                setLoadingMessage(data.message);
                if (data.step) setLoadingStep(data.step);
              } else if (currentEvent === 'assembly') {
                result.assembly = data.data;
              } else if (currentEvent === 'deliberation') {
                result.deliberation = data.data;
                setLoadingStep(3);
              } else if (currentEvent === 'verdict') {
                result.verdict = data.data;
                setLoadingStep(4);
              } else if (currentEvent === 'actions') {
                result.actions = Array.isArray(data.data) ? data.data : [];
              } else if (currentEvent === 'brief') {
                result.brief = data.data;
              } else if (currentEvent === 'complete') {
                if (data.slug) setSessionSlug(data.slug);
              } else if (currentEvent === 'error') {
                throw new Error(data.message);
              }
            } catch (parseErr) {
              if (currentEvent === 'error') throw new Error('Pipeline failed');
            }
          }
        }
      }

      const cards = parseCards(result.deliberation || '');
      const convergence = parseConvergence(result.deliberation || '');
      const { verdict, summary } = parseVerdict(result.verdict || '');
      const memberNames = extractMemberNamesFromCards(cards);

      setSessionData({
        question: finalQuestion,
        cards,
        convergence,
        verdict,
        verdictSummary: summary,
        brief: result.brief || '',
        assembly: result.assembly || '',
        deliberation: result.deliberation || '',
        actions: Array.isArray(result.actions) ? result.actions : [],
        memberNames,
      });

      setScreen('session');
    } catch (err) {
      setScreen('finalizing');
      const slug = await pollForCompletedSession(finalQuestion);
      if (slug) {
        router.push(`/archive/${slug}`);
        return;
      }
      setError({ title: 'The council could not convene', message: err.message || 'Something went wrong while preparing the debate.', action: 'pipeline' });
      setScreen('error');
    } finally {
      await releaseScreenLock(wakeLockRef);
    }
  }

  function reset() {
    setScreen('landing');
    setQuestion('');
    setChatHistory([]);
    setSharpenerMode(null);
    setReadyQuestion(null);
    setClarifyingQuestion(null);
    setSharpenerExplanation('');
    setSharpenerInput('');
    setConfirmedQuestion('');
    setSessionData(null);
    setSessionSlug(null);
    setShowConclusion(false);
    setShowBriefToggle(false);
    setBriefOpen(false);
    setLoadingStep(0);
    setError(null);
  }

  function handleErrorRetry() {
    if (!error) return;
    const retryAction = error.action;
    setError(null);
    if (retryAction === 'submit') { setScreen('landing'); handleSubmit(); }
    else if (retryAction === 'reply') { setScreen('sharpening'); }
    else if (retryAction === 'pipeline') { runPipeline(confirmedQuestion); }
    else { setScreen('landing'); }
  }

  function handleProcessionComplete() {
    setTimeout(() => setShowConclusion(true), 400);
    setTimeout(() => setShowBriefToggle(true), 1000);
  }

  const STEPS = [
    {
      label: 'Assembling the council',
      description: 'Selecting the members whose work speaks most directly to the question.',
      icon: Users,
      step: 1,
    },
    {
      label: 'The council is in session',
      description: 'Each speaks in turn, building on, pushing back, grounding every claim in what they did or wrote.',
      icon: MessagesSquare,
      step: 2,
    },
    {
      label: 'Forming the verdict',
      description: 'Synthesising the strongest threads into a single, defensible position.',
      icon: Scale,
      step: 3,
    },
    {
      label: 'Writing the policy brief',
      description: 'Three concrete actions you can take from here.',
      icon: FileText,
      step: 4,
    },
  ];

  return (
    <>
      <Head>
        <title>The Long Council</title>
        <meta name="description" content="Ask a hard question. Watch history's greatest minds debate it. See what they decide." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
        <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
        <meta property="og:type" content="website" />
        <meta property="og:title" content="The Long Council" />
        <meta property="og:description" content="Ask a hard question. Watch history's greatest minds debate it. See what they decide." />
        <meta property="og:url" content="https://www.thelongcouncil.com/" />
        <meta property="og:image" content="https://www.thelongcouncil.com/og-default.png" />
        <meta property="og:image:width" content="1200" />
        <meta property="og:image:height" content="630" />
        <meta property="og:image:alt" content="The Long Council — History's counsel on today's questions" />
        <meta property="og:site_name" content="The Long Council" />
        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="The Long Council" />
        <meta name="twitter:description" content="Ask a hard question. Watch history's greatest minds debate it. See what they decide." />
        <meta name="twitter:image" content="https://www.thelongcouncil.com/og-default.png" />
      </Head>

      <SiteHeader />

      {screen === 'landing' && (
        <>
          {/* [1] Featured: today's council session */}
          {recentSessions.length > 0 && (
            <section className="border-b border-border/70">
              <div className="mx-auto max-w-5xl px-6 py-16 lg:py-20">
                <div className="text-[11px] tracking-[0.22em] uppercase text-primary">
                  Question for the council
                </div>
                <h1
                  className="mt-5 max-w-4xl text-[28px] leading-[1.1] tracking-tight text-foreground sm:text-[36px] lg:text-[44px]"
                  style={SERIF}
                >
                  {recentSessions[0].original_issue}
                </h1>

                <div className="my-10 flex items-center gap-3">
                  <span className="h-px flex-1 bg-border/70" />
                  <span className="text-[11px] tracking-[0.22em] uppercase text-primary">
                    ↓ The council answered
                  </span>
                  <span className="h-px flex-1 bg-border/70" />
                </div>

                <div className="relative">
                  <span
                    aria-hidden
                    className="pointer-events-none absolute -top-4 -left-1 select-none text-[56px] leading-none text-primary/20 sm:-top-6 sm:-left-2 sm:text-[72px]"
                    style={SERIF}
                  >
                    “
                  </span>
                  <p
                    className="relative max-w-3xl pl-6 text-[22px] leading-[1.4] text-foreground sm:pl-10 sm:text-[24px]"
                    style={SERIF}
                  >
                    {recentSessions[0].teaser}
                  </p>
                </div>

                {recentSessions[0].member_names && recentSessions[0].member_names.length > 0 && (
                  <ul className="mt-10 flex flex-wrap gap-x-6 gap-y-5">
                    {recentSessions[0].member_names.map((rawName) => {
                      const name = stripTier(rawName);
                      return (
                        <li key={name} className="flex w-20 flex-col items-center text-center">
                          <RecentSessionAvatar name={name} />
                          <div className="mt-2 text-[11px] leading-tight text-muted-foreground">
                            {name}
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}

                <div className="mt-10">
                  <Link
                    href={`/archive/${recentSessions[0].slug}`}
                    className="inline-flex text-[12px] tracking-[0.2em] uppercase font-semibold text-primary hover:text-foreground transition"
                  >
                    Read the full response →
                  </Link>
                </div>
              </div>
            </section>
          )}

          {/* [2] Ask a question */}
          <section
            id="ask"
            className="border-b border-border/70 bg-secondary"
          >
            <div className="mx-auto max-w-4xl px-6 py-16 sm:py-20">
              <div className="text-[11px] tracking-[0.22em] uppercase text-muted-foreground">
                Ask a question of your own
              </div>
              <h2
                className="mt-3 text-[28px] leading-tight tracking-tight sm:text-[36px]"
                style={SERIF}
              >
                Have a question of your own?
              </h2>
              <p className="mt-4 max-w-2xl text-[15px] leading-relaxed text-muted-foreground">
                The council will bring together the right leaders and thinkers,
                debate, and deliver a verdict.
              </p>

              <div className="mt-10 flex w-full flex-col gap-3 border-b-2 border-foreground/40 pb-3 focus-within:border-foreground sm:flex-row sm:items-center">
                <input
                  ref={textareaRef}
                  type="text"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault();
                      handleSubmit();
                    }
                  }}
                  placeholder="Type your question here"
                  className="w-full flex-1 bg-transparent py-3 text-[18px] text-foreground placeholder:text-muted-foreground/70 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!question.trim() || sharpenerLoading}
                  className="inline-flex shrink-0 items-center justify-center gap-2 rounded-sm bg-primary px-5 py-2.5 text-[13px] font-medium tracking-wide text-primary-foreground transition hover:bg-primary/90 disabled:opacity-35 disabled:cursor-not-allowed"
                  style={SERIF}
                >
                  {sharpenerLoading ? 'Considering…' : 'Ask the council'}
                  <span aria-hidden>→</span>
                </button>
              </div>

              <div className="mt-6 text-[11px] tracking-[0.18em] uppercase text-muted-foreground">
                Or try one of these
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {EXAMPLE_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setQuestion(q)}
                    className="max-w-full cursor-pointer rounded-sm border border-border bg-background px-3 py-2 text-left text-[13px] leading-snug text-foreground/80 transition hover:border-primary/60 hover:text-foreground"
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* [3] Recent council sessions */}
          {recentSessions.length > 1 && (
            <section id="sessions" className="border-b border-border/70">
              <div className="mx-auto max-w-5xl px-6 py-14">
                <h2
                  className="text-[28px] tracking-tight"
                  style={SERIF}
                >
                  Recent council sessions
                </h2>

                <ol className="mt-8 divide-y divide-border/70 border-y border-border/70">
                  {recentSessions.slice(1).map((s) => (
                    <li key={s.id} className="py-9 transition hover:bg-card/40">
                      <Link href={`/archive/${s.slug}`} className="block">
                        <div className="text-[11px] tracking-[0.2em] uppercase text-muted-foreground">
                          {formatDate(s.created_at)}
                        </div>
                        <div className="mt-4 border-l border-border pl-5">
                          <p className="text-[14px] leading-relaxed text-muted-foreground">
                            {s.original_issue}
                          </p>
                          {s.featured_quote && (
                            <blockquote
                              className="mt-3 max-w-2xl text-[20px] leading-[1.35] tracking-tight text-foreground"
                              style={SERIF}
                            >
                              “{s.featured_quote}”
                            </blockquote>
                          )}
                          <div className="mt-5 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
                            {s.featured_quote_member && (
                              <div className="flex items-center gap-3">
                                <RecentSessionAvatar name={stripTier(s.featured_quote_member)} />
                                <div className="text-[12px] leading-tight">
                                  <div className="font-medium text-foreground" style={SERIF}>
                                    {stripTier(s.featured_quote_member)}
                                  </div>
                                </div>
                              </div>
                            )}
                            <span className="text-[11px] tracking-[0.2em] uppercase font-semibold text-primary">
                              See council session →
                            </span>
                          </div>
                        </div>
                      </Link>
                    </li>
                  ))}
                </ol>

                <div className="mt-8">
                  <Link
                    href="/archive"
                    className="inline-flex text-[12px] tracking-[0.2em] uppercase font-semibold text-primary hover:text-foreground transition"
                  >
                    Browse all sessions →
                  </Link>
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {screen === 'sharpening' && (
        <div className="sharpener">
          <div className="sharpener-heading">Before the council assembles</div>

          {sharpenerLoading && (
            <div className="chat-thread">
              <div className="chat-msg council">
                <div className="chat-bubble" style={{ color: '#9a9a9a', fontStyle: 'italic' }}>Considering...</div>
              </div>
            </div>
          )}

          {!sharpenerLoading && sharpenerMode === 'ready' && readyQuestion && (() => {
            const normalise = (s) => (s || '').trim().toLowerCase().replace(/[?!.\s]+$/, '');
            const wasSharpened = normalise(readyQuestion) !== normalise(question);
            return (
              <div className="proposed-box">
                <div className="proposed-label">{wasSharpened ? 'The council will start the debate' : 'Your question is clear'}</div>
                <div className="proposed-text">{readyQuestion}</div>
                {wasSharpened && <div className="proposed-original">You asked: <span>{question}</span></div>}
                {sharpenerExplanation && <div className="proposed-explanation">{sharpenerExplanation}</div>}
                <div className="proposed-actions">
                  <button className="btn-accept" onClick={() => runPipeline(readyQuestion)}>Convene the council →</button>
                </div>
              </div>
            );
          })()}

          {!sharpenerLoading && sharpenerMode === 'clarify' && clarifyingQuestion && (
            <>
              <div className="sharpener-original">Your question: {question}</div>
              <div className="clarify-box">
                <div className="clarify-label">One quick question</div>
                <div className="clarify-question">{clarifyingQuestion}</div>
                {sharpenerExplanation && <div className="clarify-explanation">{sharpenerExplanation}</div>}
              </div>
              <div className="sharpen-input-row">
                <input
                  className="sharpen-input"
                  type="text"
                  placeholder="Your answer..."
                  value={sharpenerInput}
                  onChange={e => setSharpenerInput(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') handleSharpenerReply(); }}
                  autoFocus
                />
                <button className="sharpen-send" onClick={handleSharpenerReply} disabled={!sharpenerInput.trim() || sharpenerLoading}>→</button>
              </div>
              <div className="skip-row">
                <button className="btn-skip" onClick={() => runPipeline(question)}>Skip — use my original question</button>
              </div>
            </>
          )}
        </div>
      )}

      {screen === 'loading' && (
        <main className="flex-1 flex items-center justify-center px-6 py-16">
          <div className="w-full max-w-xl">
            <div className="text-center text-[11px] tracking-[0.22em] uppercase text-primary">
              Council in session
            </div>
            <h1
              className="mt-6 text-center text-[26px] leading-[1.3] tracking-tight text-foreground sm:text-[30px]"
              style={{ ...SERIF, fontStyle: 'italic' }}
            >
              &ldquo;{confirmedQuestion}&rdquo;
            </h1>

            <ol className="mt-14 relative">
              <div className="pointer-events-none absolute left-[19px] top-2 bottom-2 w-px bg-border" aria-hidden />
              <div
                className="pointer-events-none absolute left-[19px] top-2 w-px bg-primary transition-all duration-500"
                style={{ height: `calc(${(Math.max(0, loadingStep - 1) / (STEPS.length - 1)) * 100}% - 16px)` }}
                aria-hidden
              />

              {STEPS.map(({ label, description, icon: Icon, step }) => {
                const state = step < loadingStep ? 'done' : step === loadingStep ? 'active' : 'upcoming';
                return (
                  <li key={step} className="relative flex gap-5 pb-7 last:pb-0">
                    <StepDot state={state} Icon={Icon} />
                    <div className="flex-1 pt-1">
                      <div
                        className={
                          state === 'active'
                            ? 'text-[17px] font-medium text-foreground'
                            : state === 'done'
                              ? 'text-[16px] text-foreground/70'
                              : 'text-[16px] text-muted-foreground/70'
                        }
                      >
                        {label}
                      </div>
                      <div
                        className={`mt-1 text-[13px] leading-[1.55] ${
                          state === 'active' ? 'text-foreground/70' : 'text-muted-foreground/60'
                        }`}
                      >
                        {description}
                      </div>
                    </div>
                  </li>
                );
              })}
            </ol>

            <p
              className="mt-12 text-center text-[14px] italic text-muted-foreground"
              style={SERIF}
            >
              This takes 1–2 minutes. The council does not rush.
            </p>
          </div>
        </main>
      )}

      {screen === 'finalizing' && (
        <div className="loading">
          <div className="finalizing-title">The council is still in session</div>
          <div className="loading-question">&quot;{confirmedQuestion}&quot;</div>
          <p className="finalizing-message">
            Your debate is taking longer than usual. We&apos;ll show you the result when it arrives.
          </p>
          <div className="loading-steps">
            <div className="loading-step active">
              <div className="step-dot" />
              <span>Still working...</span>
            </div>
          </div>
          <div className="finalizing-actions">
            <Link href="/archive" className="finalizing-archive">
              Find my session in the Archive →
            </Link>
            <button className="finalizing-reset" onClick={reset}>
              Start a new question
            </button>
          </div>
        </div>
      )}

      {screen === 'error' && error && (
        <div className="error-screen">
          <div className="error-box">
            <div className="error-title">{error.title}</div>
            <div className="error-message">{error.message}</div>
            <div className="error-actions">
              <button className="error-retry" onClick={handleErrorRetry}>Try again</button>
              <button className="error-reset" onClick={reset}>Start over</button>
            </div>
          </div>
        </div>
      )}

      {screen === 'session' && sessionData && (
        <div className="session">
          <div className="session-issue">{sessionData.question}</div>
          <div className="session-meta">
            {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}Counsel from history&apos;s greatest minds
          </div>

          {sessionData.cards.length > 0 ? (
            <Procession
              cards={sessionData.cards}
              onComplete={handleProcessionComplete}
              sessionSlug={sessionSlug}
            />
          ) : (
            <div className="rcard visible">
              <div className="card-body">
                <Markdown text={sessionData.deliberation || 'Debate not available.'} />
              </div>
            </div>
          )}

          <div className={`conc-wrap ${showConclusion ? 'visible' : ''}`}>
            <div className="sec-head">
              <div className="sec-rule" />
              <div className="sec-lbl">The council&apos;s conclusion</div>
              <div className="sec-rule" />
            </div>

            <VerdictCast names={sessionData.memberNames} />

            <div className="conc-bar">
              <div className="conc-lbl">The Long Council · Verdict</div>
              <div className="conc-verdict">
                <Markdown text={sessionData.verdict} />
              </div>
              {sessionData.verdictSummary && (
                <div className="conc-summary">
                  <Markdown text={sessionData.verdictSummary} />
                </div>
              )}
            </div>

            {sessionData.actions && sessionData.actions.length > 0 && (
              <div className="actions-block">
                <div className="actions-label">What to do now</div>
                <ol className="actions-list">
                  {sessionData.actions.map((action, i) => (
                    <li key={i}>{action}</li>
                  ))}
                </ol>
              </div>
            )}

            {sessionSlug && (
              <ShareButton
                url={`https://www.thelongcouncil.com/archive/${sessionSlug}`}
                question={sessionData.question}
              />
            )}
          </div>

          <div className={`brief-toggle-row ${showBriefToggle ? 'visible' : ''}`}>
            <button className="brief-toggle-btn" onClick={() => setBriefOpen(!briefOpen)}>
              <span>{briefOpen ? 'Close policy brief' : 'Read the full policy brief'}</span>
              <span style={{ fontSize: 11, transition: 'transform 0.3s', transform: briefOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>
            <div className={`brief-content ${briefOpen ? 'open' : ''}`}>
              <Markdown text={sessionData.brief} />
            </div>
          </div>

          <div className="new-session-row">
            <button className="new-session-btn" onClick={reset}>Ask a new question</button>
          </div>
        </div>
      )}

      <SiteFooter />

      <style jsx global>{`
        .issue-input {
          width: 100%;
          box-sizing: border-box;
          background: #f3eeea;
          border: 1px solid #d8cfc7;
          border-radius: 2px;
          padding: 16px 18px;
          font-family: 'Inter', sans-serif;
          font-size: 15px;
          line-height: 1.7;
          color: #1a1a1a;
          resize: none;
          outline: none;
          transition: border-color 0.2s ease, background 0.2s ease;
          -webkit-appearance: none;
          appearance: none;
        }
        .issue-input::placeholder { color: #a09a92; font-style: italic; line-height: 1.7; opacity: 1; }
        .issue-input::-webkit-input-placeholder { color: #a09a92; font-style: italic; line-height: 1.7; }
        .issue-input:hover { border-color: #c4b8ad; }
        .issue-input:focus { border-color: #6b1a1a; background: #faf6f3; }
        .landing-lead { font-family: 'Inter', sans-serif; font-size: 17px; line-height: 1.4; color: #2a2a2a; font-weight: 400; margin: 0 0 1.75rem; }
        .landing-lead em { font-style: italic; }
        .landing-divider { width: 60px; height: 1px; background: #d4cfc8; margin: 0 0 1.75rem; }
        .landing-heading { font-family: 'Playfair Display', Georgia, serif; font-size: 24px; font-weight: 600; color: #0f0f0f; line-height: 1.25; margin: 0 0 1rem; }
        @media (min-width: 768px) { .landing-heading { font-size: 24px; } }
        @media (max-width: 720px) { .nav-raise-hide-mobile { display: none; } }
      `}</style>
    </>
  );
}
