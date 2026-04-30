import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Procession from '../components/Procession';
import { supabase } from '../lib/supabase';

// ── Recovery polling constants ──────────────────────────────────────────
const FINALIZE_POLL_INTERVAL_MS = 3000;
const FINALIZE_MAX_ATTEMPTS = 15;
const RECENT_SESSION_WINDOW_MINUTES = 10;

// ── Wake Lock helpers ───────────────────────────────────────────────────
async function acquireScreenLock(ref) {
  if (typeof navigator === 'undefined' || !('wakeLock' in navigator)) return;
  try {
    ref.current = await navigator.wakeLock.request('screen');
  } catch (e) {}
}

async function releaseScreenLock(ref) {
  if (!ref || !ref.current) return;
  try {
    await ref.current.release();
  } catch (e) {}
  ref.current = null;
}

// ── Server-side: fetch 3 most recent sessions for homepage ─────────────
export async function getServerSideProps() {
  const { data: sessions, error } = await supabase
    .from('sessions')
    .select('id, slug, original_issue, created_at, cards')
    .order('created_at', { ascending: false })
    .limit(3);

  if (error) {
    console.error('[homepage] Failed to load recent sessions:', error);
    return { props: { recentSessions: [] } };
  }

  const enriched = (sessions || [])
    .filter(s => s.cards && s.cards.brief)
    .map(s => ({
      id: s.id,
      slug: s.slug,
      original_issue: s.original_issue,
      created_at: s.created_at,
      teaser: extractTeaser(s.cards),
    }));

  return { props: { recentSessions: enriched } };
}

function extractTeaser(cards) {
  if (!cards || !cards.verdict) return '';
  const match = cards.verdict.match(/##\s*Verdict\s*\n+([^\n#]+(?:\n[^\n#]+)*)/i);
  if (!match) return '';
  const firstPara = match[1].trim().split(/\n\s*\n/)[0];
  if (firstPara.length > 240) {
    const trimmed = firstPara.substring(0, 240);
    const lastPeriod = trimmed.lastIndexOf('.');
    return lastPeriod > 100 ? trimmed.substring(0, lastPeriod + 1) : trimmed + '…';
  }
  return firstPara;
}

function formatDate(iso) {
  const d = new Date(iso);
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
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
  } catch (e) {
    return null;
  }
}

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
    if (!line) {
      flushPara();
      continue;
    }
    if (line.startsWith('### ')) {
      flushPara();
      blocks.push({ type: 'h3', content: line.slice(4) });
    } else if (line.startsWith('## ')) {
      flushPara();
      blocks.push({ type: 'h2', content: line.slice(3) });
    } else if (line.startsWith('# ')) {
      flushPara();
      blocks.push({ type: 'h1', content: line.slice(2) });
    } else if (line === '---' || line === '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━') {
      flushPara();
    } else {
      currentPara.push(line);
    }
  }
  flushPara();

  return (
    <>
      {blocks.map((block, i) => {
        if (block.type === 'h1') return <h1 key={i} className="md-h1">{renderInline(block.content)}</h1>;
        if (block.type === 'h2') return <h2 key={i} className="md-h2">{renderInline(block.content)}</h2>;
        if (block.type === 'h3') return <h3 key={i} className="md-h3">{renderInline(block.content)}</h3>;

        const raw = block.content;

        const isFraming = raw.length >= 3
          && raw[0] === '*'
          && raw[1] !== '*'
          && raw[raw.length - 1] === '*'
          && raw[raw.length - 2] !== '*';

        const isChallenge = /^\*\*Challenge\b/i.test(raw);

        if (isFraming) {
          const stripped = raw.slice(1, -1);
          return <p key={i} className="md-framing">{renderInline(stripped)}</p>;
        }
        if (isChallenge) {
          return <p key={i} className="md-challenge">{renderInline(raw)}</p>;
        }
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
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    const m = match[0];
    if (m.startsWith('**')) {
      parts.push(<strong key={key++}>{m.slice(2, -2)}</strong>);
    } else {
      parts.push(<em key={key++}>{m.slice(1, -1)}</em>);
    }
    lastIndex = match.index + m.length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
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

export default function Home({ recentSessions = [] }) {
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

      if (!res.ok) {
        throw new Error(data.error || 'The sharpener could not process your question.');
      }

      const assistantMsg = { role: 'assistant', content: data.raw || '' };
      setChatHistory([...msgs, assistantMsg]);

      applySharpenerResponse(data);
      setScreen('sharpening');
    } catch (e) {
      setError({
        title: 'Something went wrong',
        message: e.message || 'The council could not be reached. Please try again.',
        action: 'submit',
      });
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

      if (!res.ok) {
        throw new Error(data.error || 'The sharpener could not process your reply.');
      }

      const assistantMsg = { role: 'assistant', content: data.raw || '' };
      setChatHistory([...updatedHistory, assistantMsg]);
      applySharpenerResponse(data);
    } catch (e) {
      setError({
        title: 'Something went wrong',
        message: e.message || 'The council could not be reached. Please try again.',
        action: 'reply',
      });
      setScreen('error');
    } finally {
      setSharpenerLoading(false);
    }
  }

  async function pollForCompletedSession(originalQuestion) {
    for (let attempt = 0; attempt < FINALIZE_MAX_ATTEMPTS; attempt++) {
      const session = await findRecentSessionByQuestion(originalQuestion);
      if (session && session.slug) {
        return session.slug;
      }
      await new Promise(resolve => setTimeout(resolve, FINALIZE_POLL_INTERVAL_MS));
    }
    return null;
  }

  async function runPipeline(finalQuestion) {
    setConfirmedQuestion(finalQuestion);
    setError(null);
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
              if (currentEvent === 'progress') {
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
              } else if (currentEvent === 'brief') {
                result.brief = data.data;
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

      setSessionData({
        question: finalQuestion,
        cards,
        convergence,
        verdict,
        verdictSummary: summary,
        brief: result.brief || '',
        assembly: result.assembly || '',
        deliberation: result.deliberation || '',
      });

      setScreen('session');
    } catch (err) {
      setScreen('finalizing');

      const slug = await pollForCompletedSession(finalQuestion);

      if (slug) {
        router.push(`/archive/${slug}`);
        return;
      }

      setError({
        title: 'The council could not convene',
        message: err.message || 'Something went wrong while preparing the debate.',
        action: 'pipeline',
      });
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

    if (retryAction === 'submit') {
      setScreen('landing');
      handleSubmit();
    } else if (retryAction === 'reply') {
      setScreen('sharpening');
    } else if (retryAction === 'pipeline') {
      runPipeline(confirmedQuestion);
    } else {
      setScreen('landing');
    }
  }

  function handleProcessionComplete() {
    setTimeout(() => setShowConclusion(true), 400);
    setTimeout(() => setShowBriefToggle(true), 1000);
  }

  const STEPS = [
    { label: 'Assembling the council', step: 1 },
    { label: 'The council is in session', step: 2 },
    { label: 'Forming the verdict', step: 3 },
    { label: 'Writing the policy brief', step: 4 },
  ];

  return (
    <>
      <Head>
        <title>The Long Council</title>
        <meta name="description" content="Ask a hard question. Watch history's greatest minds debate it. See what they decide." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
    <link rel="apple-touch-icon" sizes="180x180" href="/apple-touch-icon.png" />
      </Head>

      <div className="mast mast-link" onClick={reset}>
        <div className="mast-name">The Long Council</div>
        <div className="mast-tag">History's counsel on today's questions</div>
      </div>

      <nav className="nav">
        <Link href="/council" className="nav-link">The Council</Link>
        <Link href="/archive" className="nav-link">The Archive</Link>
        <Link href="/about" className="nav-link">About</Link>
        <a className="nav-raise" onClick={reset}>Raise an issue</a>
      </nav>

      {screen === 'landing' && (
        <>
          <div className="landing">
            <div className="landing-eyebrow">Raise an issue</div>
            <h1 className="landing-heading">
              What policy question would you like the council to consider?
            </h1>
            <p className="landing-sub">
              Bring a hard question about governance, economics, society or geopolitics. History's greatest
              leaders and thinkers — from Lee Kuan Yew to Hannah Arendt, from Keynes to
              Machiavelli — will debate it and deliver their verdict.
            </p>

            <div className="issue-form">
              <textarea
                ref={textareaRef}
                className="issue-input"
                rows={3}
                placeholder={"e.g. Should social media be regulated?\nShould the EU have its own army?\nShould we tax wealth, not income?"}
                value={question}
                onChange={e => setQuestion(e.target.value)}
                onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit(); } }}
              />
              <button
                className="submit-btn"
                onClick={handleSubmit}
                disabled={!question.trim() || sharpenerLoading}
              >
                {sharpenerLoading ? 'Considering...' : 'Raise this issue →'}
              </button>
              <p className="landing-hint">The council will check if your question is clear before it assembles.</p>
            </div>
          </div>

          {recentSessions.length > 0 && (
            <div className="recent-sessions">
              <div className="recent-head">
                <div className="recent-rule" />
                <div className="recent-lbl">Recent sessions</div>
                <div className="recent-rule" />
              </div>

              <div className="recent-list">
                {recentSessions.map((s) => (
                  <Link key={s.id} href={`/archive/${s.slug}`} className="recent-item">
                    <div className="recent-date">{formatDate(s.created_at)}</div>
                    <h3 className="recent-title">{s.original_issue}</h3>
                    {s.teaser && <p className="recent-teaser">{s.teaser}</p>}
                  </Link>
                ))}
              </div>

              <div className="recent-footer">
                <Link href="/archive" className="recent-see-all">See all in The Archive →</Link>
              </div>
            </div>
          )}
        </>
      )}

      {screen === 'sharpening' && (
        <div className="sharpener">
          <div className="sharpener-heading">Before the council assembles</div>

          {sharpenerLoading && (
            <div className="chat-thread">
              <div className="chat-msg council">
                <div className="chat-bubble" style={{ color: '#9a9a9a', fontStyle: 'italic' }}>
                  Considering...
                </div>
              </div>
            </div>
          )}

          {!sharpenerLoading && sharpenerMode === 'ready' && readyQuestion && (() => {
            const normalise = (s) => (s || '').trim().toLowerCase().replace(/[?!.\s]+$/, '');
            const wasSharpened = normalise(readyQuestion) !== normalise(question);

            return (
              <div className="proposed-box">
                <div className="proposed-label">
                  {wasSharpened ? 'The council will start the debate' : 'Your question is clear'}
                </div>
                <div className="proposed-text">{readyQuestion}</div>
                {wasSharpened && (
                  <div className="proposed-original">
                    You asked: <span>{question}</span>
                  </div>
                )}
                {sharpenerExplanation && (
                  <div className="proposed-explanation">{sharpenerExplanation}</div>
                )}
                <div className="proposed-actions">
                  <button className="btn-accept" onClick={() => runPipeline(readyQuestion)}>
                    Convene the council →
                  </button>
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
                {sharpenerExplanation && (
                  <div className="clarify-explanation">{sharpenerExplanation}</div>
                )}
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
                <button
                  className="sharpen-send"
                  onClick={handleSharpenerReply}
                  disabled={!sharpenerInput.trim() || sharpenerLoading}
                >
                  →
                </button>
              </div>

              <div className="skip-row">
                <button className="btn-skip" onClick={() => runPipeline(question)}>
                  Skip — use my original question
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {screen === 'loading' && (
        <div className="loading">
          <div className="loading-question">"{confirmedQuestion}"</div>
          <div className="loading-steps">
            {STEPS.map(({ label, step }) => (
              <div
                key={step}
                className={`loading-step ${loadingStep === step ? 'active' : loadingStep > step ? 'done' : ''}`}
              >
                <div className="step-dot" />
                <span>{label}</span>
              </div>
            ))}
          </div>
          <p className="loading-note">This takes 1–2 minutes. The council does not rush.</p>
        </div>
      )}

      {screen === 'finalizing' && (
        <div className="loading">
          <div className="loading-question">"{confirmedQuestion}"</div>
          <div className="loading-steps">
            <div className="loading-step active">
              <div className="step-dot" />
              <span>Wrapping up the council's verdict</span>
            </div>
          </div>
          <p className="loading-note">
            Just a moment — the council is finishing its work.
          </p>
        </div>
      )}

      {screen === 'error' && error && (
        <div className="error-screen">
          <div className="error-box">
            <div className="error-title">{error.title}</div>
            <div className="error-message">{error.message}</div>
            <div className="error-actions">
              <button className="error-retry" onClick={handleErrorRetry}>
                Try again
              </button>
              <button className="error-reset" onClick={reset}>
                Start over
              </button>
            </div>
          </div>
        </div>
      )}

      {screen === 'session' && sessionData && (
        <div className="session">
          <div className="session-issue">{sessionData.question}</div>
          <div className="session-meta">
            {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}Counsel from history's greatest minds
          </div>

          {sessionData.cards.length > 0 ? (
            <Procession
              cards={sessionData.cards}
              onComplete={handleProcessionComplete}
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
              <div className="sec-lbl">The council's conclusion</div>
              <div className="sec-rule" />
            </div>
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
          </div>

          <div className={`brief-toggle-row ${showBriefToggle ? 'visible' : ''}`}>
            <button
              className="brief-toggle-btn"
              onClick={() => setBriefOpen(!briefOpen)}
            >
              <span>{briefOpen ? 'Close policy brief' : 'Read the full policy brief'}</span>
              <span style={{ fontSize: 11, transition: 'transform 0.3s', transform: briefOpen ? 'rotate(180deg)' : 'none' }}>▾</span>
            </button>
            <div className={`brief-content ${briefOpen ? 'open' : ''}`}>
              <Markdown text={sessionData.brief} />
            </div>
          </div>

          <div className="new-session-row">
            <button className="new-session-btn" onClick={reset}>
              Raise a new issue
            </button>
          </div>
        </div>
      )}

      <footer>
        The Long Council · Counsel from history's greatest minds, brought to life by AI
      </footer>

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

        .issue-input::placeholder {
          color: #a09a92;
          font-style: italic;
          line-height: 1.7;
          opacity: 1;
        }

        .issue-input::-webkit-input-placeholder {
          color: #a09a92;
          font-style: italic;
          line-height: 1.7;
        }

        .issue-input:hover {
          border-color: #c4b8ad;
        }

        .issue-input:focus {
          border-color: #6b1a1a;
          background: #faf6f3;
        }
      `}</style>
    </>
  );
}
