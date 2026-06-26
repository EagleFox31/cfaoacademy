import { createPortal } from 'react-dom'
import { HOME_BACKDROP_SECTIONS } from '../data/homeSectionBg.js'
import { sectionVeilBackdropClass } from '../data/sectionBackdropVeils.js'
import BackdropLayer from './BackdropLayer.jsx'

/**
 * Netflix accueil : fond fixe plein écran par section, crossfade au scroll.
 * Opacités : CSS vars --backdrop-op-{id} posées par useHomeSectionFocus.
 */
export default function HomeBackdrop({
  activeId,
  heroPhase,
  sectionHoverImages = {},
}) {
  const activeSection = HOME_BACKDROP_SECTIONS.find((s) => s.id === activeId)
  const veilClass = heroPhase ? '' : sectionVeilBackdropClass(activeSection?.veil)

  const backdrop = (
    <div
      className={`home-backdrop${heroPhase ? ' is-hero-phase' : ''}`}
      aria-hidden="true"
    >
      {HOME_BACKDROP_SECTIONS.map(({ id, image, position = 'center' }) => {
        const hoverImage = id === 'offres' ? sectionHoverImages.offres : null
        return (
          <BackdropLayer
            key={id}
            id={id}
            image={hoverImage ?? image}
            position={position}
          />
        )
      })}
      <div className={['home-backdrop-veil', veilClass].filter(Boolean).join(' ')} />
    </div>
  )

  if (typeof document === 'undefined') return backdrop
  return createPortal(backdrop, document.body)
}
