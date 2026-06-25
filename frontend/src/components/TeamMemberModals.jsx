import { useState } from 'react'
import PortalModal from './PortalModal.jsx'
import PlanEntryCard from './PlanEntryCard.jsx'
import { resolveEvalTitle } from '../utils/learnerTests.js'

const BRANDS = ['toyota', 'suzuki', 'mercedes', 'mitsubishi', 'fuso', 'hino']
const LEVELS = ['G4', 'G3', 'G2', 'G1']

export function TeamMemberManageModal({ member, allowedBrands, t, onClose, onSave }) {
  const [brand, setBrand] = useState(member.brand)
  const [certLevel, setCertLevel] = useState(member.certLevel ?? 'G4')
  const [targetLevel, setTargetLevel] = useState(member.targetLevel ?? 'G3')
  const brands = allowedBrands?.length ? allowedBrands : BRANDS

  return (
    <PortalModal title={`${t.tm_member_manage} — ${member.nom}`} onClose={onClose}>
      <p className="portal-modal-hint">{t.tm_manage_hint}</p>
      <div className="portal-modal-row portal-modal-row--field">
        <label className="portal-modal-label" htmlFor="tm-brand">{t.th_brand}</label>
        <select id="tm-brand" className="portal-modal-select" value={brand} onChange={e => setBrand(e.target.value)}>
          {brands.map(b => <option key={b} value={b}>{b}</option>)}
        </select>
      </div>
      <div className="portal-modal-row portal-modal-row--field">
        <label className="portal-modal-label" htmlFor="tm-level">{t.tm_manage_current_level}</label>
        <select id="tm-level" className="portal-modal-select" value={certLevel} onChange={e => setCertLevel(e.target.value)}>
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      <div className="portal-modal-row portal-modal-row--field">
        <label className="portal-modal-label" htmlFor="tm-target">{t.tm_manage_target_level}</label>
        <select id="tm-target" className="portal-modal-select" value={targetLevel} onChange={e => setTargetLevel(e.target.value)}>
          {LEVELS.map(l => <option key={l} value={l}>{l}</option>)}
        </select>
      </div>
      <div className="portal-modal-actions">
        <button type="button" className="portal-modal-btn portal-modal-btn--ghost" onClick={onClose}>
          {t.tm_manage_cancel}
        </button>
        <button
          type="button"
          className="portal-modal-btn"
          onClick={() => { onSave({ brand, certLevel, targetLevel }); onClose() }}
        >
          {t.tm_manage_save}
        </button>
      </div>
    </PortalModal>
  )
}

function FicheProfil({ member, t }) {
  return (
    <>
      <div className="portal-modal-row">
        <span className="portal-modal-label">{t.th_brand}</span>
        <span className={`portal-brand-chip ${member.brand}`}>{member.brand}</span>
      </div>
      <div className="portal-modal-row">
        <span className="portal-modal-label">{t.level_badge}</span>
        <span className="portal-modal-value">{member.certLevel} → {member.targetLevel}</span>
      </div>
      <div className="portal-modal-row">
        <span className="portal-modal-label">{t.th_progress}</span>
        <span className="portal-modal-value">{member.progress}%</span>
      </div>
      <div className="portal-modal-row">
        <span className="portal-modal-label">{t.th_last_activity}</span>
        <span className="portal-modal-value">{member.lastActivity}</span>
      </div>
      <div className="portal-modal-row">
        <span className="portal-modal-label">{t.tm_hero_competency_label}</span>
        <span className="portal-modal-value">
          {member.competencyDone ?? 0}/{member.competencyTotal ?? 0}
        </span>
      </div>
    </>
  )
}

function FicheResultats({ member, t }) {
  const evals = member.evaluations ?? []
  if (!evals.length) {
    return <p className="portal-modal-hint">{t.tm_fiche_no_results}</p>
  }
  return (
    <ul className="portal-team-fiche-eval-list">
      {evals.map(e => (
        <li key={e.id} className={`portal-team-fiche-eval-item portal-team-fiche-eval-item--${e.status}`}>
          <span className="portal-team-fiche-eval-title">{resolveEvalTitle(e, t, member)}</span>
          <span className={`portal-status-chip ${e.status === 'done' ? 'done' : 'todo'}`}>
            {e.status === 'done' ? t.status_done : t.status_todo}
            {e.score != null ? ` · ${e.score}/100` : ''}
          </span>
        </li>
      ))}
    </ul>
  )
}

function FichePlan({ member, t, planYear }) {
  const pathwayCount = (member.planPathway ?? []).filter(p => p.date?.startsWith(String(planYear))).length
  return (
    <div className="portal-team-fiche-plan">
      <div className="portal-plan-entries pv-grid cols-2 pv-grid--stretch">
        <PlanEntryCard
          kind="pif"
          title={t.plan_entry_pif_title}
          desc={t.plan_entry_pif_desc}
          meta={t.plan_entry_pif_meta}
          cta={t.plan_entry_open}
          hoverHint={t.plan_entry_coming_soon}
          accentColor="var(--red)"
        />
        <PlanEntryCard
          kind="planning"
          title={t.plan_entry_planning_title.replace('2026', String(planYear))}
          desc={t.plan_entry_planning_desc}
          meta={t.plan_entry_planning_meta
            .replace('{count}', String(pathwayCount))
            .replace('{year}', String(planYear))}
          cta={t.plan_entry_open}
          hoverHint={t.plan_entry_coming_soon}
          accentColor="#1a56db"
        />
      </div>
    </div>
  )
}

const FICHE_TABS = ['profil', 'resultats', 'plan']

export function TeamMemberFicheModal({ member, t, planYear, onClose, onManage }) {
  const [tab, setTab] = useState('profil')

  return (
    <PortalModal title={member.nom} onClose={onClose}>
      <div className="portal-team-fiche-tabs" role="tablist">
        {FICHE_TABS.map(id => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className={`portal-team-fiche-tab${tab === id ? ' active' : ''}`}
            onClick={() => setTab(id)}
          >
            {t[`tm_fiche_tab_${id}`]}
          </button>
        ))}
      </div>
      <div className="portal-team-fiche-panel">
        {tab === 'profil' && <FicheProfil member={member} t={t} />}
        {tab === 'resultats' && <FicheResultats member={member} t={t} />}
        {tab === 'plan' && <FichePlan member={member} t={t} planYear={planYear} />}
      </div>
      {tab === 'profil' && (
        <button type="button" className="portal-modal-btn portal-modal-btn--block" onClick={onManage}>
          {t.tm_member_manage}
        </button>
      )}
    </PortalModal>
  )
}
