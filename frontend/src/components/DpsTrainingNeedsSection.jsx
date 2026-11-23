import { useEffect, useState } from 'react'
import PortalSectionEyebrow from './PortalSectionEyebrow.jsx'
import PortalSectionHead from './PortalSectionHead.jsx'
import PortalReveal from './PortalReveal.jsx'
import PvCard from './PvCard.jsx'
import useLocale from '../hooks/useLocale'
import { needsApi } from '../lib/needsApi.js'
import { baseBesoins } from '../utils/urlBesoins.js'

const MAX_CAMPAIGNS = 3

/** Statut cfao-needs → libellé et pastille. Inconnu : pastille neutre « — ». */
const STATUS = {
  DRAFT: { key: 'dps_needs_status_draft', chip: 'todo' },
  OPEN: { key: 'dps_needs_status_open', chip: 'alert' },
  CLOSED: { key: 'dps_needs_status_closed', chip: 'done' },
  ARBITRATED: { key: 'dps_needs_status_arbitrated', chip: 'done' },
  ARCHIVED: { key: 'dps_needs_status_archived', chip: 'done' },
}

/** Visuel selon l'exercice : à venir, en cours, passé. */
const PERIOD = {
  future: { chip: 'portal-campaign-year-chip--future', img: '/assets/formation_motorisation_centre_formation.jpg', accent: '#1a56db' },
  current: { chip: 'portal-campaign-year-chip--current', img: '/assets/technicien_multibrand.jpg', accent: '#1aab5b' },
  past: { chip: 'portal-campaign-year-chip--past', img: '/assets/technicien_equipment.jpg', accent: '#64748b' },
}

function periodOf(year, now = new Date()) {
  const current = now.getFullYear()
  if (year > current) return PERIOD.future
  if (year === current) return PERIOD.current
  return PERIOD.past
}

function formatDeadline(value, locale) {
  if (!value) return '—'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return '—'
  return date.toLocaleDateString(locale, { day: 'numeric', month: 'long', year: 'numeric' })
}

/** Réponse paginée ou liste brute → campagnes valides, la plus récente d'abord. */
export function pickCampaigns(payload) {
  const rows = Array.isArray(payload) ? payload : (payload?.results ?? [])
  return rows
    .filter(c => Number.isFinite(c?.year))
    .sort((a, b) => b.year - a.year)
    .slice(0, MAX_CAMPAIGNS)
}

export default function DpsTrainingNeedsSection({
  t,
  sectionId = 'besoins-formation',
  updatedAt,
}) {
  const { locale } = useLocale('portal')
  const [state, setState] = useState({ status: 'loading', campaigns: [] })

  useEffect(() => {
    let cancelled = false
    needsApi.campaigns()
      .then(payload => {
        if (!cancelled) setState({ status: 'ready', campaigns: pickCampaigns(payload) })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', campaigns: [] })
      })
    return () => { cancelled = true }
  }, [])

  const needsUrl = baseBesoins()
  const message = state.status === 'error'
    ? t.dps_needs_unavailable
    : state.status === 'ready' && !state.campaigns.length
      ? t.dps_needs_empty
      : null

  return (
    <PortalReveal as="section" id={sectionId} className="portal-dps-training-needs-section">
      <div className="container" style={{ padding: '16px 32px' }}>
        <PortalSectionHead
          eyebrow={<PortalSectionEyebrow icon="clipboard" label="MESURE DES BESOINS EN FORMATION" />}
          title="Identification Annuelle des besoins en formations de votre filiale"
          updatedAt={updatedAt}
          updating={state.status === 'loading'}
          t={t}
        />

        {message ? (
          <div className="portal-plan-filter-empty" role="status">{message}</div>
        ) : (
          <div className="pv-grid cols-3 pv-grid--stretch">
            {state.campaigns.map(item => {
              const period = periodOf(item.year)
              const status = STATUS[item.status]
              const open = item.status === 'OPEN' && needsUrl
              return (
                <PvCard
                  key={item.id ?? item.year}
                  className={`portal-campaign-card portal-campaign-card--${item.year}`}
                  img={period.img}
                  accentColor={period.accent}
                  kicker={(
                    <span className="pv-card-kicker-row">
                      <span className={`portal-status-chip ${status?.chip ?? 'todo'}`}>
                        {status ? t[status.key] : '—'}
                      </span>
                      <span className={`portal-campaign-year-chip ${period.chip}`}>
                        {item.year}
                      </span>
                    </span>
                  )}
                  title={t.dps_needs_card_title}
                  meta={(
                    <div className="portal-team-member-subcards">
                      <div className="portal-team-member-subcards-row">
                        <div className="portal-team-member-subcard">
                          <span className="portal-team-member-subcard-lbl">{t.dps_needs_meta_campaign}</span>
                          <span className="portal-team-member-subcard-val">
                            {t.dps_needs_meta_campaign_value.replace('{year}', item.year)}
                          </span>
                        </div>
                        <div className="portal-team-member-subcard">
                          <span className="portal-team-member-subcard-lbl">{t.dps_needs_meta_deadline}</span>
                          <span className="portal-team-member-subcard-val">
                            {formatDeadline(item.closes_at, locale)}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                  {...(open
                    ? { cta: t.dps_needs_cta, onClick: () => window.location.assign(needsUrl), corner: true }
                    : {})}
                />
              )
            })}
          </div>
        )}
      </div>
    </PortalReveal>
  )
}
