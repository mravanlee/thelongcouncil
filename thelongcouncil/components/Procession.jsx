import { useMemo, useEffect, useState, Fragment } from 'react'
import { getTier, getInitials, slugify, parseCard, renderInline } from '../lib/cardParser'

// Same expansion map as archive/[slug].js — keeps short names working
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
}

function nameToAvatarSlug(name) {
  const slug = slugify(name)
  return AVATAR_NAME_EXPANSIONS[slug] || slug
}

export default function Procession({ cards = [], onComplete, instant = false, sessionSlug = null }) {
  const parsed = useMemo(() => cards.map(parseCard).filter(Boolean), [cards])

  const [seatedCount, setSeatedCount] = useState(0)
  const [speakingIndex, setSpeakingIndex] = useState(-1)
  const [sessionComplete, setSessionComplete] = useState(false)
  const [showLeaderSection, setShowLeaderSection] = useState(false)
  const [showThinkerSection, setShowThinkerSection] = useState(false)

  const splitIndex = useMemo(() => {
    const idx = parsed.findIndex(c => getTier(c.name) === 'F')
    if (idx <= 0) return -1
    const hasPBefore = parsed.slice(0, idx).some(c => getTier(c.name) === 'P')
    return hasPBefore ? idx : -1
  }, [parsed])

  const allThinkers = parsed.length > 0 && parsed.every(c => getTier(c.name) === 'F')
  const allLeaders = parsed.length > 0 && parsed.every(c => getTier(c.name) === 'P')

  useEffect(() => {
    if (instant) return
    if (parsed.length === 0) return
    const timers = []

    timers.push(setTimeout(() => {
      if (allThinkers) setShowThinkerSection(true)
      else setShowLeaderSection(true)
    }, 200))

    const assemblyDelay = 450
    const assemblyStart = 600
    parsed.forEach((_, i) => {
      timers.push(setTimeout(() => {
        setSeatedCount(c => Math.max(c, i + 1))
        if (splitIndex > 0 && i === splitIndex) {
          setShowThinkerSection(true)
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
  }, [parsed.length, instant])

  const getSeatState = (i) => {
    if (instant) return 'past'
    if (i >= seatedCount) return 'empty'
    if (sessionComplete) return 'past'
    if (speakingIndex === i) return 'speaking'
    if (speakingIndex > i) return 'past'
    return 'seated'
  }

  const renderThinkerMarkerHere = (i) => splitIndex > 0 && i === splitIndex

  const leaderVisible = instant || showLeaderSection
  const thinkerVisible = instant || showThinkerSection

  return (
    <div className="procession">
      <div className="rail">
        {allThinkers && (
          <SectionMarker label="Thinkers" visible={thinkerVisible} />
        )}
        {!allThinkers && (
          <SectionMarker label="Leaders" visible={leaderVisible} />
        )}

        {parsed.map((card, i) => {
          const state = getSeatState(i)
          if (state === 'empty') {
            if (renderThinkerMarkerHere(i) && thinkerVisible) {
              return (
                <SectionMarker
                  key={`marker-${i}`}
                  label="Thinkers"
                  visible={true}
                />
              )
            }
            return null
          }

          const tier = getTier(card.name)
          return (
            <Fragment key={i}>
              {renderThinkerMarkerHere(i) && (
                <SectionMarker label="Thinkers" visible={thinkerVisible} />
              )}
              <Seat card={card} tier={tier} state={state} sessionSlug={sessionSlug} />
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
          font-family: 'Inter', sans-serif;
          font-size: 10px;
          font-weight: 500;
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

function ShareIcon({ name, sessionSlug }) {
  const [copied, setCopied] = useState(false)

  async function handleClick(e) {
    e.preventDefault()
    e.stopPropagation()
    const cleanName = name.replace(/\s*[—–-]\s*(Practitioner|Framer|Leader|Thinker|Wildcard)\s*$/i, '').trim()
    const shareUrl = `https://www.thelongcouncil.com/archive/${sessionSlug}?member=${encodeURIComponent(cleanName)}`

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `${cleanName} — The Long Council`,
          url: shareUrl,
        })
        return
      } catch (err) {
        if (err && err.name === 'AbortError') return
      }
    }

    if (typeof navigator !== 'undefined' && navigator.clipboard) {
      try {
        await navigator.clipboard.writeText(shareUrl)
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
        return
      } catch (err) {}
    }

    if (typeof window !== 'undefined') window.prompt('Copy this link:', shareUrl)
  }

  return (
    <button
      className="share-icon"
      onClick={handleClick}
      aria-label={`Share ${name}'s view`}
      title={copied ? 'Link copied' : `Share ${name}'s view`}
    >
      {copied ? (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
          <polyline points="20 6 9 17 4 12" />
        </svg>
      ) : (
        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
          <polyline points="16 6 12 2 8 6" />
          <line x1="12" y1="2" x2="12" y2="15" />
        </svg>
      )}
      <style jsx>{`
        .share-icon {
          width: 24px;
          height: 24px;
          border-radius: 50%;
          border: 1px solid #6b1a1a;
          background: transparent;
          color: #6b1a1a;
          display: inline-flex;
          align-items: center;
          justify-content: center;
          cursor: pointer;
          padding: 0;
          flex-shrink: 0;
          transition: background 0.2s ease, color 0.2s ease;
        }
        .share-icon:hover {
          background: #6b1a1a;
          color: #f3eeea;
        }
      `}</style>
    </button>
  )
}

function Seat({ card, tier, state, sessionSlug }) {
  const { name, role, framing, body, challenge } = card
  const isThinker = tier === 'F'
  const [imgFailed, setImgFailed] = useState(false)
  const slug = nameToAvatarSlug(name)
  const showImage = !imgFailed && slug

  return (
    <div className={`seat ${isThinker ? 'thinker' : 'leader'} state-${state}`}>
      <div className="avatar">
        {showImage ? (
          <img
            src={`/avatars/avatar_${slug}.webp`}
            alt={name}
            onError={() => setImgFailed(true)}
          />
        ) : (
          <span className="initials">{getInitials(name)}</span>
        )}
      </div>

      <div className="content">
        <div className="head">
          <div className="head-meta">
            <span className="name">{name}</span>
            {role && <span className="role">{role}</span>}
          </div>
          {sessionSlug && <ShareIcon name={name} sessionSlug={sessionSlug} />}
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
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
          font-family: 'Playfair Display', serif;
          font-size: 9.5px;
          font-weight: 600;
          z-index: 2;
          background: #fdf5ec;
          color: #6b1a1a;
          border: 1px solid #c4897a;
          transition: box-shadow 0.4s ease;
          box-shadow: 0 0 0 2px #f8f6f2;
        }
        .avatar img {
          width: 100%;
          height: 100%;
          object-fit: cover;
          display: block;
        }
        .avatar .initials {
          display: inline-flex;
          align-items: center;
          justify-content: center;
        }
        .seat.state-speaking .avatar {
          box-shadow: 0 0 0 2px #f8f6f2, 0 0 0 5px rgba(107, 26, 26, 0.18);
        }

        .content {
          padding-top: 1px;
        }

        .head {
          display: flex;
          align-items: center;
          gap: 12px;
          margin-bottom: 3px;
        }
        .head-meta {
          flex: 1;
          min-width: 0;
          display: flex;
          align-items: baseline;
          gap: 10px;
          flex-wrap: wrap;
        }
        .name {
          font-family: 'Playfair Display', serif;
          font-size: 16px;
          font-weight: 600;
          color: #0f0f0f;
          line-height: 1.3;
        }
        .role {
          font-family: 'Inter', sans-serif;
          font-size: 11px;
          color: #7a7a7a;
          font-style: italic;
        }

        .framing {
          font-family: 'Playfair Display', serif;
          font-size: 17.5px;
          font-weight: 500;
          color: #0f0f0f;
          line-height: 1.4;
          letter-spacing: -0.005em;
          margin-top: 10px;
          margin-bottom: 0;
          max-width: 62ch;
          transition: margin-bottom 0.5s ease;
        }
        .seat.state-speaking .framing,
        .seat.state-past .framing {
          margin-bottom: 16px;
        }

        .body {
          font-family: 'Inter', sans-serif;
          font-size: 14.5px;
          line-height: 1.7;
          color: #1a1a1a;
          max-width: 62ch;
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
          font-family: 'Inter', sans-serif;
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
          font-family: 'Inter', sans-serif;
          font-size: 13.5px;
          color: #6b1a1a;
          font-style: italic;
          line-height: 1.65;
          max-width: 62ch;
          max-height: 0;
          overflow: hidden;
          opacity: 0;
          margin-top: 0;
          padding: 0 14px;
          border-left: 2px solid transparent;
          background: transparent;
          border-radius: 2px;
          transition:
            max-height 0.6s ease-in-out,
            opacity 0.5s ease,
            margin-top 0.4s ease,
            padding 0.4s ease,
            border-left-color 0.4s ease,
            background 0.4s ease;
        }
        .seat.state-speaking .challenge,
        .seat.state-past .challenge {
          max-height: 200px;
          opacity: 1;
          margin-top: 18px;
          padding: 12px 14px;
          border-left-color: #c4897a;
          background: rgba(107, 26, 26, 0.03);
        }
        .challenge :global(strong) {
          font-weight: 600;
          font-style: normal;
        }

        @media (min-width: 768px) {
          .name { font-size: 17px; }
          .framing { font-size: 18px; }
          .body { font-size: 15px; }
          .challenge { font-size: 14px; }
        }
      `}</style>
    </div>
  )
}
