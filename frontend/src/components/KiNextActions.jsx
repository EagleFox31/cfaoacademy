import PvCard from './PvCard.jsx'
import FadStatusBadge from './FadStatusBadge.jsx'
import useLocale from '../hooks/useLocale'

export function resolveKiNextActions(lms) {
  const fad = lms?.formationsADispenser?.find(f => f.statut === 'planifie')
  if (!fad) return []
  return [{ id: `ki-next-fad-${fad.id}`, kind: 'fad', data: fad }]
}

function FadNextCard({ fad, t }) {
  const learnerLabel = fad.apprenants > 1 ? t.ki_learners_pl : t.ki_learners

  return (
    <PvCard
      kicker={<FadStatusBadge statut="planifie" label={t.fad_planned} chip />}
      title={fad.title}
      meta={`${fad.apprenants} ${learnerLabel} · ${fad.date}`}
      cta={t.ki_next_fad_cta}
      accentColor="#c05600"
      hoverHint={t.plan_entry_coming_soon}
      corner
    />
  )
}

export default function KiNextActions({ lms }) {
  const { t } = useLocale('portal')
  const actions = resolveKiNextActions(lms)

  if (!actions.length) return null

  return (
    <div className="portal-ki-next-actions">
      <div className="portal-section-head portal-section-head--compact">
        <p className="portal-section-eyebrow">{t.eyebrow_next_actions}</p>
        <h2 className="portal-section-title portal-section-title--sm">{t.ki_next_fad_title}</h2>
      </div>
      <div className="pv-grid cols-4 pv-grid--stretch">
        {actions.map(item => (
          <div key={item.id} className="portal-card-anchor">
            <FadNextCard fad={item.data} t={t} />
          </div>
        ))}
      </div>
    </div>
  )
}
