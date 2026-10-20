import { useMemo, useState, useCallback } from 'react'
import PortalLayout from '../PortalLayout.jsx'
import { SECTION_REGISTRY } from './MedacapSectionRegistry.jsx'
import { resolveProfileSections, MEDACAP_PROFILE_CONFIG } from '../../config/medacapMatrix.js'
import { loadBuildState, buildStateKey } from '../../config/profileBuildStatus.js'
import { resolveTeamMembers } from '../../utils/teamManagerMetrics.js'

/**
 * Renderer paramétré du portail par profil.
 *
 * Prend un `profileKey`, résout ses sections (avec héritage), et rend chaque lego
 * en injectant `ctx` + les overrides. C'est LE template reproductible : ajouter un
 * profil = ajouter une entrée dans medacapMatrix.js, rien d'autre à toucher ici.
 *
 * Props :
 *   profileKey       : learner | ki | team_manager | workshop_manager | dps | branch_hr | group_hr
 *   user, lms, t     : contexte du profil actif (fourni par la page appelante)
 *   scopeContext     : objet libre (scope loading, insights loading, updatedAt…)
 *   sectionOverrides : { [sectionId]: { hidden: bool, props: {…} } } — pilote depuis Builder
 *   respectBuildState: bool (défaut true) — masque sections non-live sauf en preview
 *   preview          : bool — affiche même les sections idea/draft (mode Builder)
 */
export default function MedacapDashboard({
  profileKey,
  user,
  lms,
  t,
  scopeContext = {},
  sectionOverrides = {},
  respectBuildState = false,
  preview = false,
  additionalCtx = {},
}) {
  const config = MEDACAP_PROFILE_CONFIG[profileKey]
  const sections = useMemo(() => resolveProfileSections(profileKey), [profileKey])
  const buildState = useMemo(() => loadBuildState(), [])
  const [pifValidations, setPifValidations] = useState({})

  const handleValidateYear = useCallback((year, decision, reason) => {
    setPifValidations(prev => ({
      ...prev,
      [year]: { decision, reason, at: new Date().toISOString() },
    }))
    // TODO: POST /pif/{scope}/validate — mock pour l'instant
  }, [])

  if (!config) {
    return (
      <PortalLayout user={user} lms={lms}>
        <div className="container" style={{ padding: 32 }}>
          Profil inconnu : <code>{profileKey}</code>
        </div>
      </PortalLayout>
    )
  }

  const ctx = {
    user,
    displayUser: additionalCtx.displayUser ?? user,
    lms,
    t,
    profileKey,
    scope: config.scope,
    planYear: new Date().getFullYear(),
    teamMembers: resolveTeamMembersFor(profileKey, lms, config.mode),
    onValidateYear: handleValidateYear,
    ...scopeContext,
    ...additionalCtx,
  }

  return (
    <PortalLayout
      user={ctx.displayUser}
      lms={lms}
      stickyVariant={config.heroVariant}
      filialeBrands={ctx.filialeBrands}
      notifications={lms?.alerts ?? []}
    >
      {sections.map((section, idx) => {
        const override = sectionOverrides[section.id] ?? {}
        if (override.hidden) return null

        const state = buildState[buildStateKey(profileKey, section.id)]
        if (respectBuildState && !preview && state && state.status !== 'live') {
          return null
        }

        return (
          <SectionSlot
            key={`${section.id}-${idx}`}
            section={section}
            ctx={ctx}
            override={override}
            preview={preview}
            buildState={state}
          />
        )
      })}
    </PortalLayout>
  )
}

function SectionSlot({ section, ctx, override, preview, buildState }) {
  const entry = SECTION_REGISTRY[section.id]
  if (!entry) {
    return preview ? (
      <div className="container" style={{ padding: 16 }}>
        <div className="portal-placeholder-card" style={{
          padding: 12, border: '1px dashed var(--muted-2)', borderRadius: 12,
          fontSize: 12, color: 'var(--muted)',
        }}>
          Section inconnue : <code>{section.id}</code> (à ajouter dans SECTION_REGISTRY)
        </div>
      </div>
    ) : null
  }

  const Component = entry.component
  const permission = section.permission ?? 'read'
  const props = entry.propsFrom({ ...ctx, permission }, override.props)
  const finalProps = { ...props, ...(section.props?.(ctx) ?? {}), ...(override.props ?? {}) }

  return (
    <div data-medacap-section={section.id} data-stage={section.stage ?? ''}>
      {preview && buildState && buildState.status !== 'live' && (
        <div className="medacap-preview-banner">
          <span className={`portal-status-chip ${statusToTone(buildState.status)}`}>
            {buildState.status.toUpperCase()}
          </span>
          {buildState.notes && <span className="medacap-preview-note">— {buildState.notes}</span>}
        </div>
      )}
      <Component {...finalProps} />
    </div>
  )
}

function statusToTone(s) {
  if (s === 'live') return 'done'
  if (s === 'ready') return 'accent'
  if (s === 'draft') return 'progress'
  return 'muted'
}

function resolveTeamMembersFor(profileKey, lms, mode) {
  if (!lms) return []
  if (profileKey === 'workshop_manager' || mode === 'workshop') {
    return resolveTeamMembers(lms, { workshop: true })
  }
  if (profileKey === 'team_manager') {
    return resolveTeamMembers(lms, { workshop: false })
  }
  return []
}
