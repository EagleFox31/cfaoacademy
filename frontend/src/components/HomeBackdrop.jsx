import { useEffect, useRef, useState } from 'react'
import { HERO_BACKDROP_VISUALS } from '../data/heroImages.js'
import { HOME_BACKDROP_SECTIONS } from '../data/homeSectionBg.js'

/** Crossfade marque Motors — calque conservé le temps de l’animation sortie. */
function SectionBrandHoverLayer({ image, show, position = 'center' }) {
  const [renderedUrl, setRenderedUrl] = useState(null)
  const [fadedIn, setFadedIn] = useState(false)
  const rafRef = useRef(0)

  useEffect(() => {
    if (!show || !image) {
      setFadedIn(false)
      return undefined
    }

    setRenderedUrl(image)
    rafRef.current = requestAnimationFrame(() => {
      rafRef.current = requestAnimationFrame(() => setFadedIn(true))
    })

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
    }
  }, [show, image])

  const handleTransitionEnd = (e) => {
    if (e.propertyName !== 'opacity' || fadedIn) return
    setRenderedUrl(null)
  }

  if (!renderedUrl) return null

  return (
    <div
      className={`home-backdrop-layer home-backdrop-layer--section home-backdrop-layer--brand-hover${fadedIn ? ' is-active' : ''}`}
      style={{
        backgroundImage: `url(${renderedUrl})`,
        backgroundPosition: position,
      }}
      onTransitionEnd={handleTransitionEnd}
    />
  )
}

export default function HomeBackdrop({ activeId, heroPhase, sectionHoverImages = {} }) {
  return (
    <div
      className={`home-backdrop${heroPhase ? ' is-hero-phase' : ''}`}
      aria-hidden="true"
    >
      {HERO_BACKDROP_VISUALS.map(({ id, image, position }) => (
        <div
          key={`hero-${id}`}
          className="home-backdrop-layer home-backdrop-layer--hero"
          style={{
            backgroundImage: `url(${image})`,
            backgroundPosition: position,
          }}
        />
      ))}
      {HOME_BACKDROP_SECTIONS.map(({ id, image, position = 'center' }) => {
        const isSectionActive = !heroPhase && activeId === id
        return (
          <div key={id} className="home-backdrop-section-stack">
            <div
              className={`home-backdrop-layer home-backdrop-layer--section${isSectionActive ? ' is-active' : ''}`}
              style={{
                backgroundImage: `url(${image})`,
                backgroundPosition: position,
              }}
            />
            {id === 'offres' && (
              <SectionBrandHoverLayer
                image={sectionHoverImages.offres}
                show={Boolean(sectionHoverImages.offres && !heroPhase)}
                position={position}
              />
            )}
          </div>
        )
      })}
      <div
        className={[
          'home-backdrop-veil',
          !heroPhase && activeId === 'formations-carrosserie' ? 'home-backdrop-veil--light' : '',
        ].filter(Boolean).join(' ')}
      />
    </div>
  )
}
