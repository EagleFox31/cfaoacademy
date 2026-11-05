import { useMemo, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import PortalLayout from '../../components/PortalLayout.jsx'
import PortalReveal from '../../components/PortalReveal.jsx'
import PortalSectionEyebrow from '../../components/PortalSectionEyebrow.jsx'
import PortalSectionHead from '../../components/PortalSectionHead.jsx'
import PortalStaggerGrid from '../../components/PortalStaggerGrid.jsx'
import PlanEntryCard from '../../components/PlanEntryCard.jsx'
import PortalModal from '../../components/PortalModal.jsx'
import useAuth from '../../hooks/useAuth'
import useLocale from '../../hooks/useLocale'
import {
  MEDACAP_PROFILE_CONFIG,
  MEDACAP_STAGES,
  MEDACAP_STAGE_ORDER,
  describeProfile,
} from '../../config/medacapMatrix.js'
import {
  BUILD_STATUS,
  DEFAULT_BUILD_STATE,
  PRIORITY_ORDER,
  buildStateKey,
  loadBuildState,
  saveBuildState,
} from '../../config/profileBuildStatus.js'

/**
 * Super Admin — Portail Builder.
 * Tout en cartes homogènes DPS. Aucun tableau.
 */
export default function SuperAdminBuilderDashboard() {
  const { user } = useAuth()
  const { t } = useLocale('portal')
  const navigate = useNavigate()
  const [state, setState] = useState(() => loadBuildState())
  const [selectedProfile, setSelectedProfile] = useState('learner')
  const [editSection, setEditSection] = useState(null) // { key, section }

  const profiles = useMemo(
    () => Object.keys(MEDACAP_PROFILE_CONFIG).map(describeProfile).filter(Boolean),
    []
  )
  const summary = useMemo(() => summarize(state, profiles), [state, profiles])

  const updateEntry = useCallback((key, patch) => {
    setState(prev => {
      const next = { ...prev, [key]: { ...prev[key], ...patch } }
      saveBuildState(next)
      return next
    })
  }, [])

  const resetToDefault = useCallback(() => {
    setState(DEFAULT_BUILD_STATE)
    saveBuildState(DEFAULT_BUILD_STATE)
  }, [])

  if (!user) return null

  const selectedDescription = describeProfile(selectedProfile)

  return (
    <PortalLayout user={user} showStickyBar={false}>
      {/* ─── Bloc 1 : KPIs globaux en grille PlanEntryCard ─── */}
      <PortalReveal>
        <div className="container" style={{ padding: '16px 32px' }}>
          <PortalSectionHead
            eyebrow={<PortalSectionEyebrow icon="cog" label={t.builder_eyebrow} />}
            title={t.builder_title}
            lead={t.builder_lead}
            methodText={t.builder_method ?? t.builder_lead}
            t={t}
          />
          <PortalStaggerGrid className="cols-4 pv-grid--stretch">
            <PlanEntryCard
              kind="results"
              title={String(summary.totalSections)}
              meta={<div className="portal-plan-entry-meta"><p>{t.builder_kpi_sections}</p></div>}
              accentColor="#1a56db"
              corner={false}
            />
            <PlanEntryCard
              kind="results"
              title={String(summary.liveCount)}
              statusChip={<span className="portal-status-chip done">live</span>}
              meta={<div className="portal-plan-entry-meta"><p>{t.builder_kpi_live}</p></div>}
              accentColor="#1aab5b"
              corner={false}
            />
            <PlanEntryCard
              kind="results"
              title={String(summary.readyCount)}
              statusChip={<span className="portal-status-chip progress">ready</span>}
              meta={<div className="portal-plan-entry-meta"><p>{t.builder_kpi_ready}</p></div>}
              accentColor="#e67e00"
              corner={false}
            />
            <PlanEntryCard
              kind="results"
              title={String(summary.p0Pending)}
              statusChip={<span className="portal-status-chip accent">P0</span>}
              meta={<div className="portal-plan-entry-meta"><p>{t.builder_kpi_p0_pending}</p></div>}
              accentColor="#e11d48"
              corner={false}
            />
          </PortalStaggerGrid>
        </div>
      </PortalReveal>

      {/* ─── Bloc 2 : Profils (cartes cliquables) ─── */}
      <PortalReveal>
        <div className="container" style={{ padding: '16px 32px' }}>
          <PortalSectionHead
            eyebrow={<PortalSectionEyebrow icon="users" label={t.builder_profiles_eyebrow} />}
            title={t.builder_profiles_title}
            t={t}
          />
          <PortalStaggerGrid className="cols-3 pv-grid--stretch">
            {profiles.map(p => {
              const stats = summary.byProfile[p.profileKey]
              const isActive = selectedProfile === p.profileKey
              return (
                <PlanEntryCard
                  key={p.profileKey}
                  kind="learners"
                  title={t[`role_${p.profileKey}`] ?? p.profileKey}
                  brandLabel={p.scope.key.toUpperCase()}
                  statusChip={
                    stats.live + stats.ready === p.sections.length
                      ? <span className="portal-status-chip done">complet</span>
                      : stats.live === 0
                        ? <span className="portal-status-chip accent">à démarrer</span>
                        : <span className="portal-status-chip progress">en cours</span>
                  }
                  meta={(
                    <div className="portal-plan-entry-meta">
                      <StageStripe stagesCovered={p.stagesCovered} />
                      <p style={{ marginTop: 8, fontSize: 12 }}>
                        <strong style={{ color: '#1aab5b' }}>{stats.live} live</strong>
                        {' · '}
                        <strong style={{ color: '#e67e00' }}>{stats.ready} ready</strong>
                        {' · '}
                        <span style={{ color: '#1a56db' }}>{stats.draft} draft</span>
                        {' · '}
                        <span style={{ opacity: 0.6 }}>{stats.idea} idea</span>
                      </p>
                      {p.extendsProfile && (
                        <p style={{ marginTop: 4, fontSize: 11, opacity: 0.7 }}>
                          ↳ hérite <strong>{p.extendsProfile}</strong>
                        </p>
                      )}
                    </div>
                  )}
                  cta={isActive ? t.builder_view_sections ?? 'Voir sections' : t.builder_select ?? 'Sélectionner'}
                  hoverHint={isActive ? undefined : t.builder_select ?? 'Sélectionner'}
                  onOpen={() => setSelectedProfile(p.profileKey)}
                  className={isActive ? 'is-selected' : ''}
                  accentColor={isActive ? '#1a56db' : '#64748b'}
                  corner
                />
              )
            })}
          </PortalStaggerGrid>
        </div>
      </PortalReveal>

      {/* ─── Bloc 3 : Sections du profil sélectionné (cartes) ─── */}
      <PortalReveal>
        <div className="container" style={{ padding: '16px 32px' }}>
          <PortalSectionHead
            eyebrow={<PortalSectionEyebrow icon="clipboard" label={t.builder_sections_eyebrow} />}
            title={`${t[`role_${selectedProfile}`] ?? selectedProfile}`}
            t={t}
          />

          <div className="portal-toolbar">
            <button
              type="button"
              className="portal-btn portal-btn-primary"
              onClick={() => navigate(`/portail/preview/${selectedProfile}`)}
            >
              {t.builder_preview_dashboard} →
            </button>
            <button
              type="button"
              className="portal-btn portal-btn-ghost"
              onClick={resetToDefault}
            >
              {t.builder_reset_default}
            </button>
          </div>

          <PortalStaggerGrid className="cols-3 pv-grid--stretch">
            {selectedDescription?.sections.map(section => {
              const key = buildStateKey(selectedProfile, section.id)
              const entry = state[key] ?? { status: 'idea', priority: 'P2' }
              const stage = MEDACAP_STAGES[section.stage]
              return (
                <PlanEntryCard
                  key={section.id}
                  kind={sectionKind(section.stage)}
                  title={section.id}
                  brandLabel={stage ? stage.key : '—'}
                  statusChip={
                    <span className={`portal-status-chip ${statusTone(entry.status)}`}>
                      {entry.status.toUpperCase()}
                    </span>
                  }
                  meta={(
                    <div className="portal-plan-entry-meta">
                      <p>
                        <strong>{entry.priority}</strong>
                        {stage ? ` · ${t[stage.labelKey] ?? stage.verb}` : ''}
                        {' · '}
                        <span style={{ opacity: 0.7 }}>{section.permission}</span>
                      </p>
                      {entry.notes && (
                        <p style={{ marginTop: 4, fontSize: 12, opacity: 0.8 }}>
                          {entry.notes}
                        </p>
                      )}
                    </div>
                  )}
                  cta={t.builder_edit ?? 'Éditer'}
                  hoverHint={t.builder_edit ?? 'Éditer'}
                  onOpen={() => setEditSection({ key, section, entry })}
                  accentColor={statusAccent(entry.status)}
                  corner
                />
              )
            })}
          </PortalStaggerGrid>
        </div>
      </PortalReveal>

      {/* ─── Bloc 4 : Backlog priorité (cartes) ─── */}
      <PortalReveal>
        <div className="container" style={{ padding: '16px 32px 48px' }}>
          <PortalSectionHead
            eyebrow={<PortalSectionEyebrow icon="alert" label={t.builder_priorities_eyebrow} />}
            title={t.builder_priorities_title}
            t={t}
          />
          <PortalStaggerGrid className="cols-3 pv-grid--stretch">
            {summary.backlog.slice(0, 9).map(item => (
              <PlanEntryCard
                key={item.key}
                kind="pif"
                title={item.sectionId}
                brandLabel={item.priority}
                statusChip={
                  <span className={`portal-status-chip ${statusTone(item.status)}`}>
                    {item.status.toUpperCase()}
                  </span>
                }
                meta={(
                  <div className="portal-plan-entry-meta">
                    <p><strong>{t[`role_${item.profileKey}`] ?? item.profileKey}</strong></p>
                    {item.notes && (
                      <p style={{ marginTop: 4, fontSize: 12, opacity: 0.75 }}>{item.notes}</p>
                    )}
                  </div>
                )}
                accentColor={priorityAccent(item.priority)}
                onOpen={() => {
                  setSelectedProfile(item.profileKey)
                  setEditSection({
                    key: item.key,
                    section: { id: item.sectionId },
                    entry: state[item.key] ?? {},
                  })
                }}
                cta={t.builder_open ?? 'Ouvrir'}
                hoverHint={t.builder_open ?? 'Ouvrir'}
                corner
              />
            ))}
          </PortalStaggerGrid>
        </div>
      </PortalReveal>

      {editSection && (
        <SectionEditModal
          data={editSection}
          state={state}
          t={t}
          onClose={() => setEditSection(null)}
          onSave={patch => {
            updateEntry(editSection.key, patch)
            setEditSection(null)
          }}
        />
      )}
    </PortalLayout>
  )
}

function SectionEditModal({ data, state, t, onClose, onSave }) {
  const current = state[data.key] ?? { status: 'idea', priority: 'P2', notes: '' }
  const [form, setForm] = useState(current)
  return (
    <PortalModal title={data.section.id} onClose={onClose}>
      <div className="portal-form-grid">
        <label>
          <span>{t.builder_col_status}</span>
          <select
            value={form.status}
            onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
          >
            {Object.values(BUILD_STATUS).map(s => (
              <option key={s.key} value={s.key}>{s.key}</option>
            ))}
          </select>
        </label>
        <label>
          <span>{t.builder_col_priority}</span>
          <select
            value={form.priority}
            onChange={e => setForm(f => ({ ...f, priority: e.target.value }))}
          >
            <option value="P0">P0</option>
            <option value="P1">P1</option>
            <option value="P2">P2</option>
            <option value="P3">P3</option>
          </select>
        </label>
      </div>
      <label className="portal-modal-label" htmlFor="notes-txt" style={{ marginTop: 12 }}>
        {t.builder_col_notes}
      </label>
      <textarea
        id="notes-txt"
        className="portal-modal-textarea"
        rows={3}
        value={form.notes ?? ''}
        onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
        placeholder={t.builder_notes_placeholder}
      />
      <div className="portal-modal-actions">
        <button type="button" className="portal-btn portal-btn-ghost" onClick={onClose}>
          {t.cancel ?? 'Annuler'}
        </button>
        <button
          type="button"
          className="portal-btn portal-btn-primary"
          onClick={() => onSave(form)}
        >
          {t.save ?? 'Enregistrer'}
        </button>
      </div>
    </PortalModal>
  )
}

function StageStripe({ stagesCovered }) {
  return (
    <div className="builder-stage-stripe" aria-label="Étapes MEDACAP couvertes">
      {MEDACAP_STAGE_ORDER.map(k => {
        const covered = stagesCovered.includes(k)
        return (
          <span
            key={k}
            className={`builder-stage-dot ${covered ? 'is-covered' : ''}`}
            title={`${k} — ${MEDACAP_STAGES[k]?.verb ?? ''}`}
          >
            {k[0]}
          </span>
        )
      })}
    </div>
  )
}

function summarize(state, profiles) {
  const byProfile = {}
  const backlog = []
  let totalSections = 0
  let liveCount = 0
  let readyCount = 0
  let p0Pending = 0

  for (const p of profiles) {
    const stats = { live: 0, ready: 0, draft: 0, idea: 0 }
    for (const section of p.sections) {
      totalSections++
      const key = buildStateKey(p.profileKey, section.id)
      const entry = state[key] ?? { status: 'idea', priority: 'P2' }
      stats[entry.status] = (stats[entry.status] ?? 0) + 1
      if (entry.status === 'live') liveCount++
      if (entry.status === 'ready') readyCount++
      if (entry.priority === 'P0' && entry.status !== 'live') p0Pending++
      if (entry.status !== 'live') {
        backlog.push({
          key, profileKey: p.profileKey, sectionId: section.id,
          status: entry.status, priority: entry.priority,
          notes: entry.notes ?? '',
        })
      }
    }
    byProfile[p.profileKey] = stats
  }
  backlog.sort((a, b) => {
    const pa = PRIORITY_ORDER[a.priority] ?? 9
    const pb = PRIORITY_ORDER[b.priority] ?? 9
    if (pa !== pb) return pa - pb
    return (BUILD_STATUS[a.status.toUpperCase()]?.order ?? 0) -
           (BUILD_STATUS[b.status.toUpperCase()]?.order ?? 0)
  })
  return { totalSections, liveCount, readyCount, p0Pending, byProfile, backlog }
}

function statusTone(s) {
  if (s === 'live') return 'done'
  if (s === 'ready') return 'accent'
  if (s === 'draft') return 'progress'
  return 'muted'
}
function statusAccent(s) {
  if (s === 'live') return '#1aab5b'
  if (s === 'ready') return '#e67e00'
  if (s === 'draft') return '#1a56db'
  return '#94a3b8'
}
function priorityAccent(p) {
  if (p === 'P0') return '#e11d48'
  if (p === 'P1') return '#e67e00'
  if (p === 'P2') return '#1a56db'
  return '#94a3b8'
}
function sectionKind(stage) {
  if (stage === 'M' || stage === 'E') return 'results'
  if (stage === 'D') return 'pif'
  if (stage === 'A1' || stage === 'A2') return 'sessions'
  if (stage === 'C') return 'results'
  if (stage === 'P') return 'results'
  return 'learners'
}
