import { useMemo, useState } from 'react'
import PortalReveal from '../PortalReveal.jsx'
import PortalSectionEyebrow from '../PortalSectionEyebrow.jsx'
import PortalSectionHead from '../PortalSectionHead.jsx'
import PortalStaggerGrid from '../PortalStaggerGrid.jsx'
import PlanEntryCard from '../PlanEntryCard.jsx'
import PortalModal from '../PortalModal.jsx'

/**
 * Timeline PIF pluri-annuelle — lego réutilisable par Learner / Manager / DPS / RH.
 *
 * Aligné sur le pattern DPS (DpsFilialePifSection) :
 *   PortalSectionHead + PortalStaggerGrid + PlanEntryCard (une carte par entrée).
 *   Sélecteur d'année en cartes également (PvCard-like, pas de tabs custom).
 *
 * Props inchangés côté API — le renderer paramétré n'a rien à modifier.
 */
export default function PifTimelinePluriannuel({
  years,
  entries = [],
  validation = { by: null, states: {} },
  permission = 'read',
  onValidateYear,
  t,
  updatedAt,
  updating = false,
  methodText,
  sectionId = 'pif-timeline',
  title,
  eyebrow,
}) {
  const [activeYear, setActiveYear] = useState(years?.[0] ?? new Date().getFullYear())
  const [reasonOpen, setReasonOpen] = useState(null)

  const entriesByYear = useMemo(() => {
    const map = new Map(years.map(y => [y, []]))
    for (const e of entries) if (map.has(e.year)) map.get(e.year).push(e)
    return map
  }, [entries, years])

  const currentEntries = entriesByYear.get(activeYear) ?? []
  const canWrite = permission === 'write' || permission === 'admin'

  const yearStats = year => {
    const list = entriesByYear.get(year) ?? []
    const done = list.filter(e => e.status === 'done').length
    return { total: list.length, done }
  }
  const yearValidation = year => validation.states?.[year] ?? 'pending'

  function handleValidate(year) { onValidateYear?.(year, 'validate') }
  function handleOpenRefuse(year) { setReasonOpen({ year }) }
  function handleConfirmRefuse(reason) {
    if (!reasonOpen) return
    onValidateYear?.(reasonOpen.year, 'refuse', reason)
    setReasonOpen(null)
  }

  return (
    <PortalReveal id={sectionId}>
      <div className="container" style={{ padding: '16px 32px' }}>
        <PortalSectionHead
          eyebrow={<PortalSectionEyebrow icon="calendar" label={eyebrow ?? t.pif_timeline_eyebrow} />}
          title={title ?? t.pif_timeline_title}
          updatedAt={updatedAt}
          updating={updating}
          methodText={methodText ?? t.pif_timeline_method}
          t={t}
        />

        {/* Sélecteur année — 1 PlanEntryCard par année, avec badge validation */}
        <PortalStaggerGrid className="cols-4 pv-grid--stretch">
          {years.map(year => {
            const s = yearStats(year)
            const v = yearValidation(year)
            const isActive = year === activeYear
            const pct = s.total > 0 ? Math.round((s.done / s.total) * 100) : 0
            return (
              <PlanEntryCard
                key={year}
                kind="pif"
                onOpen={() => setActiveYear(year)}
                muted={!isActive}
                title={String(year)}
                className={isActive ? 'is-selected' : ''}
                statusChip={
                  <span className={`portal-status-chip ${validationTone(v)}`}>
                    {t[`pif_year_status_${v}`] ?? v}
                  </span>
                }
                meta={(
                  <div className="portal-plan-entry-meta">
                    <p>
                      <strong>{s.done}/{s.total}</strong> · {pct}%
                    </p>
                  </div>
                )}
                cta={isActive ? t.card_view_detail : t.card_view_detail}
                accentColor={validationAccent(v)}
                hoverHint={isActive ? undefined : t.card_view_detail}
                corner
              />
            )
          })}
        </PortalStaggerGrid>

        {/* Barre d'action année active — visible seulement si write/admin */}
        {canWrite && (
          <div className="pif-action-bar" role="region" aria-label={t.pif_action_bar_aria ?? 'Actions PIF'}>
            <div className="pif-action-bar-info">
              <strong>{activeYear}</strong> · {t.pif_timeline_validator_by?.replace(
                '{by}',
                t[`pif_validator_${validation.by ?? 'manager'}`] ?? '—'
              )}
            </div>
            <div className="pif-action-bar-btns">
              {yearValidation(activeYear) === 'pending' && (
                <>
                  <button
                    type="button"
                    className="portal-btn portal-btn-primary"
                    onClick={() => handleValidate(activeYear)}
                  >
                    {t.pif_action_validate_year?.replace('{year}', activeYear)}
                  </button>
                  <button
                    type="button"
                    className="portal-btn portal-btn-ghost"
                    onClick={() => handleOpenRefuse(activeYear)}
                  >
                    {t.pif_action_refuse_year}
                  </button>
                </>
              )}
              {yearValidation(activeYear) === 'validated' && (
                <span className="portal-status-chip done">{t.pif_year_validated_lbl}</span>
              )}
              {yearValidation(activeYear) === 'refused' && (
                <span className="portal-status-chip accent">{t.pif_year_refused_lbl}</span>
              )}
            </div>
          </div>
        )}

        {/* Entrées de l'année active — 1 PlanEntryCard par formation */}
        {currentEntries.length === 0 ? (
          <div className="portal-empty-panel">
            {t.pif_timeline_year_empty?.replace('{year}', activeYear)}
          </div>
        ) : (
          <PortalStaggerGrid className="cols-3 pv-grid--stretch">
            {currentEntries.map(entry => (
              <PlanEntryCard
                key={entry.id}
                kind="pif"
                title={entry.title}
                brandLabel={entry.brand ?? undefined}
                statusChip={
                  <span className={`portal-status-chip ${entry.status}`}>
                    {t[`status_${entry.status}`] ?? entry.status}
                  </span>
                }
                meta={(
                  <div className="portal-plan-entry-meta">
                    <p>
                      {entry.modality && (t[`modality_${entry.modality}`] ?? entry.modality)}
                      {entry.level ? ` · ${entry.level}` : ''}
                    </p>
                    {entry.assignedBy && (
                      <p style={{ opacity: 0.7 }}>
                        {t.pif_assigned_by?.replace('{by}', entry.assignedBy)}
                      </p>
                    )}
                  </div>
                )}
                accentColor={entryAccent(entry.status)}
                corner={false}
                muted={entry.status === 'todo'}
              />
            ))}
          </PortalStaggerGrid>
        )}
      </div>

      {reasonOpen && (
        <PortalModal
          title={t.pif_refuse_modal_title?.replace('{year}', reasonOpen.year)}
          onClose={() => setReasonOpen(null)}
        >
          <RefuseReasonBody
            t={t}
            onCancel={() => setReasonOpen(null)}
            onConfirm={handleConfirmRefuse}
          />
        </PortalModal>
      )}
    </PortalReveal>
  )
}

function RefuseReasonBody({ t, onCancel, onConfirm }) {
  const [reason, setReason] = useState('')
  return (
    <>
      <label className="portal-modal-label" htmlFor="pif-refuse-reason">
        {t.pif_refuse_reason_label}
      </label>
      <textarea
        id="pif-refuse-reason"
        className="portal-modal-textarea"
        rows={4}
        value={reason}
        onChange={e => setReason(e.target.value)}
        placeholder={t.pif_refuse_reason_placeholder}
      />
      <div className="portal-modal-actions">
        <button type="button" className="portal-btn portal-btn-ghost" onClick={onCancel}>
          {t.cancel ?? 'Annuler'}
        </button>
        <button
          type="button"
          className="portal-btn portal-btn-primary"
          disabled={!reason.trim()}
          onClick={() => onConfirm(reason.trim())}
        >
          {t.pif_refuse_confirm ?? 'Confirmer'}
        </button>
      </div>
    </>
  )
}

function validationTone(v) {
  if (v === 'validated') return 'done'
  if (v === 'refused') return 'accent'
  return 'progress'
}
function validationAccent(v) {
  if (v === 'validated') return '#1aab5b'
  if (v === 'refused') return '#e11d48'
  return '#e67e00'
}
function entryAccent(status) {
  if (status === 'done') return '#1aab5b'
  if (status === 'progress') return '#1a56db'
  return '#94a3b8'
}
