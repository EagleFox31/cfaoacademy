import { useState } from 'react'
import PortalReveal from '../PortalReveal.jsx'
import PortalSectionEyebrow from '../PortalSectionEyebrow.jsx'
import PortalSectionHead from '../PortalSectionHead.jsx'
import PortalStaggerGrid from '../PortalStaggerGrid.jsx'
import PlanEntryCard from '../PlanEntryCard.jsx'
import PortalModal from '../PortalModal.jsx'

/**
 * Planificateur de campagnes RH — 3 types :
 *   - measure  : campagne de tests (Factuel/Déclaratif) sur cohorte × marque × palier
 *   - acquire  : vague de formations planifiées (e-learning + présentiel)
 *   - recruit  : ouverture recrutement → candidats + évals assignées
 *
 * Rendu en grilles homogènes DPS : 3 PlanEntryCard pour les types, PortalStaggerGrid
 * pour les campagnes actives.
 */
export default function HrCampaignsScheduler({ user, lms, t, sectionId = 'campagnes' }) {
  const [wizardType, setWizardType] = useState(null)
  const activeCampaigns = lms?.campaigns ?? []

  return (
    <PortalReveal id={sectionId}>
      <div className="container" style={{ padding: '16px 32px' }}>
        <PortalSectionHead
          eyebrow={<PortalSectionEyebrow icon="calendar" label={t.hr_campaigns_eyebrow} />}
          title={t.hr_campaigns_title}
          lead={t.hr_campaigns_lead}
          methodText={t.hr_campaigns_method}
          t={t}
        />

        {/* Types de campagne — 3 PlanEntryCard homogènes */}
        <PortalStaggerGrid className="cols-3 pv-grid--stretch">
          {['measure', 'acquire', 'recruit'].map(type => (
            <PlanEntryCard
              key={type}
              kind={campaignKind(type)}
              title={t[`hr_campaign_type_${type}`]}
              meta={(
                <div className="portal-plan-entry-meta">
                  <p>{t[`hr_campaign_desc_${type}`]}</p>
                </div>
              )}
              cta={t.hr_campaign_launch}
              hoverHint={t.hr_campaign_launch}
              onOpen={() => setWizardType(type)}
              accentColor={campaignAccent(type)}
              corner
            />
          ))}
        </PortalStaggerGrid>

        {/* Campagnes actives — grille, pas de tableau */}
        {activeCampaigns.length > 0 && (
          <>
            <div className="portal-section-subhead">
              <PortalSectionEyebrow icon="clipboard" label={t.hr_campaigns_active_title} />
            </div>
            <PortalStaggerGrid className="cols-3 pv-grid--stretch">
              {activeCampaigns.map(c => (
                <PlanEntryCard
                  key={c.id}
                  kind={campaignKind(c.type)}
                  title={c.name}
                  brandLabel={c.brand ? c.brand.toUpperCase() : undefined}
                  statusChip={
                    <span className={`portal-status-chip ${c.progress >= 80 ? 'done' : 'progress'}`}>
                      {c.progress}%
                    </span>
                  }
                  meta={(
                    <div className="portal-plan-entry-meta">
                      <p>
                        <strong>{t[`hr_campaign_type_${c.type}`] ?? c.type}</strong>
                        {c.tier ? ` · ${c.tier}` : ''}
                      </p>
                      <p style={{ opacity: 0.7 }}>
                        {c.cohortSize} · {t.hr_campaigns_col_deadline}: {c.deadline}
                      </p>
                    </div>
                  )}
                  accentColor={c.progress >= 80 ? '#1aab5b' : '#1a56db'}
                  corner
                />
              ))}
            </PortalStaggerGrid>
          </>
        )}
      </div>

      {wizardType && (
        <CampaignWizard
          type={wizardType}
          t={t}
          user={user}
          onClose={() => setWizardType(null)}
        />
      )}
    </PortalReveal>
  )
}

function CampaignWizard({ type, t, user, onClose }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    name: '', brand: '', tier: 'junior',
    department: '', cohortScope: 'agency',
    contentType: type === 'measure' ? 'both' : type === 'acquire' ? 'mixed' : 'candidate',
    deadline: '', startDate: '',
  })
  const totalSteps = 3
  function update(patch) { setForm(f => ({ ...f, ...patch })) }
  const canNext = validateWizardStep(step, form)

  return (
    <PortalModal title={t[`hr_campaign_wizard_title_${type}`]} onClose={onClose}>
      <div className="portal-funnel-progress">
        <span className="portal-funnel-step">
          {t.hr_onboarding_step?.replace('{n}', step).replace('{total}', totalSteps)}
        </span>
        <div className="portal-funnel-progress-track">
          <div
            className="portal-funnel-progress-fill"
            style={{ width: `${(step / totalSteps) * 100}%` }}
          />
        </div>
      </div>

      <div className="portal-funnel-body">
        {step === 1 && (
          <div className="portal-form-grid">
            <label>
              <span>{t.hr_campaign_name}</span>
              <input value={form.name} onChange={e => update({ name: e.target.value })} />
            </label>
            <label>
              <span>{t.hr_campaign_cohort_scope}</span>
              <select value={form.cohortScope} onChange={e => update({ cohortScope: e.target.value })}>
                <option value="agency">{t.scope_agency ?? 'Agence'}</option>
                <option value="department">{t.scope_department ?? 'Département'}</option>
                <option value="branch">{t.scope_branch ?? 'Filiale'}</option>
              </select>
            </label>
            <label>
              <span>{t.hr_campaign_brand}</span>
              <select value={form.brand} onChange={e => update({ brand: e.target.value })}>
                <option value="">—</option>
                <option value="toyota">Toyota</option>
                <option value="suzuki">Suzuki</option>
                <option value="hino">Hino</option>
                <option value="sinotruk">Sinotruk</option>
              </select>
            </label>
            {type === 'measure' && (
              <label>
                <span>{t.hr_campaign_tier}</span>
                <select value={form.tier} onChange={e => update({ tier: e.target.value })}>
                  <option value="junior">Maintenance (Junior)</option>
                  <option value="senior">Réparation (Senior)</option>
                  <option value="expert">Diagnostic (Expert)</option>
                </select>
              </label>
            )}
          </div>
        )}

        {step === 2 && (
          <div className="portal-form-grid">
            {type === 'measure' && (
              <label>
                <span>{t.hr_campaign_test_type}</span>
                <select value={form.contentType} onChange={e => update({ contentType: e.target.value })}>
                  <option value="factuel">Factuel (QCM)</option>
                  <option value="declaratif">Déclaratif (validé KI)</option>
                  <option value="both">Les deux</option>
                </select>
              </label>
            )}
            {type === 'acquire' && (
              <label>
                <span>{t.hr_campaign_training_mix}</span>
                <select value={form.contentType} onChange={e => update({ contentType: e.target.value })}>
                  <option value="elearning">E-learning uniquement</option>
                  <option value="presential">Présentiel uniquement</option>
                  <option value="mixed">Mixte</option>
                </select>
              </label>
            )}
            {type === 'recruit' && (
              <label>
                <span>{t.hr_campaign_candidate_role}</span>
                <select value={form.contentType} onChange={e => update({ contentType: e.target.value })}>
                  <option value="candidate">Technicien (candidat)</option>
                  <option value="candidate-commercial">Commercial (candidat)</option>
                </select>
              </label>
            )}
          </div>
        )}

        {step === 3 && (
          <div className="portal-form-grid">
            <label>
              <span>{t.hr_campaign_start_date}</span>
              <input type="date" value={form.startDate} onChange={e => update({ startDate: e.target.value })} />
            </label>
            <label>
              <span>{t.hr_campaign_deadline}</span>
              <input type="date" value={form.deadline} onChange={e => update({ deadline: e.target.value })} />
            </label>
          </div>
        )}
      </div>

      <div className="portal-modal-actions">
        <button type="button" className="portal-btn portal-btn-ghost" onClick={onClose}>
          {t.cancel ?? 'Annuler'}
        </button>
        {step > 1 && (
          <button type="button" className="portal-btn portal-btn-ghost" onClick={() => setStep(s => s - 1)}>
            {t.previous ?? 'Précédent'}
          </button>
        )}
        {step < totalSteps ? (
          <button
            type="button"
            className="portal-btn portal-btn-primary"
            disabled={!canNext}
            onClick={() => setStep(s => s + 1)}
          >
            {t.next ?? 'Suivant'}
          </button>
        ) : (
          <button
            type="button"
            className="portal-btn portal-btn-primary"
            onClick={() => { /* TODO POST /campaigns */ onClose() }}
          >
            {t.hr_campaign_confirm ?? 'Lancer la campagne'}
          </button>
        )}
      </div>
    </PortalModal>
  )
}

function validateWizardStep(step, form) {
  if (step === 1) return form.name && form.cohortScope
  if (step === 2) return !!form.contentType
  return form.deadline && form.startDate
}

function campaignKind(type) {
  if (type === 'measure') return 'results'
  if (type === 'acquire') return 'sessions'
  if (type === 'recruit') return 'learners'
  return 'pif'
}
function campaignAccent(type) {
  if (type === 'measure') return '#1a56db'
  if (type === 'acquire') return '#e67e00'
  if (type === 'recruit') return '#1aab5b'
  return '#64748b'
}
