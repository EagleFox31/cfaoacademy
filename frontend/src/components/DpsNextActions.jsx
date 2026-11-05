import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import PortalReveal from './PortalReveal.jsx'
import PlanEntryCard from './PlanEntryCard.jsx'
import PvCard from './PvCard.jsx'
import PortalBrandLogo from './PortalBrandLogo.jsx'
import TechnicianMediaIcon from './TechnicianMediaIcon.jsx'
import useLocale from '../hooks/useLocale'
import { resolveMedacapDefineLaunchUrl, resolveDpsNextActions } from '../utils/dpsMetrics.js'

function DpsAlertCard({ alert, t }) {
  return (
    <PvCard
      className="portal-team-member-card portal-team-member-card--alert"
      cardMedia={<TechnicianMediaIcon alert />}
      kicker={(
        <span className="pv-card-kicker-row">
          {alert.brand ? <PortalBrandLogo brand={alert.brand} size="chip" /> : null}
          <span className="portal-status-chip todo">{t.alert_inactive}</span>
        </span>
      )}
      title={alert.label}
      meta={(
        <div className="portal-eval-card-meta">
          <div className="portal-eval-meta-row portal-eval-meta-row--sub">
            <span className="portal-eval-meta-val">{alert.text}</span>
          </div>
        </div>
      )}
      cta={t.dps_alert_cta}
      accentColor="var(--red)"
      hoverHint={t.card_view_detail}
      corner
    />
  )
}

export default function DpsNextActions({ lms, user }) {
  const { t } = useLocale('portal')
  const actions = resolveDpsNextActions(lms)
  const defineLaunchUrl = resolveMedacapDefineLaunchUrl(user, { view: 'pluri' })

  if (!actions.length) return null

  return (
    <PortalReveal id="priorites">
      <div className="container" style={{ padding: '16px 32px' }}>
        <div className="portal-section-head">
          <PortalSectionEyebrow icon="listtodo" label={t.eyebrow_next_actions} />
          <h2 className="portal-section-title">{t.title_next_actions}</h2>
        </div>
        <div className="pv-grid cols-4 pv-grid--stretch">
          {actions.map(item => (
            <div key={item.id} className="portal-card-anchor">
              {item.kind === 'define' ? (
                <PlanEntryCard
                  href={defineLaunchUrl}
                  kind="results"
                  title={t.dps_medacap_title}
                  desc={t.dps_medacap_desc}
                  cta={t.dps_medacap_cta}
                  accentColor="var(--navy)"
                  hoverHint={t.dps_medacap_cta}
                />
              ) : (
                <DpsAlertCard alert={item.data} t={t} />
              )}
            </div>
          ))}
        </div>
      </div>
    </PortalReveal>
  )
}
