import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { ARTICLES } from '../../../../data/articles/index.js'
import { PORTAL_NAV_SECTIONS } from '../../../../data/index.js'
import { ADMIN_NAV, adminPath } from '../../../../utils/adminAccess'
import { articleRows, missingTranslations } from '../../../../utils/articleAdmin'
import { PORTAL_CONFIGS } from '../../roleportal/configs/index.js'
import { profilesInFactory } from '../../roleportal/matrix.js'
import { useProjectKpis } from './ProjectModule'

export default function OverviewModule({ t, users }) {
  const project = useProjectKpis()
  const missing = useMemo(() => missingTranslations(articleRows(ARTICLES)), [])
  const profiles = Object.keys(PORTAL_NAV_SECTIONS)
  const inFactory = profilesInFactory(PORTAL_CONFIGS, profiles).length

  const accountsValue = users.status === 'ready' ? users.data.length : '–'
  const accountsMeta = users.status === 'ready' ? t.kpi_accounts_meta : t[`state_${users.status}`]

  const tiles = [
    { key: 'kpi_accounts', v: accountsValue, m: accountsMeta, to: adminPath('accounts'), accent: 'var(--dlv-navy)' },
    {
      key: 'kpi_articles', v: ARTICLES.length, to: adminPath('articles'), accent: 'var(--dlv-green)',
      m: missing ? t.kpi_articles_meta.replace('{n}', missing) : t.kpi_articles_meta_ok,
    },
    {
      key: 'kpi_portals', v: inFactory, to: adminPath('portals'), accent: 'var(--dlv-amber)',
      m: t.kpi_portals_meta.replace('{total}', profiles.length),
    },
    {
      key: 'kpi_project', v: `${project.pct} %`, to: adminPath('project'), accent: 'var(--dlv-red)',
      m: t.kpi_project_meta.replace('{done}', project.done).replace('{total}', project.total),
    },
  ]

  return (
    <>
      <div className="dlv-kpis">
        {tiles.map(tile => (
          <Link key={tile.key} to={tile.to} className="dlv-kpi adm-shortcut" style={{ '--dlv-accent': tile.accent }}>
            <div className="dlv-kpi-k">{t[tile.key]}</div>
            <div className="dlv-kpi-v">{tile.v}</div>
            <div className="dlv-kpi-m">{tile.m}</div>
          </Link>
        ))}
      </div>

      <h3 className="dlv-section-title">{t.shortcuts_title}</h3>
      <div className="dlv-grid-3">
        {ADMIN_NAV.flatMap(g => g.items).map(it => (
          <Link key={it.id} to={adminPath(it.id)} className="dlv-panel adm-shortcut">
            <h4><span aria-hidden="true">{it.ico}</span>{t[`title_${it.id}`]}</h4>
            <p className="dlv-panel-sub">{t[`lead_${it.id}`]}</p>
          </Link>
        ))}
      </div>
    </>
  )
}
