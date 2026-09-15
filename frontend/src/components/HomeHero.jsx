import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import useLocale from '../hooks/useLocale.js'
import useAuth from '../hooks/useAuth.js'
import { HERO_PERSONA_IDS } from '../i18n/hero.js'
import { HERO_DEFAULT, HERO_IMAGES, HERO_BG_POSITION, HERO_VISUAL_IDS } from '../data/heroImages.js'
import HeroLoggedInPanel, { HeroLoggedInBadge } from './HeroLoggedInPanel.jsx'
import HeroNewsCarousel from './HeroNewsCarousel.jsx'
import { ARTICLES } from '../data/articles/index.js'
import { localizedArticleFields } from '../utils/localizeCard.js'
import { resolveHeroNewsGallery, heroNewsGalleryStaticSrcs } from '../utils/heroNewsSlides.js'
import { resolvePortalBackgroundSelection } from '../utils/portalBackgroundSelect.js'
import {
  resolveLoggedHeroVisualId,
  resolveLoggedLearnerHeroHeadline,
  resolveLoggedManagerHeroHeadline,
} from '../utils/portalPersona.js'

const HERO_AUTO_CYCLE = ['default', ...HERO_PERSONA_IDS, 'b2b']
const HERO_AUTO_STEP_MS = 10000
const HERO_WELCOME_MS = 5500
const HERO_NEWS_MS = 5000

const PERSONA_ICONS = {
  vl: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M5 17h14" />
      <path d="M6 17l1.2-4.8a2 2 0 0 1 1.9-1.5h7.8a2 2 0 0 1 1.9 1.5L20 17" />
      <circle cx="7.5" cy="17" r="1.5" />
      <circle cx="16.5" cy="17" r="1.5" />
      <path d="M8 11h8" />
    </svg>
  ),
  pl: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M3 14h11v3H3z" />
      <path d="M14 12h4l3 3v2h-7z" />
      <circle cx="6.5" cy="17" r="1.5" />
      <circle cx="17.5" cy="17" r="1.5" />
      <path d="M5 14V9h6v5" />
      <path d="M14 12V8h3l2 4" />
    </svg>
  ),
  carrossier: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 14h16" />
      <path d="M6 14l1-3.5a2 2 0 0 1 1.9-1.5h8.2a2 2 0 0 1 1.9 1.5L20 14" />
      <circle cx="7.5" cy="14" r="1.5" />
      <circle cx="16.5" cy="14" r="1.5" />
      <path d="M12 6v2" />
      <path d="M9.5 7.5 12 6l2.5 1.5" />
      <path d="M10 10h4" />
    </svg>
  ),
  savParts: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7.5 12 4l8 3.5v9L12 20l-8-3.5z" />
      <path d="M12 11.5V20" />
      <path d="m20 11-8 3.5L4 11" />
      <path d="M9 9.5v3" />
      <path d="M15 9.5v3" />
    </svg>
  ),
  b2b: (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 20V6l8-3 8 3v14" />
      <path d="M4 20h16" />
      <path d="M9 20v-5h2v5" />
      <path d="M13 20v-7h2v7" />
      <path d="M17 20v-4h2v4" />
      <path d="M8 9h.01" />
      <path d="M12 9h.01" />
      <path d="M16 9h.01" />
    </svg>
  ),
}

function HeroTitlePrefix({ firstName }) {
  if (!firstName) return null
  return (
    <span className="hero-home-title-firstname">
      {firstName},{' '}
    </span>
  )
}

function HeroTitle({ activeId, t, firstName, user }) {
  const managerHeadline = user ? resolveLoggedManagerHeroHeadline(user, t) : null
  const loggedLearnerHeadline = user ? resolveLoggedLearnerHeroHeadline(user, activeId, t) : null
  const persona = t.personas[activeId] ?? (activeId === 'b2b' ? t.b2b : null)
  const headline = managerHeadline ?? loggedLearnerHeadline ?? (persona?.headlineHighlight
    ? {
        prefix: t.headlineTemplateBefore,
        before: persona.headlineBefore,
        highlight: persona.headlineHighlight,
        after: persona.headlineAfter,
        afterBlock: persona.headlineAfterBlock,
      }
    : null)

  if (!headline?.highlight) {
    return (
      <h1 className="hero-home-title" aria-live="polite">
        <HeroTitlePrefix firstName={firstName} />
        {t.defaultTitleBefore}
        <span className="hero-home-highlight">{t.defaultTitleEm}</span>
        {t.defaultTitleAfter}
        <strong>{t.defaultTitleBrand}</strong>
      </h1>
    )
  }

  return (
    <h1 className="hero-home-title" aria-live="polite">
      <HeroTitlePrefix firstName={firstName} />
      {headline.prefix}
      {headline.before && `${headline.before} `}
      <span className="hero-home-title-tail">
        <span className="hero-home-highlight" key={headline.highlight}>
          {headline.highlight}
        </span>
        {headline.after && (
          <span
            key={`after-${headline.highlight}`}
            className={headline.afterBlock ? 'hero-home-title-after--block' : undefined}
          >
            {headline.after}
          </span>
        )}
      </span>
    </h1>
  )
}

function HeroBackground({ activeId, loggedBackground }) {
  if (loggedBackground) {
    return (
      <div className="hero-home-bg" aria-hidden="true">
        <div
          className="hero-home-bg-layer is-active"
          style={{
            backgroundImage: `url(${loggedBackground.src})`,
            backgroundPosition: loggedBackground.position,
          }}
        />
      </div>
    )
  }

  return (
    <div className="hero-home-bg" aria-hidden="true">
      {HERO_VISUAL_IDS.map((id) => (
        <div
          key={id}
          className={`hero-home-bg-layer${activeId === id ? ' is-active' : ''}`}
          style={{
            backgroundImage: `url(${HERO_IMAGES[id] ?? HERO_DEFAULT})`,
            backgroundPosition: HERO_BG_POSITION[id] ?? HERO_BG_POSITION.default,
          }}
        />
      ))}
    </div>
  )
}

export default function HomeHero({ onVisualChange }) {
  const { t, locale } = useLocale('hero')
  const { user } = useAuth()
  const loggedBackground = useMemo(
    () => (user ? resolvePortalBackgroundSelection(user) : null),
    [user],
  )
  const [activeVisual, setActiveVisual] = useState(() => resolveLoggedHeroVisualId(user))
  const [isManual] = useState(() => !!user)
  const [veilPct, setVeilPct] = useState(100)
  const [heroPhase, setHeroPhase] = useState('welcome')
  const [newsIndex, setNewsIndex] = useState(0)
  const [newsPaused, setNewsPaused] = useState(false)
  const [reducedMotion, setReducedMotion] = useState(false)
  const frameRef = useRef(null)
  const cycleIndexRef = useRef(0)

  const newsSlides = useMemo(() => {
    if (!user) return []
    return ARTICLES.slice(0, 3).map((article) => {
      const copy = localizedArticleFields(article, locale)
      const gallery = resolveHeroNewsGallery(article)
      return {
        slug: article.slug,
        title: copy.title,
        summary: copy.summary,
        category: copy.categoryLabel,
        gallery,
      }
    })
  }, [user, locale])

  const showNewsCarousel = Boolean(
    user && heroPhase === 'news' && newsSlides.length > 0 && !reducedMotion,
  )

  useEffect(() => {
    setReducedMotion(window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  }, [])

  /* Mobile : pas de split voile/image — carte pleine largeur lisible */
  useEffect(() => {
    const mq = window.matchMedia('(max-width: 900px)')
    const syncVeil = () => {
      if (mq.matches) setVeilPct(100)
    }
    syncVeil()
    mq.addEventListener('change', syncVeil)
    return () => mq.removeEventListener('change', syncVeil)
  }, [])

  useEffect(() => {
    if (!user || reducedMotion || newsPaused || newsSlides.length === 0) return undefined

    const delay = heroPhase === 'welcome' ? HERO_WELCOME_MS : HERO_NEWS_MS
    const timer = window.setTimeout(() => {
      if (heroPhase === 'welcome') {
        setHeroPhase('news')
        setNewsIndex(0)
        return
      }
      setNewsIndex((prev) => {
        const next = prev + 1
        if (next >= newsSlides.length) {
          setHeroPhase('welcome')
          return 0
        }
        return next
      })
    }, delay)

    return () => window.clearTimeout(timer)
  }, [user, heroPhase, newsIndex, newsPaused, reducedMotion, newsSlides.length])

  useEffect(() => {
    if (!user) {
      setHeroPhase('welcome')
      setNewsIndex(0)
    }
  }, [user])

  useEffect(() => {
    newsSlides.forEach((slide) => {
      heroNewsGalleryStaticSrcs(slide.gallery).forEach((src) => {
        const img = new Image()
        img.src = src
      })
    })
  }, [newsSlides])

  useEffect(() => {
    if (user) {
      setActiveVisual(resolveLoggedHeroVisualId(user))
    }
  }, [user])

  useEffect(() => {
    onVisualChange?.(activeVisual)
  }, [activeVisual, onVisualChange])

  useEffect(() => {
    if (isManual) return undefined
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined

    const timer = window.setInterval(() => {
      cycleIndexRef.current = (cycleIndexRef.current + 1) % HERO_AUTO_CYCLE.length
      setActiveVisual(HERO_AUTO_CYCLE[cycleIndexRef.current])
    }, HERO_AUTO_STEP_MS)

    return () => window.clearInterval(timer)
  }, [isManual])

  const glassRef = useRef(null)

  const handleTilt = useCallback((e) => {
    const card = glassRef.current
    if (!card) return
    const rect = card.getBoundingClientRect()
    const x = (e.clientX - rect.left) / rect.width
    const y = (e.clientY - rect.top) / rect.height
    const rotX = (0.5 - y) * 10
    const rotY = (x - 0.5) * 14
    card.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) scale3d(1.01,1.01,1.01)`
  }, [])

  const handleTiltReset = useCallback(() => {
    const card = glassRef.current
    if (!card) return
    card.style.transform = ''
  }, [])

  const updateVeilFromClientX = useCallback((clientX) => {
    const frame = frameRef.current
    if (!frame) return
    const rect = frame.getBoundingClientRect()
    const pct = Math.min(100, Math.max(0, ((clientX - rect.left) / rect.width) * 100))
    setVeilPct(pct)
    frame.style.setProperty('--hero-veil-width', `${pct}%`)
  }, [])

  const onVeilScrubStart = (e) => {
    if (e.button !== 0) return
    e.preventDefault()
    updateVeilFromClientX(e.clientX)
    const onMove = (ev) => updateVeilFromClientX(ev.clientX)
    const onUp = () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }

  useEffect(() => {
    const sources = loggedBackground
      ? [loggedBackground.src]
      : Object.values(HERO_IMAGES)
    sources.forEach((src) => {
      const img = new Image()
      img.src = src
    })
  }, [loggedBackground])

  return (
    <header
      id="accueil"
      className={`hero hero--home${isManual ? '' : ' hero--home--auto'}${user ? ' hero--home--logged' : ''}${showNewsCarousel ? ' hero--home--news' : ''}`}
    >
      <div
        className="hero-home-frame"
        ref={frameRef}
        style={{ '--hero-veil-width': `${veilPct}%` }}
      >
        {!user && (
          <HeroBackground activeId={activeVisual} loggedBackground={loggedBackground} />
        )}

        {!user && <div className="hero-home-veil" aria-hidden="true" />}

        {!user && (
        <div
          className="hero-home-veil-scrubber"
          role="slider"
          aria-label={t.veilScrubberAria}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={Math.round(veilPct)}
          onPointerDown={onVeilScrubStart}
        />
        )}

        <div className="container">
          {showNewsCarousel ? (
            <HeroNewsCarousel
              slide={newsSlides[newsIndex]}
              slideIndex={newsIndex}
              slideCount={newsSlides.length}
              eyebrow={t.newsEyebrow}
              readLabel={t.newsRead}
              onPause={() => setNewsPaused(true)}
              onResume={() => setNewsPaused(false)}
            />
          ) : (
            <div
              key={activeVisual}
              className="hero-home-copy hero-home-glass"
              ref={glassRef}
              onMouseMove={handleTilt}
              onMouseLeave={handleTiltReset}
            >
              <div className="hero-indicator" aria-hidden="true" />

              {user && <HeroLoggedInBadge user={user} />}

              <HeroTitle activeId={activeVisual} t={t} firstName={user?.firstName} user={user} />

              {!user && <p className="hero-home-lead">{t.lead}</p>}

              {user && <HeroLoggedInPanel user={user} />}
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
