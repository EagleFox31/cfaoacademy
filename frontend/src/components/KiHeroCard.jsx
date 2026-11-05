import useLocale from '../hooks/useLocale'
import FadStatusBadge from './FadStatusBadge.jsx'
import { buildKiHeroModel } from '../utils/kiHeroModel.js'
import {
  formatKiSessionDisplayTitle,
  isKiSessionDatePending,
} from '../utils/kiSessionTitle.js'

function fadStatusLabel(statut, t) {
  return statut === 'planifie' ? t.fad_planned : t.fad_pending
}

const META_ICONS = {
  calendar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  ),
  pin: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11z" />
      <circle cx="12" cy="10" r="2.5" />
    </svg>
  ),
  users: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <path d="M22 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
}

function MetaRow({ icon, children }) {
  return (
    <li className="ki-up-next-meta-row">
      <span className="ki-up-next-meta-icon">{META_ICONS[icon]}</span>
      <span>{children}</span>
    </li>
  )
}

/** Widget hero « Prochaine session » — une action claire, le reste en lien secondaire. */
export default function KiHeroCard({ model, user, lms }) {
  const { t } = useLocale('portal')
  const hero = model ?? buildKiHeroModel(user, lms)
  const { brandLabel, upcomingSessions } = hero
  const next = upcomingSessions[0]
  const moreCount = Math.max(0, upcomingSessions.length - 1)

  if (!next) {
    return (
      <aside className="portal-header-ki-card portal-header-ki-card--up-next portal-header-ki-card--empty" aria-label={t.ki_hero_card_label}>
        <p className="ki-up-next-eyebrow">{t.ki_hero_up_next}</p>
        <div className="ki-up-next-empty">
          <p>{t.ki_hero_no_session}</p>
          <a href="#fad" className="ki-up-next-cta ki-up-next-cta--ghost">{t.ki_hero_plan_session}</a>
        </div>
      </aside>
    )
  }

  const title = formatKiSessionDisplayTitle(next, brandLabel)
  const datePending = isKiSessionDatePending(next)
  const participantLabel = next.apprenants > 1
    ? t.ki_session_participants_pl
    : t.ki_session_participants
  const moreLabel = moreCount === 1
    ? t.ki_hero_more_sessions_one.replace('{count}', String(moreCount))
    : t.ki_hero_more_sessions.replace('{count}', String(moreCount))

  return (
    <aside className="portal-header-ki-card portal-header-ki-card--up-next" aria-label={t.ki_hero_card_label}>
      <p className="ki-up-next-eyebrow">{t.ki_hero_up_next}</p>

      <a href="#fad" className="ki-up-next-feature">
        <div className="ki-up-next-head">
          <h3 className="ki-up-next-title">{title}</h3>
          <FadStatusBadge
            statut={next.statut}
            label={fadStatusLabel(next.statut, t)}
            chip
          />
        </div>
        <ul className="ki-up-next-meta">
          <MetaRow icon="calendar">
            {datePending ? t.ki_hero_date_pending : next.date}
          </MetaRow>
          {next.lieu && (
            <MetaRow icon="pin">{next.lieu}</MetaRow>
          )}
          <MetaRow icon="users">
            {next.apprenants} {participantLabel}
          </MetaRow>
        </ul>
      </a>

      <div className="ki-up-next-foot">
        <a href="#fad" className="ki-up-next-cta">
          {t.ki_hero_prepare}
          <span className="ki-up-next-cta-arrow" aria-hidden="true">→</span>
        </a>
        {moreCount > 0 && (
          <a href="#fad" className="ki-up-next-more">{moreLabel}</a>
        )}
      </div>
    </aside>
  )
}
