import { Link, Navigate } from 'react-router-dom'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import PortalDemoBar from '../../components/PortalDemoBar'
import useSiteEffects from '../../hooks/useSiteEffects'
import useAuth from '../../hooks/useAuth'
import usePortalBackground from '../../hooks/usePortalBackground'
import useLocale from '../../hooks/useLocale'

const MOCK_TICKETS = [
  {
    id: 'tk-1042',
    ord: 'OR #CI-2847',
    subject: 'Diagnostic hybridation — voyant prêt bloqué',
    status: 'open',
    updated: '2 juin 2026',
  },
  {
    id: 'tk-0987',
    ord: 'OR #CI-2901',
    subject: 'Validation couple de serrage culasse',
    status: 'resolved',
    updated: '20 mars 2026',
  },
]

function ticketStatusLabel(status, t) {
  if (status === 'resolved') return t.assistance_ticket_resolved
  if (status === 'progress') return t.assistance_ticket_progress
  return t.assistance_ticket_open
}

function ticketStatusClass(status) {
  if (status === 'resolved') return 'done'
  if (status === 'progress') return 'progress'
  return 'todo'
}

export default function Assistance() {
  useSiteEffects()
  const { user } = useAuth()
  usePortalBackground(user)
  const { t } = useLocale('portal')

  if (!user) return <Navigate to="/login" replace />

  return (
    <>
      <Nav />
      <main className="portal-page portal-assistance-page">
        <section className="page-header portal-assistance-header">
          <div className="container" style={{ padding: '40px 32px 32px' }}>
            <Link to="/portail#assistance" className="portal-assistance-back">
              ← {t.nav_my_portal}
            </Link>
            <p className="portal-section-eyebrow">{t.assistance_page_eyebrow}</p>
            <h1 className="portal-section-title">{t.assistance_page_title}</h1>
            <p className="portal-assistance-lead">{t.assistance_page_lead}</p>
          </div>
        </section>

        <section>
          <div className="container" style={{ padding: '8px 32px 64px' }}>
            <div className="portal-assistance-toolbar">
              <h2 className="portal-assistance-list-title">{t.assistance_my_tickets}</h2>
              <button type="button" className="portal-assistance-new-btn">
                {t.assistance_new_ticket}
              </button>
            </div>

            <div className="portal-assistance-list">
              {MOCK_TICKETS.map(ticket => (
                <article key={ticket.id} className="portal-assistance-ticket">
                  <div className="portal-assistance-ticket-main">
                    <span className="portal-assistance-ticket-id">{ticket.id}</span>
                    <h3 className="portal-assistance-ticket-subject">{ticket.subject}</h3>
                    <p className="portal-assistance-ticket-meta">
                      {t.assistance_ticket_ord} {ticket.ord}
                      <span className="portal-assistance-ticket-meta-sep" aria-hidden="true"> · </span>
                      {t.assistance_ticket_updated} {ticket.updated}
                    </p>
                  </div>
                  <span className={`portal-status-chip ${ticketStatusClass(ticket.status)}`}>
                    {ticketStatusLabel(ticket.status, t)}
                  </span>
                </article>
              ))}
            </div>

            <p className="portal-assistance-app-note">{t.assistance_app_note}</p>
          </div>
        </section>
      </main>
      <Footer />
      <PortalDemoBar />
    </>
  )
}
