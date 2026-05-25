import { useMemo, useEffect, useState, useRef, Fragment } from 'react'
import { getTier, getInitials, slugify, parseCard, renderInline } from '../lib/cardParser'
import { resolveAvatarSlug } from '../lib/avatarSlugs'

function nameToAvatarSlug(name) {
  return resolveAvatarSlug(slugify(name))
}

export default function Procession({ cards = [], onComplete, instant = false, sessionSlug = null, scrollReveal = false }) {
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
                <SectionMarker key={`marker-${i}`} label="Thinkers" visible={true} />
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
              <Seat card={card} tier={tier} state={state} sessionSlug={sessionSlug} scrollReveal={scrollReveal} />
            </Fragment>
          )
        })}
      </div>

      <style jsx>{`
        .procession { margin: 8px 0 0; }
        .rail { position: relative; padding-left: 44px; }
        .rail::before {
          content: "";
          position: absolute;
          left: 17px;
          top: 18px;
          bottom: 18px;
          width: 1px;
          background: var(--border);
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
          background: var(--border);
        }
        .marker-label {
          font-family: 'Inter', sans-serif;
          font-size: 10px;
          font-weight: 500;
          letter-spacing: 0.12em;
          color: var(--muted-foreground);
          text-transform: uppercase;
          white-space: nowrap;
        }
        .marker-rule { flex: 1; height: 0.5px; background: var(--border); }
      `}</style>
    </div>
  )
}

function ShareQuoteLink({ name, sessionSlug }) {
  const [copied, setCopied] = useState(false)

  async function handleClick(e) {
    e.preventDefault()
    e.stopPropagation()
    const cleanName = name.replace(/\s*[—–-]\s*(Practitioner|Framer|Leader|Thinker|Wildcard)\s*$/i, '').trim()
    const shareUrl = `https://www.thelongcouncil.com/archive/${sessionSlug}?member=${encodeURIComponent(cleanName)}`

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({ title: `${cleanName} — The Long Council`, url: shareUrl })
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
      type="button"
      onClick={handleClick}
      aria-label={`Share ${name}'s quote`}
      className="share-quote"
    >
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="18" cy="5" r="3" />
        <circle cx="6" cy="12" r="3" />
        <circle cx="18" cy="19" r="3" />
        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
      </svg>
      <span>{copied ? 'Quote copied' : 'Share this quote'}</span>
    </button>
  )
}

function Seat({ card, tier, state, sessionSlug, scrollReveal = false }) {
  const { name, role, framing, body, challenge } = card
  const isThinker = tier === 'F'
  const [imgFailed, setImgFailed] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const seatRef = useRef(null)
  const slug = nameToAvatarSlug(name)
  const showImage = !imgFailed && slug

  useEffect(() => {
    if (!scrollReveal) return

    // No IntersectionObserver support → reveal so content is never stuck hidden
    if (typeof IntersectionObserver === 'undefined') {
      setRevealed(true)
      return
    }

    const el = seatRef.current
    if (!el) return

    // Within ~2× viewport from current scroll position → reveal immediately so
    // page-load (and full-page screenshot tools that don't fire scroll events)
    // never leave below-the-fold cards stuck at opacity 0.
    const rect = el.getBoundingClientRect()
    const vh = window.innerHeight || document.documentElement.clientHeight
    if (rect.top < vh * 2) {
      setRevealed(true)
      return
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setRevealed(true)
          observer.disconnect()
        }
      },
      { threshold: 0.05, rootMargin: '0px 0px -30px 0px' }
    )
    observer.observe(el)
    return () => observer.disconnect()
  }, [scrollReveal])

  return (
    <div ref={seatRef} className={`seat ${isThinker ? 'thinker' : 'leader'} state-${state}${scrollReveal ? ' scroll-reveal' : ''}${revealed ? ' revealed' : ''}`}>
      <div className="avatar">
        {showImage ? (
          <img src={`/avatars/avatar_${slug}.webp`} alt={name} onError={() => setImgFailed(true)} />
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
        </div>

        {framing && (
          <figure className="quote-block">
            <span aria-hidden="true" className="quote-glyph">&ldquo;</span>
            <blockquote className="framing">{framing}</blockquote>
            {sessionSlug && <ShareQuoteLink name={name} sessionSlug={sessionSlug} />}
          </figure>
        )}

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

        /* Scroll-reveal — must come after state-past rules */
        .seat.scroll-reveal {
          opacity: 0;
          transform: translateY(16px);
          transition: opacity 0.85s ease-out, transform 0.85s ease-out;
        }
        .seat.scroll-reveal.revealed {
          opacity: 1;
          transform: translateY(0);
        }

        .avatar {
          position: absolute;
          left: -36px; top: 0;
          width: 28px; height: 28px;
          border-radius: 50%; overflow: hidden;
          display: flex; align-items: center; justify-content: center;
          font-family: 'Playfair Display', serif;
          font-size: 9.5px; font-weight: 600;
          z-index: 2;
          background: var(--secondary); color: var(--primary);
          border: 1px solid var(--border);
          transition: box-shadow 0.4s ease;
          box-shadow: 0 0 0 2px var(--background);
        }
        .avatar img { width: 100%; height: 100%; object-fit: cover; display: block; }
        .avatar .initials { display: inline-flex; align-items: center; justify-content: center; }
        .seat.state-speaking .avatar { box-shadow: 0 0 0 2px var(--background), 0 0 0 5px color-mix(in oklab, var(--primary) 18%, transparent); }

        .content { padding-top: 1px; }

        .head { display: flex; align-items: center; gap: 12px; margin-bottom: 3px; }
        .head-meta { flex: 1; min-width: 0; display: flex; align-items: baseline; gap: 10px; flex-wrap: wrap; }
        .name { font-family: 'Playfair Display', serif; font-size: 16px; font-weight: 600; color: var(--foreground); line-height: 1.3; }
        .role { font-family: 'Inter', sans-serif; font-size: 11px; color: var(--muted-foreground); font-style: italic; }

        .quote-block {
          position: relative;
          margin: 14px 0 0;
          transition: margin-bottom 0.5s ease;
        }
        .seat.state-speaking .quote-block,
        .seat.state-past .quote-block { margin-bottom: 18px; }

        .quote-glyph {
          position: absolute;
          top: -14px; left: -2px;
          font-family: 'Playfair Display', serif;
          font-size: 52px; line-height: 1; font-weight: 500;
          color: color-mix(in oklab, var(--primary) 28%, transparent);
          user-select: none;
          pointer-events: none;
        }
        .framing {
          font-family: 'Playfair Display', serif;
          font-size: 20px; font-weight: 500;
          color: var(--foreground); line-height: 1.35;
          letter-spacing: -0.005em;
          padding-left: 28px;
          margin: 0;
          max-width: 62ch;
        }
        .share-quote {
          display: inline-flex;
          align-items: center;
          gap: 8px;
          margin-top: 14px;
          margin-left: 28px;
          padding: 2px 0;
          background: transparent;
          border: none;
          cursor: pointer;
          font-family: 'Inter', sans-serif;
          font-size: 10.5px;
          letter-spacing: 0.2em;
          text-transform: uppercase;
          color: var(--primary);
          transition: color 0.2s ease;
        }
        .share-quote:hover { color: var(--foreground); }

        .body {
          font-family: 'Inter', sans-serif;
          font-size: 14.5px; line-height: 1.7; color: var(--foreground);
          max-width: 62ch; max-height: 0; overflow: hidden; opacity: 0;
          transition: max-height 0.9s ease-in-out, opacity 0.5s ease;
        }
        .seat.state-speaking .body,
        .seat.state-past .body { max-height: 2200px; opacity: 1; }
        .body :global(p) { margin-bottom: 12px; }
        .body :global(p:last-child) { margin-bottom: 0; }
        .body :global(.sig) {
          display: inline-block;
          font-family: 'Inter', sans-serif; font-size: 10px;
          color: var(--muted-foreground); background: var(--secondary);
          padding: 1px 6px; border-radius: 2px; margin: 0 1px;
          font-style: normal; letter-spacing: 0.02em; vertical-align: baseline;
        }

        .challenge {
          font-family: 'Inter', sans-serif;
          font-size: 13.5px; color: var(--primary); font-style: italic;
          line-height: 1.65; max-width: 62ch;
          max-height: 0; overflow: hidden; opacity: 0;
          margin-top: 0; padding: 0 14px;
          border-left: 2px solid transparent;
          background: transparent; border-radius: 2px;
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
          max-height: 200px; opacity: 1;
          margin-top: 18px; padding: 12px 14px;
          border-left-color: var(--primary);
          background: color-mix(in oklab, var(--primary) 3%, transparent);
        }
        .challenge :global(strong) { font-weight: 600; font-style: normal; }

        @media (min-width: 768px) {
          .name { font-size: 17px; }
          .framing { font-size: 22px; padding-left: 32px; }
          .quote-glyph { font-size: 60px; top: -16px; }
          .share-quote { margin-left: 32px; }
          .body { font-size: 15px; }
          .challenge { font-size: 14px; }
        }
      `}</style>
    </div>
  )
}
