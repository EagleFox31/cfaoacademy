import PvCard from './PvCard.jsx'
import PortalSessionCard from './PortalSessionCard.jsx'
import { portalPvCardMedia } from '../utils/portalCardMedia.js'
import { planningSessionAccent } from '../utils/learnerPlanning.js'
import { pifItemToSession } from '../utils/learnerPif.js'

function planStatusLabel(item, t) {
  const annual = item.annualStatus
  if (annual) return t[`annual_${annual}`] ?? annual
  if (item.status === 'done') return t.plan_chip_done
  if (item.status === 'progress') return t.plan_chip_progress
  if (item.status === 'scheduled') return t.plan_chip_enrolled
  return t.plan_chip_todo
}

export default function LearnerPifPlanCard({ item, t, showYear = false }) {
  const year = item.year ?? item.date?.slice(0, 4)
  const modalityKey = item.modality ?? 'presentiel'
  const modalityLabel = t[`modality_${modalityKey}`] ?? modalityKey

  if (modalityKey === 'presentiel') {
    return (
      <PortalSessionCard
        session={pifItemToSession(item)}
        annualStatus={item.annualStatus ?? item.status}
        t={t}
        planMode
        showSessionDate={Boolean(item.date)}
        accentColor={planningSessionAccent(item.annualStatus)}
        cta={t.card_view_formation_detail}
        hoverHint={t.card_view_detail}
      />
    )
  }

  const media = portalPvCardMedia({
    code: item.code,
    brand: item.brand,
    modality: modalityKey,
  })

  let meta = modalityLabel
  if (item.dateRange) meta = `${item.dateRange} · ${meta}`
  else if (showYear && year) meta = `${year} · ${meta}`
  if (item.assignedBy) meta = `${meta} · ${t.plan_assigned_by} ${item.assignedBy}`

  return (
    <PvCard
      {...media}
      kicker={(
        <span className={`portal-status-chip ${item.status ?? 'todo'}`}>
          {planStatusLabel(item, t)}
        </span>
      )}
      title={item.title ?? item.code}
      meta={meta}
      cta={t.card_view_formation_detail}
      accentColor={planningSessionAccent(item.annualStatus ?? item.status)}
      hoverHint={t.card_view_detail}
      corner
    />
  )
}
