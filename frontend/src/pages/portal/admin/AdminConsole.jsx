import { Link, Navigate, useParams } from 'react-router-dom'
import VersConnexion from '../../../components/VersConnexion.jsx'
import AppShell from '../../../components/app/AppShell'
import LocaleSwitch from '../../../components/LocaleSwitch'
import useSiteEffects from '../../../hooks/useSiteEffects'
import useAuth from '../../../hooks/useAuth'
import usePortalBackground from '../../../hooks/usePortalBackground'
import useLocale from '../../../hooks/useLocale'
import useAdminResource, { fetchAllPages, fetchAllUsers } from '../../../hooks/useAdminResource'
import { api } from '../../../lib/api'
import {
  ADMIN_HOME, ADMIN_MODULE_IDS, ADMIN_NAV, adminPath, canAccessAdminConsole,
} from '../../../utils/adminAccess'
import OverviewModule from './modules/OverviewModule'
import AccountsModule from './modules/AccountsModule'
import RolesModule from './modules/RolesModule'
import PortalsModule from './modules/PortalsModule'
import ArticlesModule from './modules/ArticlesModule'
import ProjectModule from './modules/ProjectModule'
import GithubModule from './modules/GithubModule'

const MODULES = {
  overview: OverviewModule,
  accounts: AccountsModule,
  roles: RolesModule,
  portals: PortalsModule,
  articles: ArticlesModule,
  project: ProjectModule,
  github: GithubModule,
}

/**
 * Console d'administration du super admin : un écran d'application
 * (barre latérale + barre du haut), un module par entrée du menu.
 * Lot 1 : lecture seule. Chaque appel reste contrôlé côté serveur.
 */
export default function AdminConsole() {
  useSiteEffects()
  const { user, status } = useAuth()
  usePortalBackground(user)
  const { t, locale, setLocale } = useLocale('admin')
  const { t: tPortal } = useLocale('portal')
  const { t: commonT } = useLocale('common')
  const { module = ADMIN_HOME } = useParams()

  const allowed = Boolean(user && canAccessAdminConsole(user.roles))
  // Chargés une fois, partagés par les modules (comptes, rôles, filiales).
  const users = useAdminResource(() => (allowed ? fetchAllUsers() : Promise.resolve([])), [allowed])
  const roles = useAdminResource(() => (allowed ? api.systemRoles() : Promise.resolve([])), [allowed])
  const units = useAdminResource(() => (allowed ? fetchAllPages(api.orgUnits) : Promise.resolve([])), [allowed])

  if (status === 'loading') return null
  if (!user) return <VersConnexion />
  if (!allowed) return <Navigate to="/portail" replace />
  if (!ADMIN_MODULE_IDS.includes(module)) return <Navigate to={adminPath()} replace />

  const nav = [
    { group: '', items: [{ id: ADMIN_HOME, ico: '◧', label: t.nav_overview, to: adminPath() }] },
    ...ADMIN_NAV.map(g => ({
      group: t[g.group],
      items: g.items.map(it => ({ id: it.id, ico: it.ico, label: t[`nav_${it.id}`], to: adminPath(it.id) })),
    })),
  ]
  const Module = MODULES[module]

  return (
    <AppShell
      brand={{ badge: t.brand_badge, title: t.brand_title, subtitle: t.brand_subtitle, navLabel: t.nav_label }}
      nav={nav}
      activeId={module}
      eyebrow={t.eyebrow}
      title={t[`title_${module}`]}
      lead={t[`lead_${module}`]}
      back={{ to: '/portail', label: t.back_portal }}
      actions={(
        <>
          <LocaleSwitch locale={locale} onChange={setLocale} ariaLabel={commonT.langSwitchAria} className="locale-switch--dlv" />
          <Link to="/" className="dlv-topbar-back">{t.back_site}</Link>
        </>
      )}
      chips={<span className="dlv-role-chip">{user.firstName} {user.lastName} · {t.chip_role}</span>}
    >
      <div className="dlv-readonly">{t.readonly_banner}</div>
      <Module t={t} tPortal={tPortal} locale={locale} users={users} roles={roles} units={units} />
    </AppShell>
  )
}
