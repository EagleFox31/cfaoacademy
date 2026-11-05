import { createPortal } from 'react-dom'
import {
  HOME_LANDING_BG,
  HOME_LANDING_BG_POSITION,
} from '../data/homeSectionBg.js'

/**
 * Fond fixe plein écran pour toute la landing (hors hero).
 * Un seul visuel — pas de crossfade photo / voile dark-light au scroll.
 */
export default function HomeBackdrop({ heroPhase }) {
  const backdrop = (
    <div
      className={`home-backdrop${heroPhase ? ' is-hero-phase' : ''}`}
      aria-hidden="true"
    >
      <div
        className="home-backdrop-layer home-backdrop-layer--static"
        style={{
          backgroundImage: `url(${HOME_LANDING_BG})`,
          backgroundPosition: HOME_LANDING_BG_POSITION,
          opacity: 1,
        }}
      />
      <div className="home-backdrop-veil home-backdrop-veil--light" />
    </div>
  )

  if (typeof document === 'undefined') return backdrop
  return createPortal(backdrop, document.body)
}
