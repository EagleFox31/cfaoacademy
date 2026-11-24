import { useEffect, useState } from 'react'
import { Link, Navigate, useParams } from 'react-router-dom'
import VersConnexion from '../../../components/VersConnexion.jsx'
import AppShell from '../../../components/app/AppShell'
import LocaleSwitch from '../../../components/LocaleSwitch'
import useSiteEffects from '../../../hooks/useSiteEffects'
import useAuth from '../../../hooks/useAuth'
import usePortalBackground from '../../../hooks/usePortalBackground'
import useLocale from '../../../hooks/useLocale'
import { supervisionApi } from '../../../lib/supervisionApi'
import {
  SUPERVISION_HOME, SUPERVISION_NAV, SUPERVISION_VIEWS, canSeeSupervision, supervisionPath,
} from '../../../utils/supervisionStatus'
import { ConnectionsView, DependenciesView, ModuleView, OverviewView, RefusedView } from './SupervisionViews'

const VIEWS = {
  overview: OverviewView, dependencies: DependenciesView, connections: ConnectionsView, refused: RefusedView,
}

/**
 * Supervision de la plateforme (rôles platform_ops et superadmin) : un écran
 * d'application en lecture seule. Le menu suit les droits rendus par l'API
 * (`/access`), Cerbos décidant côté serveur.
 */
export default function SupervisionConsole() {
  useSiteEffects()
  const { user, status } = useAuth()
  usePortalBackground(user)
  const { t, locale, setLocale } = useLocale('supervision')
  const { t: commonT } = useLocale('common')
  const { view = SUPERVISION_HOME, project } = useParams()

  const roleOk = Boolean(user && canSeeSupervision(user.roles))
  const [access, setAccess] = useState(null)
  const [moduleName, setModuleName] = useState(null)
  useEffect(() => {
    if (!roleOk) return undefined
    let live = true
    supervisionApi.access().then(
      a => { if (live) setAccess(a) },
      () => { if (live) setAccess({ board: false, connections: false, failed: true }) },
    )
    return () => { live = false }
  }, [roleOk])

  if (status === 'loading') return null
  if (!user) return <VersConnexion />
  if (!roleOk) return <Navigate to="/portail" replace />
  if (!project && !SUPERVISION_VIEWS.includes(view)) return <Navigate to={supervisionPath()} replace />
  if (access && !access.failed && !access.board) return <Navigate to="/portail" replace />
  const needs = !project && SUPERVISION_NAV.find(it => it.id === view)?.needs
  if (needs && access && !access[needs]) return <Navigate to={supervisionPath()} replace />

  const activeId = project ? SUPERVISION_HOME : view
  const nav = [{
    group: '',
    items: SUPERVISION_NAV
      .filter(it => !it.needs || access?.[it.needs])
      .map(it => ({ id: it.id, ico: it.ico, label: t[`nav_${it.id}`], to: supervisionPath(it.id) })),
  }]
  const View = VIEWS[view]

  let body
  if (!access) body = <p className="dlv-hint">{t.loading}</p>
  else if (access.failed) body = <div className="dlv-awaiting dlv-panel"><p className="dlv-panel-sub">{t.load_error}</p></div>
  else if (project) body = <ModuleView project={project} t={t} locale={locale} onName={setModuleName} />
  else body = <View t={t} locale={locale} />

  return (
    <AppShell
      brand={{ badge: t.brand_badge, title: t.brand_title, subtitle: t.brand_subtitle, navLabel: t.nav_label }}
      nav={nav}
      activeId={activeId}
      eyebrow={t.eyebrow}
      title={project ? (moduleName ?? project) : t[`title_${view}`]}
      lead={project ? t.lead_module : t[`lead_${view}`]}
      back={{ to: '/portail', label: t.back_portal }}
      actions={(
        <>
          <LocaleSwitch locale={locale} onChange={setLocale} ariaLabel={commonT.langSwitchAria} className="locale-switch--dlv" />
          <Link to="/" className="dlv-topbar-back">{t.back_site}</Link>
        </>
      )}
      chips={<span className="dlv-role-chip">{user.firstName} {user.lastName} · {t.chip_role}</span>}
    >
      {body}
    </AppShell>
  )
}
