import { useState, useRef, useEffect } from 'react';
import Head from 'next/head';

// ── Tiny inline markdown renderer ──────────────────────────────────────
// Handles: ## headings, **bold**, *italic*, paragraphs, --- as divider (skipped).
// Detects framing lines (entirely *italic*) and challenge lines (start with **Challenge)
// so they can be styled distinctly via CSS.
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
      flushPara(); // skip horizontal rules and ASCII dividers
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

        // Paragraph classification
        const raw = block.content;

        // Framing line: entirely wrapped in single asterisks (not double)
        const isFraming = raw.length >= 3
          && raw[0] === '*'
          && raw[1] !== '*'
          && raw[raw.length - 1] === '*'
          && raw[raw.length - 2] !== '*';

        // Challenge line: starts with **Challenge
        const isChallenge = /^\*\*Challenge\b/i.test(raw);

        if (isFraming) {
          // Strip the outer asterisks; CSS handles the italic styling
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

// ── Parse deliberation output into card blocks ──────────────────────────
// Works with both old and new prompt formats.
function parseCards(deliberationText) {
  if (!deliberationText) return [];
  const blocks = deliberationText.split(/\n---\n/).map(b => b.trim()).filter(Boolean);
  return blocks.filter(b => {
    if (b.length < 50) return false;
    // Exclude the convergence note (both old and new formats)
    if (/^CONVERGENCE/i.test(b)) return false;
    if (/^##\s*The convergence note/i.test(b)) return false;
    return true;
  });
}

// ── Extract convergence note ────────────────────────────────────────────
function parseConvergence(deliberationText) {
  if (!deliberationText) return null;
  // New format: delimited block starting with ## The convergence note
  const blocks = deliberationText.split(/\n---\n/).map(b => b.trim()).filter(Boolean);
  const newBlock = blocks.find(b => /^##\s*The convergence note/i.test(b));
  if (newBlock) return newBlock;
  // Old format: CONVERGENCE NOTE: ... to end of text
  const oldMatch = deliberationText.match(/CONVERGENCE NOTE:\s*([\s\S]*?)$/i);
  return oldMatch ? oldMatch[1].trim() : null;
}

// ── Extract verdict and summary from verdict output ─────────────────────
function parseVerdict(verdictText) {
  if (!verdictText) return { verdict: '', summary: '' };

  // New format: ## Verdict  ...  ## Reasoning  ...
  const newVerdictMatch = verdictText.match(/##\s*Verdict\s*\n([\s\S]*?)(?=\n##\s*Reasoning|$)/i);
  const newReasoningMatch = verdictText.match(/##\s*Reasoning\s*\n([\s\S]*?)(?=\n---|$)/i);
  if (newVerdictMatch) {
    return {
      verdict: newVerdictMatch[1].trim(),
      summary: newReasoningMatch ? newReasoningMatch[1].trim() : '',
    };
  }

  // Old format: VERDICT: ... REASONING SUMMARY: ...
  const oldVerdictMatch = verdictText.match(/VERDICT:\s*([\s\S]*?)(?=REASONING SUMMARY:|$)/i);
  const oldSummaryMatch = verdictText.match(/REASONING SUMMARY:\s*([\s\S]*?)(?=---|$)/i);
  return {
    verdict: oldVerdictMatch ? oldVerdictMatch[1].trim() : verdictText,
    summary: oldSummaryMatch ? oldSummaryMatch[1].trim() : '',
  };
}

// ── Determine if a card is from a Framer (green) or Practitioner (red) ──
function isFramer(cardText) {
  return /Framer/i.test(cardText);
}

export default function Home() {
  // ── State machine ──────────────────────────────────────────────────────
  const [screen, setScreen] = useState('landing'); // landing | sharpening | loading | session
  const [question, setQuestion] = useState('');

  // Sharpener state
  const [chatHistory, setChatHistory] = useState([]); // [{role, content}]
  const [sharpenerMessages, setSharpenerMessages] = useState([]); // display messages
  const [proposedQuestion, setProposedQuestion] = useState(null);
  const [confirmedQuestion, setConfirmedQuestion] = useState('');
  const [sharpenerInput, setSharpenerInput] = useState('');
  const [sharpenerLoading, setSharpenerLoading] = useState(false);

  // Loading state
  const [loadingStep, setLoadingStep] = useState(0); // 0=idle,1=assembly,2=deliberation,3=verdict,4=brief
  const [loadingMessage, setLoadingMessage] = useState('');

  // Session state
  const [sessionData, setSessionData] = useState(null);
  const [visibleCards, setVisibleCards] = useState(0);
  const [showConclusion, setShowConclusion] = useState(false);
  const [showBriefToggle, setShowBriefToggle] = useState(false);
  const [briefOpen, setBriefOpen] = useState(false);

  const textareaRef = useRef(null);

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = textareaRef.current.scrollHeight + 'px';
    }
  }, [question]);

  // Animate cards when session loads
  useEffect(() => {
    if (screen !== 'session' || !sessionData) return;
    const cards = sessionData.cards || [];
    let i = 0;
    const showNext = () => {
      if (i < cards.length) {
        setVisibleCards(i + 1);
        i++;
        setTimeout(showNext, 1400);
      } else {
        setTimeout(() => setShowConclusion(true), 800);
        setTimeout(() => setShowBriefToggle(true), 1600);
      }
    };
    const t = setTimeout(showNext, 600);
    return () => clearTimeout(t);
  }, [screen, sessionData]);

  // ── Step 1: Submit initial question ────────────────────────────────────
  async function handleSubmit() {
    const q = question.trim();
    if (!q) return;
    setSharpenerLoading(true);

    try {
      const msgs = [{ role: 'user', content: q }];
      const res = await fetch('/api/sharpen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: msgs }),
      });
      const data = await res.json();

      setChatHistory(msgs);
      setSharpenerMessages([{ from: 'council', text: data.text }]);

      if (data.isProposed) {
        setProposedQuestion(data.proposedQuestion);
      }

      setScreen('sharpening');
    } catch (e) {
      alert('Something went wrong. Please try again.');
    } finally {
      setSharpenerLoading(false);
    }
  }

  // ── Step 2: Reply in sharpener dialogue ────────────────────────────────
  async function handleSharpenerReply() {
    const reply = sharpenerInput.trim();
    if (!reply || sharpenerLoading) return;

    const newUserMsg = { role: 'user', content: reply };
    const updatedHistory = [...chatHistory, newUserMsg];

    setSharpenerMessages(prev => [...prev, { from: 'user', text: reply }]);
    setSharpenerInput('');
    setSharpenerLoading(true);

    try {
      const res = await fetch('/api/sharpen', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: updatedHistory }),
      });
      const data = await res.json();

      const assistantMsg = { role: 'assistant', content: data.text };
      setChatHistory([...updatedHistory, assistantMsg]);
      setSharpenerMessages(prev => [...prev, { from: 'council', text: data.text }]);

      if (data.isProposed) {
        setProposedQuestion(data.proposedQuestion);
      }
    } catch (e) {
      alert('Something went wrong. Please try again.');
    } finally {
      setSharpenerLoading(false);
    }
  }

  // ── Step 3: Confirm question and run pipeline ───────────────────────────
  async function runPipeline(finalQuestion) {
    setConfirmedQuestion(finalQuestion);
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
        buffer = lines.pop(); // keep incomplete line in buffer

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

      // Parse into display-ready structure
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
      alert(`Something went wrong: ${err.message}\n\nPlease try again.`);
      setScreen('landing');
    }
  }

  // ── Reset to landing ────────────────────────────────────────────────────
  function reset() {
    setScreen('landing');
    setQuestion('');
    setChatHistory([]);
    setSharpenerMessages([]);
    setProposedQuestion(null);
    setConfirmedQuestion('');
    setSharpenerInput('');
    setSessionData(null);
    setVisibleCards(0);
    setShowConclusion(false);
    setShowBriefToggle(false);
    setBriefOpen(false);
    setLoadingStep(0);
  }

  const STEPS = [
    { label: 'Assembling the council', step: 1 },
    { label: 'The council is deliberating', step: 2 },
    { label: 'Forming the verdict', step: 3 },
    { label: 'Writing the policy brief', step: 4 },
  ];

  return (
    <>
      <Head>
        <title>The Long Council</title>
        <meta name="description" content="The counsel of history's greatest minds, brought to life by AI." />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.ico" />
      </Head>

      {/* ── MASTHEAD ── */}
      <div className="mast" onClick={reset}>
        <div className="mast-name">The Long Council</div>
        <div className="mast-tag">The counsel of history's greatest minds, brought to life by AI</div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          LANDING SCREEN
      ═══════════════════════════════════════════════════════════════ */}
      {screen === 'landing' && (
        <div className="landing">
          <div className="landing-eyebrow">Raise an issue</div>
          <h1 className="landing-heading">
            What policy question would you like<br />the council to consider?
          </h1>
          <p className="landing-sub">
            Submit a governance, economic or geopolitical question. 35 of history's greatest
            leaders and thinkers — from Lee Kuan Yew to Hannah Arendt, from Keynes to
            Machiavelli — will deliberate on it and deliver their collective counsel.
          </p>

          <div className="issue-form">
            <textarea
              ref={textareaRef}
              className="issue-input"
              rows={3}
              placeholder="e.g. Should the EU introduce a carbon border adjustment mechanism?"
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
            <p className="landing-hint">The council will ask a clarifying question if your issue needs sharpening.</p>
          </div>
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SHARPENER SCREEN
      ═══════════════════════════════════════════════════════════════ */}
      {screen === 'sharpening' && (
        <div className="sharpener">
          <div className="sharpener-heading">Before the council assembles</div>
          <div className="sharpener-original">Your question: {question}</div>

          <div className="chat-thread">
            {sharpenerMessages.map((msg, i) => (
              <div key={i} className={`chat-msg ${msg.from}`}>
                <div className="chat-bubble">
                  {msg.text.replace(/^PROPOSED:\s*/i, '')}
                </div>
              </div>
            ))}
            {sharpenerLoading && (
              <div className="chat-msg council">
                <div className="chat-bubble" style={{ color: '#9a9a9a', fontStyle: 'italic' }}>
                  Considering...
                </div>
              </div>
            )}
          </div>

          {proposedQuestion && (
            <div className="proposed-box">
              <div className="proposed-label">Proposed question</div>
              <div className="proposed-text">{proposedQuestion}</div>
              <div className="proposed-actions">
                <button className="btn-accept" onClick={() => runPipeline(proposedQuestion)}>
                  Accept — convene the council →
                </button>
                <button className="btn-original" onClick={() => runPipeline(question)}>
                  Use my original question
                </button>
              </div>
            </div>
          )}

          {!proposedQuestion && !sharpenerLoading && (
            <div className="sharpen-input-row">
              <input
                className="sharpen-input"
                type="text"
                placeholder="Reply..."
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
          )}
        </div>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          LOADING SCREEN
      ═══════════════════════════════════════════════════════════════ */}
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

      {/* ═══════════════════════════════════════════════════════════════
          SESSION SCREEN
      ═══════════════════════════════════════════════════════════════ */}
      {screen === 'session' && sessionData && (
        <div className="session">
          <div className="session-issue">{sessionData.question}</div>
          <div className="session-meta">
            {new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}
            {' · '}AI-generated counsel from historical figures
          </div>

          {/* Reasoning cards */}
          <div className="sec-head">
            <div className="sec-rule" />
            <div className="sec-lbl">The deliberation</div>
            <div className="sec-rule" />
          </div>

          <div className="cards">
            {sessionData.cards.length > 0
              ? sessionData.cards.map((cardText, i) => (
                  <div
                    key={i}
                    className={`rcard ${isFramer(cardText) ? 'framer' : ''} ${i < visibleCards ? 'visible' : ''}`}
                  >
                    <div className="card-body">
                      <Markdown text={cardText} />
                    </div>
                  </div>
                ))
              : (
                // Fallback: show raw deliberation if parsing produced nothing
                <div className={`rcard visible`}>
                  <div className="card-body">
                    <Markdown text={sessionData.deliberation || 'Deliberation not available.'} />
                  </div>
                </div>
              )}
          </div>

          {/* Conclusion bar */}
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

          {/* Policy brief toggle */}
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

          {/* New session */}
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
