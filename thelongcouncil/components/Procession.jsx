// components/Procession.jsx
//
// ─────────────────────────────────────────────────────────────────────────────
// THE LONG COUNCIL — Procession component
// ─────────────────────────────────────────────────────────────────────────────
// Renders the mobile-first council deliberation UI: seats on a vertical rail,
// section labels between Practitioners and Framers, cards that fade in one by
// one as visibleCards grows.
//
// Replaces the old .cards / .rcard block in pages/index.js.
// The verdict and policy brief remain in index.js — this component only
// handles the procession itself.
//
// ─────────────────────────────────────────────────────────────────────────────

import { useMemo } from 'react'

// ─── Framer lookup (sync with pages/council.js COUNCIL_MEMBERS) ──────────────
const FRAMER_NAMES = new Set([
  'John Maynard Keynes',
  'Friedrich Hayek',
  'Milton Friedman',
  'John Locke',
  'Jean-Jacques Rousseau',
  'John Rawls',
  'Hannah Arendt',
  'Amartya Sen',
  'Albert Hirschman',
  'Niccolò Machiavelli',
  'Niccolo Machiavelli',
  'Confucius',
  'Kautilya',
  'Ibn Khaldun',
  'Frantz Fanon',
  'Raúl Prebisch',
  'Raul Prebisch',
  'Ali ibn Abi Talib',
  'Elinor Ostrom',
  'Sun Tzu',
  'Simón Bolívar',
  'Simon Bolivar',
  'Julius Nyerere',
])

function getTier(name) {
  if (!name) return 'P'
  return FRAMER_NAMES.has(name.trim()) ? 'F' : 'P'
}

function getInitials(name) {
  if (!name) return ''
  const cleaned = name.trim().replace(/[.,]/g, '')
  const words = cleaned.split(/\s+/).filter(Boolean)
  if (words.length >= 3) return words.slice(0, 3).map(w => w[0].toUpperCase()).join('')
  if (words.length === 2) return (words[0][0] + words[1][0]).toUpperCase()
  return cleaned.slice(0, 2).toUpperCase()
}

function parseCard(raw) {
  if (!raw || typeof raw !== 'string') return null
  const lines = raw.split('\n').map(l => l.trim())

  let name = ''
  let role = ''
  let framing = ''
  const body = []
  let challenge = ''

  let cursor = 0
  while (cursor < lines.length && lines[cursor] === '') cursor++
  if (cursor >= lines.length) return null

  const first = lines[cursor]
  if (first.startsWith('## ')) {
    name = first.slice(3).trim()
    cursor++
    while (cursor < lines.length && lines[cursor] === '') cursor++
    if (cursor < lines.length) {
      const candidate = lines[cursor]
      const isFraming = /^\*[^*].*[^*]\*$/.test(candidate)
      const isChallenge = /^\*\*Challenge\b/i.test(candidate)
      const isHeading = candidate.startsWith('#')
      if (!isFraming && !isChallenge && !isHeading && candidate !== '') {
        role = candidate
        cursor++
      }
    }
  } else if (first.includes('·')) {
    const [n, ...rest] = first.split('·')
    name = n.trim()
    role = rest.join('·').trim()
    cursor++
    while (cursor < lines.length && lines[cursor] === '') cursor++
    if (cursor < lines.length && /^session confidence:/i.test(lines[cursor])) {
      cursor++
    }
  } else {
    return null
  }

  const paragraphs = []
  let current = []
  for (let i = cursor; i < lines.length; i++) {
    const line = lines[i]
    if (line === '') {
      if (current.length > 0) { paragraphs.push(current.join(' ')); current = [] }
    } else {
      current.push(line)
    }
  }
  if (current.length > 0) paragraphs.push(current.join(' '))

  for (let i = 0; i < paragraphs.length; i++) {
    const p = paragraphs[i]
    if (/^\*[^*].*[^*]\*$/.test(p) && !framing) {
      framing = p.slice(1, -1).trim()
      paragraphs.splice(i, 1)
      break
    }
  }

  if (paragraphs.length > 0) {
    const last = paragraphs[paragraphs.length - 1]
    if (/^\*\*Challenge\b/i.test(last)) {
      challenge = last
      paragraphs.pop()
    }
  }

  body.push(...paragraphs)
  return { name, role, framing, body, challenge }
}

function renderInline(text) {
  if (!text) return null
  const parts = []
  const pattern = /(\[(?:documented|inferred|extrapolated|no documented position)\]|\*\*[^*]+\*\*|\*[^*]+\*)/g
  let lastIndex = 0
  let match
  let key = 0
  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) parts.push(text.slice(lastIndex, match.index))
    const token = match[0]
    if (/^\[/.test(token)) {
      parts.push(<span key={`s-${key++}`} className="sig">{token.slice(1, -1)}</span>)
    } else if (token.startsWith('**')) {
      parts.push(<strong key={`b-${key++}`}>{token.slice(2, -2)}</strong>)
    } else {
      parts.push(<em key={`i-${key++}`}>{token.slice(1, -1)}</em>)
    }
    lastIndex = match.index + token.length
  }
  if (lastIndex < text.length) parts.push(text.slice(lastIndex))
  return parts.length === 0 ? text : parts
}

export default function Procession({ cards = [], visibleCards = 0 }) {
  const parsed = useMemo(() => cards.map(parseCard).filter(Boolean), [cards])

  const splitIndex = useMemo(() => {
    const idx = parsed.findIndex(c => getTier(c.name) === 'F')
    if (idx <= 0) return -1
    const hasPBefore = parsed.slice(0, idx).some(c => getTier(c.name) === 'P')
    return hasPBefore ? idx : -1
  }, [parsed])

  const allFramers = parsed.length > 0 && parsed.every(c => getTier(c.name) === 'F')
  const allPractitioners = parsed.length > 0 && parsed.every(c => getTier(c.name) === 'P')

  let practitionerGroup = []
  let framerGroup = []
  if (allFramers) {
    framerGroup = parsed.map((c, i) => ({ card: c, globalIdx: i }))
  } else if (allPractitioners) {
    practitionerGroup = parsed.map((c, i) => ({ card: c, globalIdx: i }))
  } else if (splitIndex > 0) {
    practitionerGroup = parsed.slice(0, splitIndex).map((c, i) => ({ card: c, globalIdx: i }))
    framerGroup = parsed.slice(splitIndex).map((c, i) => ({ card: c, globalIdx: splitIndex + i }))
  } else {
    practitionerGroup = parsed.map((c, i) => ({ card: c, globalIdx: i }))
  }

  return (
    <div className="procession">
      {practitionerGroup.length > 0 && (
        <>
          <SectionLabel label="Those who governed" />
          <Rail>
            {practitionerGroup.map(({ card, globalIdx }) => (
              <Seat
                key={`p-${globalIdx}`}
                card={card}
                tier={getTier(card.name)}
                visible={globalIdx < visibleCards}
              />
            ))}
          </Rail>
        </>
      )}

      {framerGroup.length > 0 && (
        <>
          <SectionLabel label="The intellectual architecture" />
          <Rail>
            {framerGroup.map(({ card, globalIdx }) => (
              <Seat
                key={`f-${globalIdx}`}
                card={card}
                tier={getTier(card.name)}
                visible={globalIdx < visibleCards}
              />
            ))}
          </Rail>
        </>
      )}

      <style jsx>{`
        .procession {
          margin: 8px 0 0;
        }
      `}</style>
    </div>
  )
}

function SectionLabel({ label }) {
  return (
    <div className="section-label">
      <span className="rule" />
      <span className="label">{label}</span>
      <span className="rule" />
      <style jsx>{`
        .section-label {
          display: flex;
          align-items: center;
          gap: 12px;
          margin: 18px 0 22px;
          padding-left: 32px;
        }
        .rule {
          flex: 1;
          height: 0.5px;
          background: #d4cfc8;
        }
        .label {
          font-family: 'Crimson Pro', serif;
          font-size: 10px;
          letter-spacing: 0.12em;
          color: #8a8a8a;
          text-transform: uppercase;
          white-space: nowrap;
        }
      `}</style>
    </div>
  )
}

function Rail({ children }) {
  return (
    <div className="rail">
      {children}
      <style jsx>{`
        .rail {
          position: relative;
          padding-left: 32px;
        }
        .rail::before {
          content: "";
          position: absolute;
          left: 14px;
          top: 8px;
          bottom: 8px;
          width: 0.5px;
          background: linear-gradient(
            to bottom,
            transparent 0%,
            #c0b8a8 6%,
            #c0b8a8 94%,
            transparent 100%
          );
        }
      `}</style>
    </div>
  )
}

function Seat({ card, tier, visible }) {
  const { name, role, framing, body, challenge } = card
  const isFramer = tier === 'F'

  return (
    <div className={`seat ${isFramer ? 'framer' : 'practitioner'} ${visible ? 'visible' : ''}`}>
      <div className={`avatar ${isFramer ? 'f' : 'p'}`}>{getInitials(name)}</div>
      <div className="content">
        <div className="head">
          <span className="name">{name}</span>
          {role && <span className="role">{role}</span>}
        </div>
        {framing && <div className="framing">{framing}</div>}
        {body && body.length > 0 && (
          <div className="body">
            {body.map((p, i) => <p key={i}>{renderInline(p)}</p>)}
          </div>
        )}
        {challenge && <div className="challenge">{renderInline(challenge)}</div>}
      </div>

      <style jsx>{`
        .seat {
          position: relative;
          margin-bottom: 30px;
          opacity: 0;
          transform: translateX(-6px);
          transition: opacity 0.6s ease-out, transform 0.6s ease-out;
        }
        .seat.visible {
          opacity: 1;
          transform: translateX(0);
        }

        .avatar {
          position: absolute;
          left: -32px;
          top: 0;
          width: 28px;
          height: 28px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Playfair Display', serif;
          font-size: 9.5px;
          font-weight: 600;
          z-index: 2;
        }
        .avatar.p {
          background: #fdf5ec;
          color: #6b1a1a;
          border: 0.5px solid #c4897a;
        }
        .avatar.f {
          background: #edf4ed;
          color: #2a3a2a;
          border: 0.5px solid #7a9a7a;
        }

        .content {
          border-left: 2px solid #6b1a1a;
          padding-left: 16px;
          margin-left: -16px;
        }
        .seat.framer .content {
          border-left-color: #2a3a2a;
        }

        .head {
          display: flex;
          align-items: baseline;
          gap: 10px;
          flex-wrap: wrap;
          margin-bottom: 3px;
        }
        .name {
          font-family: 'Playfair Display', serif;
          font-size: 16px;
          font-weight: 600;
          color: #0f0f0f;
          line-height: 1.3;
        }
        .seat.framer .name {
          color: #1a2a1a;
        }
        .role {
          font-family: 'Crimson Pro', serif;
          font-size: 11px;
          color: #7a7a7a;
          font-style: italic;
        }

        .framing {
          font-family: 'Playfair Display', serif;
          font-size: 13.5px;
          color: #2a2a2a;
          font-style: italic;
          line-height: 1.55;
          margin-top: 7px;
          margin-bottom: 12px;
        }

        .body {
          font-family: 'Crimson Pro', serif;
          font-size: 15px;
          line-height: 1.8;
          color: #1a1a1a;
        }
        .body :global(p) {
          margin-bottom: 12px;
        }
        .body :global(p:last-child) {
          margin-bottom: 0;
        }
        .body :global(.sig) {
          display: inline-block;
          font-family: 'Crimson Pro', serif;
          font-size: 10px;
          color: #7a7a7a;
          background: #f0ede8;
          padding: 1px 6px;
          border-radius: 2px;
          margin: 0 1px;
          font-style: normal;
          letter-spacing: 0.02em;
          vertical-align: baseline;
        }

        .challenge {
          font-family: 'Crimson Pro', serif;
          font-size: 13px;
          color: #6b1a1a;
          font-style: italic;
          line-height: 1.6;
          margin-top: 14px;
          padding-top: 10px;
          border-top: 0.5px solid #e8e4de;
        }
        .seat.framer .challenge {
          color: #2a5a2a;
        }
        .challenge :global(strong) {
          font-weight: 600;
          font-style: normal;
        }

        @media (min-width: 768px) {
          .name { font-size: 17px; }
          .framing { font-size: 14px; }
          .body { font-size: 15.5px; }
          .challenge { font-size: 13.5px; }
        }
      `}</style>
    </div>
  )
}
