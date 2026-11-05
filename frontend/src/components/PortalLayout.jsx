import { useRef } from 'react'
import Nav from './Nav.jsx'
import Footer from './Footer.jsx'
import PortalHeader from './PortalHeader.jsx'
import PortalStickyBar from './PortalStickyBar.jsx'
import PortalDemoBar from './PortalDemoBar.jsx'
import PortalReveal from './PortalReveal.jsx'
import useSiteEffects from '../hooks/useSiteEffects.js'
import usePortalReveal from '../hooks/usePortalReveal.js'

/**
 * Template Layout Pattern pour les profils du portail CFAO Academy.
 *
 * Enveloppe l'ensemble des pages de dashboard (Technicien, Manager, DPS/DOP, RH, KI, SuperAdmin) :
 * - Initialise les effets globaux (tooltips, smooth scroll) et l'apparition au scroll (PortalReveal)
 * - Navigation supérieure (<Nav />) avec notifications optionnelles
 * - Barre flottante (<PortalStickyBar />) synchronisée automatiquement avec l'en-tête
 * - En-tête paramétrable (<PortalHeader /> standard ou composant custom via slot `header`)
 * - Conteneur principal <main className="portal-page">
 * - Pied de page (<Footer />) et barre de démonstration (<PortalDemoBar />)
 * - Slot modal (<PortalModal />)
 */
export default function PortalLayout({
  user,
  lms,
  header = null,
  headerProps = {},
  headerRef = null,
  showStickyBar = true,
  stickyVariant,
  filialeBrands,
  notifications = [],
  navActive = 'portail',
  showDemoBar = true,
  showFooter = true,
  modal = null,
  className = '',
  children,
}) {
  useSiteEffects()
  usePortalReveal()

  const fallbackHeaderRef = useRef(null)
  const effectiveHeaderRef = headerRef || fallbackHeaderRef

  return (
    <>
      <Nav user={user} active={navActive} notifications={notifications} />

      {showStickyBar && user && (
        <PortalStickyBar
          user={user}
          lms={lms}
          headerRef={effectiveHeaderRef}
          variant={stickyVariant}
          filialeBrands={filialeBrands}
        />
      )}

      <main className={`portal-page ${className}`.trim()}>
        <div ref={effectiveHeaderRef}>
          {header || (
            <PortalHeader
              user={user}
              lms={lms}
              filialeBrands={filialeBrands}
              {...headerProps}
            />
          )}
        </div>

        {children}
      </main>

      {showFooter && <Footer />}
      {showDemoBar && <PortalDemoBar />}
      {modal}
    </>
  )
}

/** Sous-composant Section optionnel pour structurer les blocs d'un dashboard */
PortalLayout.Section = function PortalLayoutSection({
  id,
  className = '',
  children,
  ...props
}) {
  return (
    <PortalReveal id={id} className={className} {...props}>
      {children}
    </PortalReveal>
  )
}
