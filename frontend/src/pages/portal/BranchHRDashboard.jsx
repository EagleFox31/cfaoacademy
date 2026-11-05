import { useState } from 'react'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalHeader from '../../components/PortalHeader'
import PortalDemoBar from '../../components/PortalDemoBar'
import useSiteEffects from '../../hooks/useSiteEffects'
import usePortalReveal from '../../hooks/usePortalReveal'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import { LMS_BY_USER } from '../../data/mock_lms'
import PortalSectionEyebrow from '../../components/PortalSectionEyebrow.jsx'

function initials(nom) {
  return nom.split(' ').map(n => n[0]).join('').toUpperCase()
}

export default function BranchHRDashboard() {
  useSiteEffects()
  usePortalReveal()
  const { user } = useAuth()
  const { t } = useLocale('portal')
  const lms = LMS_BY_USER[user.demoKey]
  const [query, setQuery] = useState('')
  if (!lms) return null

  const collabs  = lms.collaborateurs
  const filtered = collabs.filter(c =>
    c.nom.toLowerCase().includes(query.toLowerCase()) ||
    (c.brand && c.brand.toLowerCase().includes(query.toLowerCase())) ||
    (c.dept  && c.dept.toLowerCase().includes(query.toLowerCase()))
  )

  const active    = collabs.filter(c => c.progress !== null && c.progress > 0).length
  const certified = collabs.filter(c => c.progress === 100).length
  const alerts    = collabs.filter(c => c.alert).length

  return (
    <>
      <Nav />
      <main className="portal-page">
        <PortalHeader user={user} />

        {/* ── Section 1 : KPIs ── */}
        <section>
          <div className="container" style={{ padding: '48px 32px' }}>
            <div className="portal-section-head">
              <PortalSectionEyebrow icon="users" label={t.eyebrow_overview} />
              <h2 className="portal-section-title">{t.title_branch_dashboard}</h2>
            </div>
            <div className="portal-kpi-row">
              <div className="portal-kpi-card">
                <div className="portal-kpi-value">{collabs.length}</div>
                <div className="portal-kpi-label">{t.kpi_collaborators}</div>
              </div>
              <div className="portal-kpi-card">
                <div className="portal-kpi-value accent">{active}</div>
                <div className="portal-kpi-label">{t.kpi_active_training}</div>
              </div>
              <div className="portal-kpi-card">
                <div className="portal-kpi-value green">{certified}</div>
                <div className="portal-kpi-label">
                  {certified > 1 ? t.kpi_certified_pl : t.kpi_certified}
                </div>
              </div>
              <div className="portal-kpi-card">
                <div className={`portal-kpi-value ${alerts > 0 ? 'accent' : ''}`}>{alerts}</div>
                <div className="portal-kpi-label">
                  {alerts > 1 ? t.kpi_alerts_pl : t.kpi_alerts}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 2 : Annuaire ── */}
        <section>
          <div className="container" style={{ padding: '48px 32px' }}>
            <div className="portal-section-head">
              <PortalSectionEyebrow icon="clipboard" label={t.eyebrow_records} />
              <h2 className="portal-section-title">{t.title_directory}</h2>
            </div>

            <div className="portal-hr-toolbar">
              <input
                type="text"
                className="portal-hr-search"
                placeholder={t.search_placeholder}
                value={query}
                onChange={e => setQuery(e.target.value)}
              />
              <button className="portal-hr-export-btn" onClick={() => {}}>
                {t.export_csv}
              </button>
            </div>

            <div className="portal-table-wrap">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>{t.th_collaborator}</th>
                    <th>{t.th_role}</th>
                    <th>{t.th_brand}</th>
                    <th>{t.th_department}</th>
                    <th>{t.th_advancement}</th>
                    <th>{t.th_last_login}</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map(c => (
                    <tr key={c.id} className={c.alert ? 'portal-table-alert' : ''}>
                      <td>
                        <div className="portal-person-cell">
                          <div className="portal-mini-avatar">{initials(c.nom)}</div>
                          {c.nom}
                          {c.alert && <span className="portal-alert-chip">{t.alert_inactive}</span>}
                        </div>
                      </td>
                      <td style={{ fontSize: 13, color: 'var(--muted)' }}>
                        {t[`role_${c.role}`] || c.role}
                      </td>
                      <td>
                        {c.brand
                          ? <span className={`portal-brand-chip ${c.brand}`}>{c.brand}</span>
                          : <span style={{ color: 'var(--muted-2)', fontSize: 12 }}>—</span>
                        }
                      </td>
                      <td style={{ fontSize: 13 }}>{c.dept}</td>
                      <td>
                        {c.progress !== null ? (
                          <div className="portal-inline-bar">
                            <div className="portal-inline-track">
                              <div
                                className="portal-inline-fill"
                                style={{
                                  width: `${c.progress}%`,
                                  background: c.progress === 100 ? '#1aab5b' : undefined,
                                }}
                              />
                            </div>
                            <span className="portal-inline-pct">{c.progress}%</span>
                          </div>
                        ) : (
                          <span style={{ fontSize: 12, color: 'var(--muted-2)' }}>—</span>
                        )}
                      </td>
                      <td style={{ fontSize: 13 }}>{c.lastLogin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <PortalDemoBar />
    </>
  )
}
