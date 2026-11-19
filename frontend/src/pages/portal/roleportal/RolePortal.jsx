import { useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import Nav from '../../../components/Nav'
import Footer from '../../../components/Footer'
import PortalHeader from '../../../components/PortalHeader'
import PortalStickyBar from '../../../components/PortalStickyBar'
import PortalDemoBar from '../../../components/PortalDemoBar'
import PortalAssistanceSection from '../../../components/PortalAssistanceSection.jsx'
import { scrollToPortalSection } from '../../../utils/portalScroll.js'
import useSiteEffects from '../../../hooks/useSiteEffects'
import useAuth from '../../../hooks/useAuth'
import useLocale from '../../../hooks/useLocale'
import usePortalBackground from '../../../hooks/usePortalBackground'
import usePortalHeaderHeight from '../../../hooks/usePortalHeaderHeight.js'
import useAjustementEcran from '../../../hooks/useAjustementEcran.js'
import RolePortalSection from './RolePortalSection.jsx'
import { PORTAL_NS, lecteur } from './texte.js'
import { visibleSections } from './visibility.js'

const AUCUNE_SOURCE = { values: {}, loading: false }
const useAucuneSource = () => AUCUNE_SOURCE

/**
 * Page générique des portails par rôle (docs/engineering/fabrique-portails.md).
 *
 * - `config` : constante de module (configs/<profil>.js) ;
 * - `useSources(ctx)` : hook du profil, renvoie `{ values, loading }` mémoïsé ;
 * - `selectors` : sélecteurs synchrones de `visibleIf.selector` (les mêmes
 *   que ceux de la navbar) ;
 * - `rich` : composants des sections `kind: 'rich'` et de `header.render` ;
 * - `onModule(chemin)` : ouverture d'un module servi à part (`link.module`) ;
 * - `mode` / `detail` : mode de consultation et vue détaillée.
 */
export default function RolePortal({
  config, useSources = useAucuneSource, selectors, rich, onModule, mode, detail,
}) {
  useSiteEffects()
  const { user } = useAuth()
  const { t } = useLocale(config.ns)
  const { t: tPortal, locale } = useLocale(PORTAL_NS)
  const navigate = useNavigate()
  const headerRef = useRef(null)
  const viewportRef = useRef(null)

  // Le fond hero suit le profil : `Portal` le retire au démontage, la page
  // doit le porter elle-même pour survivre à une navigation interne.
  usePortalBackground(user)
  usePortalHeaderHeight(headerRef)
  useAjustementEcran(viewportRef, [Boolean(user)])

  const roles = user?.roles
  // `mode` / `detail` aussi dans ctx : les sources du profil en dépendent.
  const ctx = useMemo(() => ({ user, roles: roles ?? [], mode, detail }), [user, roles, mode, detail])
  const { values } = useSources(ctx)
  const env = { ctx, selectors, mode, detail }
  const texte = lecteur(config.ns, t, tPortal)

  if (!user) return null

  const onLink = link => {
    if (link.module) (onModule ?? (c => window.location.assign(c)))(link.module)
    else if (link.section) scrollToPortalSection(link.section)
    else if (link.to) navigate(link.to)
    else if (link.href) window.location.assign(link.href)
  }
  const richProps = { t, tPortal, texte, locale, ctx, values }
  const EnTete = config.header?.render ? rich?.[config.header.render] : null

  return (
    <>
      {/* `config.cloche` : la cloche des alertes (`values.notifications`)
          remplace le menu d'aide, comme au portail du centre. */}
      {config.cloche ? <Nav notifications={values.notifications ?? []} hideHelp /> : <Nav />}
      <PortalStickyBar user={user} headerRef={headerRef} />
      <main className="portal-page">
        <div ref={headerRef}>
          {EnTete ? <EnTete {...richProps} /> : <PortalHeader user={user} />}
        </div>

        {visibleSections(config, env).map(section => (
          <RolePortalSection
            key={section.id}
            config={config}
            section={section}
            env={env}
            texte={texte}
            values={values}
            rich={rich}
            viewportRef={viewportRef}
            onLink={onLink}
            richProps={richProps}
          />
        ))}

        {config.assistance && <PortalAssistanceSection t={tPortal} variant={config.assistance.variant} />}
      </main>

      <Footer />
      <PortalDemoBar />
    </>
  )
}
