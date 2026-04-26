import { useState, useRef, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import Procession from '../components/Procession';
import { supabase } from '../lib/supabase';

// ── Recovery constants ──────────────────────────────────────────────────
const ACTIVE_SESSION_KEY = 'tlc-active-session';
const RECOVERY_TIMEOUT_MINUTES = 10;
const RECOVERY_POLL_INTERVAL_MS = 5000;
const RECOVERY_MAX_ATTEMPTS = 60; // 5 minutes of polling

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

  // Filter out incomplete sessions (pre-created but not yet finalized)
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

// ── localStorage helpers (safe — survive disabled storage / quota errors) ─
function saveActiveSession(slug, question) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(ACTIVE_SESSION_KEY, JSON.stringify({
      slug,
      question,
      startedAt: Date.now(),
    }));
  } catch (e) {
    // localStorage might be full, disabled, or in private mode — non-fatal
  }
}

function clearActiveSession() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(ACTIVE_SESSION_KEY);
  } catch (e) {
    // ignore
  }
}

function readActiveSession() {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(ACTIVE_SESSION_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !parsed.slug || !parsed.startedAt) return null;
    return parsed;
  } catch (e) {
    return null;
  }
}

// ── Tiny inline markdown renderer (used for verdict + brief) ───────────
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

// ── Parsers ──────────────────────────────────────────────────────────────
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

  // Sharpener state — new two-path model (READY / CLARIFY)
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

  // Error state — replaces alert() so users see a clear message instead of a blank screen
  const [error, setError] = useState(null);

  const textareaRef = useRef(null);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [question]);

  // ── Session recovery on mount ──────────────────────────────────────────
  // If localStorage has a recent active session, the previous page load
  // probably crashed/was suspended (e.g., phone screen locked) before the
  // SSE pipeline finished. Check if the session has been finalized in
  // Supabase, and if so redirect to the archive page.
  useEffect(() => {
    let cancelled = false;
    let pollTimer = null;

    async function recoverSession() {
      const stored = readActiveSession();
      if (!stored) return;

      const ageMinutes = (Date.now() - stored.startedAt) / 60000;
      if (ageMinutes > RECOVERY_TIMEOUT_MINUTES) {
        clearActiveSession();
        return;
      }

      // Show recovering screen so user sees something is happening
      setConfirmedQuestion(stored.question || '');
      setScreen('recovering');

      let attempts = 0;

      const tryFetch = async () => {
        if (cancelled) return;
        attempts += 1;

        try {
          const { data, error: dbError } = await supabase
            .from('sessions')
            .select('slug, cards')
            .eq('slug', stored.slug)
            .single();

          if (cancelled) return;

          // Row doesn't exist (orphan was cleaned up) — give up
          if (dbError || !data) {
            clearActiveSession();
            setScreen('landing');
            return;
          }

          // Session is complete — go to archive
          if (data.cards && data.cards.brief) {
            clearActiveSession();
            router.push(`/archive/${stored.slug}`);
            return;
          }

          // Still processing — try again
          if (attempts < RECOVERY_MAX_ATTEMPTS) {
            pollTimer = setTimeout(tryFetch, RECOVERY_POLL_INTERVAL_MS);
          } else {
            clearActiveSession();
            setError({
              title: 'The council could not be reached',
              message: 'Your previous session is taking longer than expected. Please try again.',
              action: 'reset',
            });
            setScreen('error');
          }
        } catch (e) {
          if (cancelled) return;
          if (attempts < RECOVERY_MAX_ATTEMPTS) {
            pollTimer = setTimeout(tryFetch, RECOVERY_POLL_INTERVAL_MS);
          } else {
            clearActiveSession();
            setScreen('landing');
          }
        }
      };

      tryFetch();
    }

    recoverSession();

    return () => {
      cancelled = true;
      if (pollTimer) clearTimeout(pollTimer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

      // Include assistant response in chat history so messages alternate properly
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

  async function runPipeline(finalQuestion) {
    setConfirmedQuestion(finalQuestion);
    setError(null);
    setScreen('loading');
    setLoadingStep(1);
    setLoadingMessage('Assembling the council...');

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
                // Save slug to localStorage so we can recover if connection drops
                if (data.slug) {
                  saveActiveSession(data.slug, finalQuestion);
                }
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
              } else if (currentEvent === 'brief') {
                result.brief = data.data;
              } else if (currentEvent === 'complete') {
                // Successful completion — clear recovery state
                clearActiveSession();
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

      // Final safety: clear any leftover recovery state on successful display
      clearActiveSession();
      setScreen('session');
    } catch (err) {
      // Note: we deliberately do NOT clear localStorage here. The error might
      // be a transient connection drop (e.g., phone sleep), and the server
      // may have completed the session. The mount-time recovery effect will
      // handle it on the next page load.
      setError({
        title: 'The council could not convene',
        message: err.message || 'Something went wrong while preparing the deliberation.',
        action: 'pipeline',
      });
      setScreen('error');
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
    clearActiveSession();
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
    } else if (retryAction === 'reset') {
      reset();
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
              What policy question would you like<br />the council to consider?
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
                  {wasSharpened ? 'The council will deliberate on' : 'Your question is clear'}
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

      {screen === 'recovering' && (
        <div className="loading">
          <div className="loading-question">
            {confirmedQuestion ? `"${confirmedQuestion}"` : 'Recovering your session...'}
          </div>
          <div className="loading-steps">
            <div className="loading-step active">
              <div className="step-dot" />
              <span>Recovering your previous session</span>
            </div>
          </div>
          <p className="loading-note">
            Your previous session was interrupted. We're checking if the council finished its work.
          </p>
          <div style={{ marginTop: 24, textAlign: 'center' }}>
            <button className="btn-skip" onClick={reset}>
              Cancel and start over
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
            {' · '}AI-generated counsel from historical figures
          </div>

          {sessionData.cards.length > 0 ? (
            <Procession
              cards={sessionData.cards}
              onComplete={handleProcessionComplete}
            />
          ) : (
            <div className="rcard visible">
              <div className="card-body">
                <Markdown text={sessionData.deliberation || 'Deliberation not available.'} />
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
        © The Long Council · AI-generated counsel from historical figures · Not advice
      </footer>
    </>
  );
}
