import { Link } from 'react-router-dom'
import useDeliveryState from '../../../../hooks/useDeliveryState'
import { computeDeliveryKpis } from '../../../../utils/deliveryAccess'

export function useProjectKpis() {
  const { stories } = useDeliveryState()
  return computeDeliveryKpis(stories)
}

export default function ProjectModule({ t }) {
  const k = useProjectKpis()
  const meta = t.kpi_tasks_meta.replace('{total}', k.total)
  const tiles = [
    { key: 'kpi_project', v: `${k.pct} %`, m: t.kpi_project_meta.replace('{done}', k.done).replace('{total}', k.total), accent: 'var(--dlv-navy)' },
    { key: 'kpi_done', v: k.done, m: meta, accent: 'var(--dlv-green)' },
    { key: 'kpi_in_progress', v: k.inProgress, m: meta, accent: 'var(--dlv-amber)' },
    { key: 'kpi_blocked', v: k.blocked, m: meta, accent: 'var(--dlv-red)' },
  ]
  return (
    <>
      <div className="dlv-kpis">
        {tiles.map(tile => (
          <div key={tile.key} className="dlv-kpi" style={{ '--dlv-accent': tile.accent }}>
            <div className="dlv-kpi-k">{t[tile.key]}</div>
            <div className="dlv-kpi-v">{tile.v}</div>
            <div className="dlv-kpi-m">{tile.m}</div>
          </div>
        ))}
      </div>
      <div className="dlv-toolbar" style={{ marginTop: 16 }}>
        <Link to="/portail/delivery" className="dlv-btn primary">{t.open_cockpit}</Link>
      </div>
      <h3 className="dlv-section-title">{t.project_issues}</h3>
      <div className="dlv-panel dlv-awaiting">
        <div className="dlv-panel-k">{t.under_construction}</div>
        <p className="dlv-panel-sub">{t.github_wait}</p>
      </div>
    </>
  )
}
