import { Link, Navigate } from 'react-router-dom'
import Nav from '../../components/Nav.jsx'
import Footer from '../../components/Footer.jsx'
import PortalDemoBar from '../../components/PortalDemoBar.jsx'
import useSiteEffects from '../../hooks/useSiteEffects.js'
import useAuth from '../../hooks/useAuth.js'
import usePortalBackground from '../../hooks/usePortalBackground.js'
import HelpCenterPanel from '../components/HelpCenterPanel.jsx'
import { useHelpCopy } from '../hooks/useHelpCopy.js'

export default function HelpCenterPreview() {
  useSiteEffects()
  const { user, status } = useAuth()
  usePortalBackground(user)
  const copy = useHelpCopy()

  if (status === "loading") return null
  if (!user) return <Navigate to="/login" replace />

  return (
    <>
      <Nav />
      <main className="portal-page help-center-page">
        <section className="page-header help-center-page-header">
          <div className="container help-center-page-header-inner">
            <span className="help-preview-badge">{copy.preview_badge}</span>
            <h1 className="portal-section-title">{copy.center_title}</h1>
            <p className="help-center-page-note">{copy.preview_note}</p>
            <Link to="/portail" className="help-center-page-back">
              ← {copy.action_back_portal}
            </Link>
          </div>
        </section>
        <section className="help-center-page-body">
          <div className="container help-center-page-layout">
            <HelpCenterPanel mode="page" />
          </div>
        </section>
      </main>
      <PortalDemoBar />
      <Footer />
    </>
  )
}
