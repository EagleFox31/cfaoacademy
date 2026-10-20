import { useMemo, useState } from 'react'
import PortalReveal from '../PortalReveal.jsx'
import PortalSectionEyebrow from '../PortalSectionEyebrow.jsx'
import PortalSectionHead from '../PortalSectionHead.jsx'
import PortalStaggerGrid from '../PortalStaggerGrid.jsx'
import PlanEntryCard from '../PlanEntryCard.jsx'
import PortalModal from '../PortalModal.jsx'

/**
 * Annuaire RH administrable — grille de cartes homogène avec DPS.
 * Chaque collab = 1 PlanEntryCard kind='learners' avec menu d'actions.
 */
export default function HrDirectoryAdmin({ user, lms, t, sectionId = 'annuaire' }) {
  const [query, setQuery] = useState('')
  const [openMenu, setOpenMenu] = useState(null)
  const [onboardingOpen, setOnboardingOpen] = useState(false)

  const collabs = lms?.collaborateurs ?? []
  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return collabs
    return collabs.filter(c =>
      c.nom?.toLowerCase().includes(q) ||
      c.brand?.toLowerCase().includes(q) ||
      c.dept?.toLowerCase().includes(q) ||
      c.role?.toLowerCase().includes(q)
    )
  }, [collabs, query])

  return (
    <PortalReveal id={sectionId}>
      <div className="container" style={{ padding: '16px 32px' }}>
        <PortalSectionHead
          eyebrow={<PortalSectionEyebrow icon="users" label={t.hr_directory_eyebrow} />}
          title={t.hr_directory_title}
          methodText={t.hr_directory_method}
          t={t}
        />

        <div className="portal-toolbar">
          <input
            type="text"
            className="portal-toolbar-search"
            placeholder={t.search_placeholder}
            value={query}
            onChange={e => setQuery(e.target.value)}
            aria-label={t.search_placeholder}
          />
          <button
            type="button"
            className="portal-btn portal-btn-primary"
            onClick={() => setOnboardingOpen(true)}
          >
            {t.hr_add_collaborator}
          </button>
        </div>

        <PortalStaggerGrid className="cols-3 pv-grid--stretch">
          {filtered.map(c => (
            <div key={c.id} className="portal-directory-card-wrap">
              <PlanEntryCard
                kind="learners"
                title={c.nom}
                brandLabel={c.brand ? c.brand.toUpperCase() : undefined}
                statusChip={
                  c.alert
                    ? <span className="portal-status-chip accent">{t.alert_inactive}</span>
                    : c.progress === 100
                      ? <span className="portal-status-chip done">{t.kpi_certified}</span>
                      : null
                }
                meta={(
                  <div className="portal-plan-entry-meta">
                    <p><strong>{t[`role_${c.role}`] || c.role}</strong>{c.dept ? ` · ${c.dept}` : ''}</p>
                    {c.progress != null && (
                      <div className="portal-inline-bar" style={{ marginTop: 6 }}>
                        <div className="portal-inline-track">
                          <div
                            className="portal-inline-fill"
                            style={{
                              width: `${c.progress}%`,
                              background: c.progress === 100 ? '#1aab5b' : undefined,
                            }}
                          />
                        </div>
                        <span className="portal-inline-pct">{c.progress}%</span>
                      </div>
                    )}
                  </div>
                )}
                accentColor={c.alert ? '#e11d48' : c.progress === 100 ? '#1aab5b' : '#1a56db'}
                onOpen={() => setOpenMenu(openMenu === c.id ? null : c.id)}
                cta={t.hr_actions ?? 'Actions'}
                muted={c.alert}
                corner
              />
              {openMenu === c.id && (
                <PortalModal
                  title={c.nom}
                  onClose={() => setOpenMenu(null)}
                >
                  <ActionsMenu t={t} onDone={() => setOpenMenu(null)} />
                </PortalModal>
              )}
            </div>
          ))}
        </PortalStaggerGrid>
      </div>

      {onboardingOpen && (
        <OnboardingFunnel
          t={t}
          user={user}
          onClose={() => setOnboardingOpen(false)}
        />
      )}
    </PortalReveal>
  )
}

function ActionsMenu({ t, onDone }) {
  return (
    <div className="portal-actions-list">
      <button type="button" className="portal-actions-item" onClick={onDone}>
        {t.hr_menu_change_role}
      </button>
      <button type="button" className="portal-actions-item" onClick={onDone}>
        {t.hr_menu_reset_password}
      </button>
      <button type="button" className="portal-actions-item" onClick={onDone}>
        {t.hr_menu_assign_training}
      </button>
      <button type="button" className="portal-actions-item is-danger" onClick={onDone}>
        {t.hr_menu_deactivate}
      </button>
    </div>
  )
}

/**
 * Funnel onboarding — 4 étapes, dans un PortalModal.
 */
function OnboardingFunnel({ t, user, onClose }) {
  const [step, setStep] = useState(1)
  const [form, setForm] = useState({
    firstName: '', lastName: '', email: '', matricule: '',
    agency: '', department: '',
    roles: ['learner'], brands: [],
  })
  const totalSteps = 4
  const canNext = validateStep(step, form)
  function update(patch) { setForm(f => ({ ...f, ...patch })) }

  return (
    <PortalModal title={t.hr_onboarding_title} onClose={onClose}>
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
        {step === 1 && <StepIdentity form={form} update={update} t={t} />}
        {step === 2 && <StepAffectation form={form} update={update} t={t} branch={user?.filiale} />}
        {step === 3 && <StepRolesBrands form={form} update={update} t={t} />}
        {step === 4 && <StepRecap form={form} t={t} />}
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
            onClick={() => { /* TODO POST /users + invite */ onClose() }}
          >
            {t.hr_onboarding_send_invite}
          </button>
        )}
      </div>
    </PortalModal>
  )
}

function StepIdentity({ form, update, t }) {
  return (
    <div className="portal-form-grid">
      <label>
        <span>{t.hr_form_firstname}</span>
        <input value={form.firstName} onChange={e => update({ firstName: e.target.value })} />
      </label>
      <label>
        <span>{t.hr_form_lastname}</span>
        <input value={form.lastName} onChange={e => update({ lastName: e.target.value })} />
      </label>
      <label>
        <span>{t.hr_form_email}</span>
        <input type="email" value={form.email} onChange={e => update({ email: e.target.value })} />
      </label>
      <label>
        <span>{t.hr_form_matricule}</span>
        <input value={form.matricule} onChange={e => update({ matricule: e.target.value })} />
      </label>
    </div>
  )
}
function StepAffectation({ form, update, t, branch }) {
  return (
    <div className="portal-form-grid">
      <label>
        <span>{t.hr_form_branch}</span>
        <input value={branch ?? ''} disabled />
      </label>
      <label>
        <span>{t.hr_form_agency}</span>
        <input value={form.agency} onChange={e => update({ agency: e.target.value })} />
      </label>
      <label>
        <span>{t.hr_form_department}</span>
        <select value={form.department} onChange={e => update({ department: e.target.value })}>
          <option value="">—</option>
          <option value="motors">Motors / Mobility</option>
          <option value="equipment">Equipment</option>
          <option value="toyota">Toyota</option>
          <option value="suzuki">Suzuki</option>
        </select>
      </label>
    </div>
  )
}
function StepRolesBrands({ form, update, t }) {
  const roles = ['learner', 'ki', 'team_manager', 'workshop_manager', 'trainer', 'center_assistant']
  const brands = ['toyota', 'suzuki', 'mercedes', 'hino', 'fuso', 'sinotruk']
  return (
    <div className="portal-form-grid">
      <fieldset>
        <legend>{t.hr_form_roles}</legend>
        {roles.map(r => (
          <label key={r} className="portal-check-row">
            <input
              type="checkbox"
              checked={form.roles.includes(r)}
              onChange={e => update({
                roles: e.target.checked
                  ? [...form.roles, r]
                  : form.roles.filter(x => x !== r),
              })}
            />
            {t[`role_${r}`] ?? r}
          </label>
        ))}
      </fieldset>
      <fieldset>
        <legend>{t.hr_form_brands}</legend>
        {brands.map(b => (
          <label key={b} className="portal-check-row">
            <input
              type="checkbox"
              checked={form.brands.includes(b)}
              onChange={e => update({
                brands: e.target.checked
                  ? [...form.brands, b]
                  : form.brands.filter(x => x !== b),
              })}
            />
            {b}
          </label>
        ))}
      </fieldset>
    </div>
  )
}
function StepRecap({ form, t }) {
  return (
    <dl className="portal-form-recap">
      <dt>{t.hr_form_firstname}</dt><dd>{form.firstName}</dd>
      <dt>{t.hr_form_lastname}</dt><dd>{form.lastName}</dd>
      <dt>{t.hr_form_email}</dt><dd>{form.email}</dd>
      <dt>{t.hr_form_matricule}</dt><dd>{form.matricule || '—'}</dd>
      <dt>{t.hr_form_agency}</dt><dd>{form.agency}</dd>
      <dt>{t.hr_form_department}</dt><dd>{form.department}</dd>
      <dt>{t.hr_form_roles}</dt><dd>{form.roles.map(r => t[`role_${r}`] ?? r).join(', ')}</dd>
      <dt>{t.hr_form_brands}</dt><dd>{form.brands.join(', ') || '—'}</dd>
    </dl>
  )
}
function validateStep(step, form) {
  if (step === 1) return form.firstName && form.lastName && form.email
  if (step === 2) return form.agency && form.department
  if (step === 3) return form.roles.length > 0
  return true
}
