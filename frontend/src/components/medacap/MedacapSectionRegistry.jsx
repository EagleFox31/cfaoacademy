/**
 * Registre des legos MEDACAP — mapping `id` de section → composant + defaults.
 *
 * Le renderer <MedacapDashboard /> lit cette map, applique les overrides de la config
 * profil (medacapMatrix.js), et instancie chaque lego avec `ctx` (user, lms, scope, t).
 *
 * IMPORTANT : ce registre RÉUTILISE les composants existants du repo. On ne réécrit
 * pas les sections DPS/Learner/Team qui sont déjà branchées et testées — on les
 * paramètre. Les nouveaux legos (HR admin, campagnes, comparatif) sont créés à côté
 * dans /components/medacap/ au fil de l'eau.
 */
import DpsCollaboratorResultsSection from '../DpsCollaboratorResultsSection.jsx'
import DpsTierResultsSection from '../DpsTierResultsSection.jsx'
import DpsFilialePifSection from '../DpsFilialePifSection.jsx'
import DpsActivitySection from '../DpsActivitySection.jsx'
import DpsAssistanceSection from '../DpsAssistanceSection.jsx'
import LearnerNextActions from '../LearnerNextActions.jsx'
import LearnerPifSection from '../LearnerPifSection.jsx'
import LearnerCompetencyResultsSection from '../LearnerCompetencyResultsSection.jsx'
import LearnerTestsSection from '../LearnerTestsSection.jsx'
import TeamManagerNextActions from '../TeamManagerNextActions.jsx'
import TeamSection from '../TeamSection.jsx'
import TeamResultsSection from '../TeamResultsSection.jsx'
import TeamPlansSection from '../TeamPlansSection.jsx'
import KiNextActions from '../KiNextActions.jsx'
import KiToyotaFilialeResultsSection from '../KiToyotaFilialeResultsSection.jsx'
import KiToyotaFilialePifSection from '../KiToyotaFilialePifSection.jsx'
import PortalAssistanceSection from '../PortalAssistanceSection.jsx'
import PifTimelinePluriannuel from './PifTimelinePluriannuel.jsx'
import HrDirectoryAdmin from './HrDirectoryAdmin.jsx'
import HrCampaignsScheduler from './HrCampaignsScheduler.jsx'
import PerformanceComparatif from './PerformanceComparatif.jsx'
import PlaceholderSection from './PlaceholderSection.jsx'

/**
 * Chaque entrée = { component, propsFrom(ctx) → object, needs: string[] }
 * `needs` : quelles clés de ctx sont indispensables (skip silencieux si manquant).
 */
export const SECTION_REGISTRY = {
  /* ═════ TECHNICIEN (Learner) ═════ */
  nextActions: {
    component: LearnerNextActions,
    propsFrom: ({ user, lms, nextActions }) => ({ user, actions: nextActions ?? [] }),
  },
  personalMeasure: {
    component: LearnerTestsSection,
    propsFrom: ({ user, lms, evaluations, t }) => ({
      user, lms, evaluations, t, isMedacapLearner: false,
    }),
  },
  personalExploit: {
    component: LearnerCompetencyResultsSection,
    propsFrom: ({ user, lms, evaluations, t }) => ({ user, lms, evaluations, t }),
  },
  personalPifTimeline: {
    component: PifTimelinePluriannuel,
    propsFrom: ({ lms, t, updatedAt }) => ({
      years: yearsFromLms(lms),
      entries: pifEntriesFromLms(lms),
      validation: pifValidationFromLms(lms),
      permission: 'read',
      t, updatedAt,
    }),
  },
  personalAcquisition: {
    component: LearnerPifSection,
    propsFrom: ({ user, lms, t }) => ({ user, lms, t }),
  },
  personalCertifs: {
    component: PlaceholderSection,
    propsFrom: ({ t }) => ({
      titleKey: 'title_my_certifications',
      eyebrowKey: 'eyebrow_manufacturer',
      icon: 'award',
      hintKey: 'placeholder_use_learner_certifs',
      t,
    }),
  },
  personalPerformance: {
    component: PerformanceComparatif,
    propsFrom: ({ lms, t }) => ({ scope: 'self', lms, t }),
  },

  /* ═════ KEY INSTRUCTOR (KI/PIC) ═════ */
  kiNextActions: {
    component: KiNextActions,
    propsFrom: ({ user, lms }) => ({ user, lms }),
  },
  kiFilialeExploit: {
    component: KiToyotaFilialeResultsSection,
    propsFrom: ({ user, lms, t }) => ({ user, lms, t }),
  },
  kiFilialePif: {
    component: KiToyotaFilialePifSection,
    propsFrom: ({ user, lms, t }) => ({ user, lms, t }),
  },

  /* ═════ MANAGER (team / workshop) ═════ */
  managerNextActions: {
    component: TeamManagerNextActions,
    propsFrom: ({ lms }) => ({ lms }),
  },
  teamRoster: {
    component: TeamSection,
    propsFrom: ({ user, lms, t, planYear, override }) => ({
      members: lms?.team, lms, user, t, planYear, ...override,
    }),
  },
  teamExploit: {
    component: TeamResultsSection,
    propsFrom: ({ teamMembers, t }) => ({ members: teamMembers, t }),
  },
  teamPifTimeline: {
    component: PifTimelinePluriannuel,
    propsFrom: ({ lms, t, updatedAt, permission, onValidateYear }) => ({
      years: yearsFromLms(lms),
      entries: pifEntriesFromLms(lms),
      validation: pifValidationFromLms(lms),
      permission,
      onValidateYear,
      title: t.team_pif_timeline_title ?? undefined,
      t, updatedAt,
    }),
  },
  teamAcquisition: {
    component: TeamPlansSection,
    propsFrom: ({ teamMembers, t, planYear }) => ({ members: teamMembers, t, planYear }),
  },
  teamPerformance: {
    component: PerformanceComparatif,
    propsFrom: ({ lms, t }) => ({ scope: 'team', lms, t }),
  },

  /* ═════ DPS / DOP ═════ */
  dpsCollaboratorResults: {
    component: DpsCollaboratorResultsSection,
    propsFrom: ({ displayUser, lms, t, updatedAt, scopeLoading, insightsLoading }) => ({
      user: displayUser, lms, t, updatedAt, scopeLoading, insightsLoading,
    }),
  },
  dpsTierResults: {
    component: DpsTierResultsSection,
    propsFrom: ({ displayUser, lms, t, updatedAt, scopeLoading, insightsLoading }) => ({
      user: displayUser, lms, t, updatedAt, scopeLoading, insightsLoading,
    }),
  },
  dpsFilialePifTimeline: {
    component: PifTimelinePluriannuel,
    propsFrom: ({ lms, t, updatedAt, permission, onValidateYear }) => ({
      years: yearsFromLms(lms),
      entries: pifEntriesFromLms(lms),
      validation: pifValidationFromLms(lms, 'dps'),
      permission,
      onValidateYear,
      t, updatedAt,
    }),
  },
  dpsFilialePif: {
    // Ancien composant PIF filiale — conservé pour rétro-compat mais remplacé par la timeline
    component: DpsFilialePifSection,
    propsFrom: ({ displayUser, lms, t, updatedAt, scopeLoading, insightsLoading }) => ({
      user: displayUser, lms, t, updatedAt, scopeLoading, insightsLoading,
    }),
  },
  dpsPerformance: {
    component: PerformanceComparatif,
    propsFrom: ({ lms, t }) => ({ scope: 'branch', lms, t }),
  },
  dpsActivity: {
    component: DpsActivitySection,
    propsFrom: ({ lms, t, updatedAt }) => ({ lms, t, updatedAt }),
  },

  /* ═════ RH ═════ */
  hrNextActions: {
    component: PlaceholderSection,
    propsFrom: ({ t }) => ({
      titleKey: 'hr_next_actions_title',
      eyebrowKey: 'hr_next_actions_eyebrow',
      icon: 'clipboard',
      hintKey: 'hr_next_actions_hint',
      t,
    }),
  },
  hrCampaignsScheduler: {
    component: HrCampaignsScheduler,
    propsFrom: ({ user, lms, t }) => ({ user, lms, t }),
  },
  hrPifValidation: {
    component: PifTimelinePluriannuel,
    propsFrom: ({ lms, t, updatedAt, onValidateYear }) => ({
      years: yearsFromLms(lms),
      entries: pifEntriesFromLms(lms),
      validation: pifValidationFromLms(lms, 'hr'),
      permission: 'write',
      onValidateYear,
      title: t.hr_pif_validation_title,
      eyebrow: t.hr_pif_validation_eyebrow,
      t, updatedAt,
    }),
  },
  hrPerformanceCompare: {
    component: PerformanceComparatif,
    propsFrom: ({ lms, t }, override) => ({ scope: override?.scope ?? 'branch', lms, t, compare: true }),
  },
  hrDirectoryAdmin: {
    component: HrDirectoryAdmin,
    propsFrom: ({ user, lms, t }) => ({ user, lms, t }),
  },

  /* ═════ Transverse ═════ */
  assistance: {
    component: PortalAssistanceSection,
    propsFrom: ({ t, variant = 'default', tickets }) => ({ t, variant, tickets }),
    // Fallback : si aucune variante fournie, use DpsAssistanceSection sans var
    fallback: DpsAssistanceSection,
  },
}

/* ═══════════════════ Helpers d'extraction PIF depuis mock_lms ═══════════════════ */

function yearsFromLms(lms) {
  if (!lms) return [new Date().getFullYear()]
  const raw = lms.planPathway ?? lms.pifPluriannual ?? []
  const years = new Set(raw.map(e => e.year).filter(Boolean))
  if (years.size === 0) {
    const y = new Date().getFullYear()
    return [y, y + 1, y + 2]
  }
  return [...years].sort()
}

function pifEntriesFromLms(lms) {
  if (!lms) return []
  return lms.planPathway ?? lms.pifPluriannual ?? []
}

function pifValidationFromLms(lms, defaultBy = 'manager') {
  const v = lms?.pifValidation
  if (v) return v
  const years = yearsFromLms(lms)
  return {
    by: defaultBy,
    states: Object.fromEntries(years.map((y, i) => [y, i === 0 ? 'pending' : 'pending'])),
  }
}
