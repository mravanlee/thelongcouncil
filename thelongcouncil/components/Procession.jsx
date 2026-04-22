import { useMemo, useEffect, useState, Fragment } from 'react'

const FRAMER_NAMES = new Set([
  'John Maynard Keynes', 'Friedrich Hayek', 'Milton Friedman', 'John Locke',
  'Jean-Jacques Rousseau', 'John Rawls', 'Hannah Arendt', 'Amartya Sen',
  'Albert Hirschman', 'Niccolò Machiavelli', 'Niccolo Machiavelli', 'Confucius',
  'Kautilya', 'Ibn Khaldun', 'Frantz Fanon', 'Raúl Prebisch', 'Raul Prebisch',
  'Ali ibn Abi Talib', 'Elinor Ostrom', 'Sun Tzu', 'Simón Bolívar',
  'Simon Bolivar', 'Julius Nyerere',
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

  let name = '', role = '', framing = ''
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
    if (cursor < lines.length && /^session confidence:/i.test(lines[cursor])) cursor++
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
  let lastIndex = 0, match, key = 0
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

export default function Procession({ cards = [], onComplete }) {
  const parsed = useMemo(() => cards.map(parseCard).filter(Boolean), [cards])

  const [seatedCount, setSeatedCount] = useState(0)
  const [speakingIndex, setSpeakingIndex] = useState(-1)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [showGovSection, setShowGovSection] = useState(false)
  const [showArchSection, setShowArchSection] = useState(false)

  const splitIndex = useMemo(() => {
    const idx = parsed.findIndex(c => getTier(c.name) === 'F')
    if (idx <= 0) return -1
    const hasPBefore = parsed.slice(0, idx).some(c => getTier(c.name) === 'P')
    return hasPBefore ? idx : -1
  }, [parsed])

  const allFramers = parsed.length > 0 && parsed.every(c => getTier(c.name) === 'F')

  useEffect(() => {
    if (parsed.length === 0) return
    const timers = []

    timers.push(setTimeout(() => {
      if (allFramers) setShowArchSection(true)
      else setShowGovSection(true)
    }, 200))

    const assemblyDelay = 450
    const assemblyStart = 600
    parsed.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setSeatedCount(c => Math.max(c, i + 1))
        if (splitIndex > 0 && i === splitIndex) {
          setShowArchSection(true)
        }
      }, assemblyStart + i * assemblyDelay))
    })

    const speakingStart = assemblyStart + parsed.length * assemblyDelay + 700
    const speakingDelay = 2200
    parsed.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setSpeakingIndex(i)
      }, speakingStart + i * speakingDelay))
    })

    timers.push(setTimeout(() => {
      setSessionComplete(true)
      if (onComplete) onComplete()
    }, speakingStart + parsed.length * speakingDelay + 400))

    return () => timers.forEach(clearTimeout)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed.length])

  const getSeatState = (i) => {
    if (i >= seatedCount) return 'empty'
    if (sessionComplete) return 'past'
    if (speakingIndex === i) return 'speaking'
    if (speakingIndex > i) return 'past'
    return 'seated'
  }

  const renderArchMarkerHere = (i) => splitIndex > 0 && i === splitIndex

  return (
    <div className="procession">
      <div className="rail">
        {!allFramers && (
          <SectionMarker label="Those who governed" visible={showGovSection} />
        )}
        {allFramers && (
          <SectionMarker label="The intellectual architecture" visible={showArchSection} />
        )}

        {parsed.map((card, i) => {
          const state = getSeatState(i)
          if (state === 'empty') {
            if (renderArchMarkerHere(i) && showArchSection) {
              return (
                <SectionMarker
                  key={`marker-${i}`}
                  label="The intellectual architecture"
                  visible={true}
                />
              )
            }
            return null
          }

          const tier = getTier(card.name)
          return (
            <Fragment key={i}>
              {renderArchMarkerHere(i) && (
                <SectionMarker label="The intellectual architecture" visible={showArchSection} />
              )}
              <Seat card={card} tier={tier} state={state} />
            </Fragment>
          )
        })}
      </div>

      <style jsx>{`
        .procession {
          margin: 8px 0 0;
        }
        .rail {
          position: relative;
          padding-left: 44px;
        }
        .rail::before {
          content: "";
          position: absolute;
          left: 17px;
          top: 18px;
          bottom: 18px;
          width: 1px;
          background: #b8ad9c;
          z-index: 0;
        }
      `}</style>
    </div>
  )
}

function SectionMarker({ label, visible }) {
  return (
    <div className={`marker ${visible ? 'visible' : ''}`}>
      <span className="marker-label">{label}</span>
      <span className="marker-rule" />
      <style jsx>{`
        .marker {
          position: relative;
          margin: 18px 0 20px;
          display: flex;
          align-items: center;
          gap: 10px;
          opacity: 0;
          transition: opacity 0.6s ease-out;
        }
        .marker.visible { opacity: 1; }
        .marker::before {
          content: "";
          position: absolute;
          left: -28px;
          top: 50%;
          width: 14px;
          height: 1px;
          background: #b8ad9c;
        }
        .marker-label {
          font-family: 'Crimson Pro', serif;
          font-size: 10px;
          letter-spacing: 0.12em;
          color: #8a8a8a;
          text-transform: uppercase;
          white-space: nowrap;
        }
        .marker-rule {
          flex: 1;
          height: 0.5px;
          background: #d4cfc8;
        }
      `}</style>
    </div>
  )
}

function Seat({ card, tier, state }) {
  const { name, role, framing, body, challenge } = card
  const isFramer = tier === 'F'

  return (
    <div className={`seat ${isFramer ? 'framer' : 'practitioner'} state-${state}`}>
      <div className={`avatar ${isFramer ? 'f' : 'p'}`}>{getInitials(name)}</div>

      <div className="content">
        <div className="head">
          <span className="name">{name}</span>
          {role && <span className="role">{role}</span>}
        </div>

        {framing && <div className="framing">{framing}</div>}

        {body && body.length > 0 && (
          <div className="body">
            {body.map((p, idx) => <p key={idx}>{renderInline(p)}</p>)}
          </div>
        )}

        {challenge && <div className="challenge">{renderInline(challenge)}</div>}
      </div>

      <style jsx>{`
        .seat {
          position: relative;
          margin-bottom: 32px;
          opacity: 0;
          transform: translateX(-6px);
          transition: opacity 0.6s ease-out, transform 0.6s ease-out;
        }
        .seat.state-seated,
        .seat.state-speaking,
        .seat.state-past {
          opacity: 1;
          transform: translateX(0);
        }

        .avatar {
          position: absolute;
          left: -36px;
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
          transition: box-shadow 0.4s ease;
          box-shadow: 0 0 0 2px #f8f6f2;
        }
        .avatar.p {
          background: #fdf5ec;
          color: #6b1a1a;
          border: 1px solid #c4897a;
        }
        .avatar.f {
          background: #edf4ed;
          color: #2a3a2a;
          border: 1px solid #7a9a7a;
        }
        .seat.state-speaking.practitioner .avatar {
          box-shadow: 0 0 0 2px #f8f6f2, 0 0 0 5px rgba(107, 26, 26, 0.18);
        }
        .seat.state-speaking.framer .avatar {
          box-shadow: 0 0 0 2px #f8f6f2, 0 0 0 5px rgba(42, 90, 42, 0.18);
        }

        .content {
          padding-top: 1px;
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
        .seat.framer .name { color: #1a2a1a; }
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
          margin-bottom: 0;
          transition: margin-bottom 0.5s ease;
        }
        .seat.state-speaking .framing,
        .seat.state-past .framing {
          margin-bottom: 14px;
        }

        .body {
          font-family: 'Crimson Pro', serif;
          font-size: 15px;
          line-height: 1.8;
          color: #1a1a1a;
          max-height: 0;
          overflow: hidden;
          opacity: 0;
          transition: max-height 0.9s ease-in-out, opacity 0.5s ease;
        }
        .seat.state-speaking .body,
        .seat.state-past .body {
          max-height: 2200px;
          opacity: 1;
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
          max-height: 0;
          overflow: hidden;
          opacity: 0;
          margin-top: 0;
          padding-top: 0;
          border-top: 0.5px solid transparent;
          transition:
            max-height 0.6s ease-in-out,
            opacity 0.5s ease,
            margin-top 0.4s ease,
            padding-top 0.4s ease,
            border-top-color 0.4s ease;
        }
        .seat.state-speaking .challenge,
        .seat.state-past .challenge {
          max-height: 200px;
          opacity: 1;
          margin-top: 14px;
          padding-top: 10px;
          border-top-color: #e8e4de;
        }
        .seat.framer .challenge { color: #2a5a2a; }
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
