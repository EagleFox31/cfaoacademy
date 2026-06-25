import Nav from './Nav.jsx'
import Footer from './Footer.jsx'
import useSiteEffects from '../hooks/useSiteEffects.js'
import useEditorialPageBackground from '../hooks/useEditorialPageBackground.js'

/**
 * Enveloppe commune des pages éditoriales (footer, contact, fiches) :
 * effets site, photo fixe sur body, Nav + contenu + Footer.
 */
export default function SitePageLayout({
  navActive,
  background,
  backgroundPosition,
  showCursorGlow = false,
  children,
}) {
  useSiteEffects()
  useEditorialPageBackground({ src: background, position: backgroundPosition })

  return (
    <div className="site-shell">
      {showCursorGlow && <div className="cursor-glow" id="cursor-glow" />}
      <Nav active={navActive} />
      <div className="site-shell-body">{children}</div>
      <Footer />
    </div>
  )
}
