import { Navigate } from 'react-router-dom'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalHeader from '../../components/PortalHeader'
import PortalDemoBar from '../../components/PortalDemoBar'
import PvCard from '../../components/PvCard'
import useSiteEffects from '../../hooks/useSiteEffects'
import usePortalReveal from '../../hooks/usePortalReveal'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import { LMS_BY_USER } from '../../data/mock_lms'

export default function SuperAdminDashboard() {
  useSiteEffects()
  usePortalReveal()
  const { user } = useAuth()
  const { t } = useLocale('portal')
  const { t: td } = useLocale('delivery')
  const lms = LMS_BY_USER[user.id]
  // Compte technique du mode local (sans donnees de demo) : le journal d'erreurs.
  if (!lms) return <Navigate to="/portail/journal-erreurs" replace />

  const { globalKpis, filialesStats, recentLogs } = lms

  return (
    <>
      <Nav />
      <main className="portal-page">
        <PortalHeader user={user} />

        <section>
          <div className="container" style={{ padding: '0 32px 32px' }}>
            <PvCard
              to="/portail/delivery"
              kicker={td.page_eyebrow}
              title={td.superadmin_link_title}
              meta={td.superadmin_link_desc}
              img="/assets/dernière_section_accueil/experts.jpg"
              accentColor="var(--navy)"
              cta={td.superadmin_link_cta.replace(' →', '')}
              corner
            />
          </div>
        </section>

        {/* ── Section 1 : KPIs globaux ── */}
        <section>
          <div className="container" style={{ padding: '48px 32px' }}>
            <div className="portal-section-head">
              <p className="portal-section-eyebrow">{t.eyebrow_group_kpis}</p>
              <h2 className="portal-section-title">{t.title_group_dashboard}</h2>
            </div>
            <div className="portal-kpi-row">
              <div className="portal-kpi-card">
                <div className="portal-kpi-value">{globalKpis.totalApprenants.toLocaleString('fr')}</div>
                <div className="portal-kpi-label">{t.kpi_active_learners}</div>
              </div>
              <div className="portal-kpi-card">
                <div className={`portal-kpi-value ${globalKpis.tauxCertification >= 50 ? 'green' : 'accent'}`}>
                  {globalKpis.tauxCertification}%
                </div>
                <div className="portal-kpi-label">{t.kpi_cert_rate}</div>
              </div>
              <div className="portal-kpi-card">
                <div className="portal-kpi-value accent">{globalKpis.sessionsActives}</div>
                <div className="portal-kpi-label">{t.kpi_active_sessions}</div>
              </div>
              <div className="portal-kpi-card">
                <div className="portal-kpi-value">{globalKpis.filialesActives}</div>
                <div className="portal-kpi-label">{t.kpi_active_branches}</div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 2 : Progression par filiale ── */}
        <section>
          <div className="container" style={{ padding: '48px 32px' }}>
            <div className="portal-section-head">
              <p className="portal-section-eyebrow">{t.eyebrow_group_scope}</p>
              <h2 className="portal-section-title">{t.title_branch_progress}</h2>
            </div>
            <div className="portal-table-wrap">
              <table className="portal-table">
                <thead>
                  <tr>
                    <th>{t.th_branch}</th>
                    <th>{t.th_learners}</th>
                    <th>{t.th_cert_rate}</th>
                    <th>{t.th_progress}</th>
                  </tr>
                </thead>
                <tbody>
                  {filialesStats.map(f => (
                    <tr key={f.filiale}>
                      <td style={{ fontWeight: 600 }}>{f.filiale}</td>
                      <td>{f.apprenants.toLocaleString('fr')}</td>
                      <td>
                        <span className={`portal-status-chip ${f.pct >= 50 ? 'done' : 'progress'}`}>
                          {f.pct}%
                        </span>
                      </td>
                      <td>
                        <div className="portal-inline-bar">
                          <div className="portal-inline-track" style={{ width: 120 }}>
                            <div
                              className="portal-inline-fill"
                              style={{
                                width: `${f.pct}%`,
                                background: f.pct >= 50 ? '#1aab5b' : undefined,
                              }}
                            />
                          </div>
                          <span className="portal-inline-pct">{f.pct}%</span>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        {/* ── Section 3 : Activité récente ── */}
        <section>
          <div className="container" style={{ padding: '48px 32px' }}>
            <div className="portal-section-head">
              <p className="portal-section-eyebrow">{t.eyebrow_audit}</p>
              <h2 className="portal-section-title">{t.title_recent_activity}</h2>
            </div>
            <div className="portal-log-list">
              {recentLogs.map((log, i) => (
                <div key={i} className="portal-log-item">
                  <span className="portal-log-time">{log.time}</span>
                  <span className="portal-log-text">{log.text}</span>
                </div>
              ))}
            </div>
          </div>
        </section>
      </main>
      <Footer />
      <PortalDemoBar />
    </>
  )
}
