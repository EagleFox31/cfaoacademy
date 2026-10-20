/**
 * État d'avancement de la construction des dashboards par profil × section MEDACAP.
 *
 * Source utilisée par la page Super Admin Builder pour :
 *   - visualiser l'état (idea | draft | ready | live)
 *   - prioriser les prochaines sections à construire
 *   - toggler on/off une section pour prévisualiser
 *
 * Mise à jour manuelle quand un lego passe un cran. Persistée en localStorage
 * pour permettre au super admin de manipuler sans commit.
 */

export const BUILD_STATUS = {
  IDEA:  { key: 'idea',  order: 0, labelKey: 'build_status_idea',  tone: 'muted'    },
  DRAFT: { key: 'draft', order: 1, labelKey: 'build_status_draft', tone: 'progress' },
  READY: { key: 'ready', order: 2, labelKey: 'build_status_ready', tone: 'accent'   },
  LIVE:  { key: 'live',  order: 3, labelKey: 'build_status_live',  tone: 'done'     },
}

/**
 * État par défaut (baseline actuelle du repo, sept. 2026).
 * Format : `${profileKey}::${sectionId}` → { status, priority, notes }
 * priority = P0 (bloquant) · P1 (haut) · P2 (moyen) · P3 (bas)
 */
export const DEFAULT_BUILD_STATE = {
  // ─── Technicien ───
  'learner::nextActions':          { status: 'live',  priority: 'P0' },
  'learner::personalMeasure':      { status: 'live',  priority: 'P0' },
  'learner::personalExploit':      { status: 'live',  priority: 'P0' },
  'learner::personalPifTimeline':  { status: 'draft', priority: 'P0', notes: 'Multiplicateur — à extraire de LearnerPifSection en pluri-annuel N/N+1/N+2' },
  'learner::personalAcquisition':  { status: 'live',  priority: 'P1' },
  'learner::personalCertifs':      { status: 'live',  priority: 'P1' },
  'learner::personalPerformance':  { status: 'draft', priority: 'P2' },
  'learner::assistance':           { status: 'live',  priority: 'P2' },

  // ─── KI / PIC ───
  'ki::kiNextActions':             { status: 'live',  priority: 'P1' },
  'ki::kiFilialeExploit':          { status: 'live',  priority: 'P1' },
  'ki::kiFilialePif':              { status: 'live',  priority: 'P1' },

  // ─── Manager ───
  'team_manager::managerNextActions': { status: 'ready', priority: 'P0', notes: 'Enrichir avec "À valider Déclaratifs" + "À arbitrer PIF année N"' },
  'team_manager::teamRoster':      { status: 'live',  priority: 'P0' },
  'team_manager::teamExploit':     { status: 'live',  priority: 'P0' },
  'team_manager::teamPifTimeline': { status: 'draft', priority: 'P0', notes: 'Ajouter action Valider/Refuser année N si policy filiale' },
  'team_manager::teamAcquisition': { status: 'ready', priority: 'P1' },
  'team_manager::teamPerformance': { status: 'draft', priority: 'P2', notes: 'Comparatif période N vs N-1 manquant' },

  // ─── DPS/DOP (référence) ───
  'dps::dpsCollaboratorResults':   { status: 'live',  priority: 'P0' },
  'dps::dpsTierResults':           { status: 'live',  priority: 'P0' },
  'dps::dpsFilialePifTimeline':    { status: 'draft', priority: 'P0', notes: 'Étendre en pluri-annuel + action Valider années N/N+1/N+2' },
  'dps::dpsPerformance':           { status: 'idea',  priority: 'P1', notes: 'Comparatif trimestre N vs N-1 par marque/palier — inexistant' },
  'dps::dpsActivity':              { status: 'live',  priority: 'P2' },

  // ─── RH filiale ───
  'branch_hr::hrNextActions':      { status: 'idea',  priority: 'P0', notes: 'À construire : onboardings en attente, contrats expirants, certifs à renouveler' },
  'branch_hr::hrCampaignsScheduler': { status: 'idea', priority: 'P0', notes: '3 types : campagne M (tests), A (formations), recrutement' },
  'branch_hr::hrPifValidation':    { status: 'idea',  priority: 'P0' },
  'branch_hr::hrPerformanceCompare': { status: 'idea', priority: 'P1' },
  'branch_hr::hrDirectoryAdmin':   { status: 'draft', priority: 'P0', notes: 'Table existe (BranchHRDashboard) — ajouter funnel onboarding + menu ligne (deactivate/reset/role)' },

  // ─── RH groupe ───
  'group_hr::hrNextActions':       { status: 'idea',  priority: 'P1' },
  'group_hr::hrCampaignsScheduler': { status: 'idea', priority: 'P1' },
  'group_hr::hrPerformanceCompare': { status: 'idea', priority: 'P0', notes: 'Comparatif inter-filiales = clé du superset group' },
  'group_hr::hrPifValidation':     { status: 'idea',  priority: 'P2' },
  'group_hr::hrDirectoryAdmin':    { status: 'idea',  priority: 'P1' },
}

const STORAGE_KEY = 'cfao.medacap.buildState.v1'

export function loadBuildState() {
  if (typeof window === 'undefined') return DEFAULT_BUILD_STATE
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_BUILD_STATE
    return { ...DEFAULT_BUILD_STATE, ...JSON.parse(raw) }
  } catch {
    return DEFAULT_BUILD_STATE
  }
}

export function saveBuildState(state) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  } catch {
    /* quota — silencieux */
  }
}

export function buildStateKey(profileKey, sectionId) {
  return `${profileKey}::${sectionId}`
}

export const PRIORITY_ORDER = { P0: 0, P1: 1, P2: 2, P3: 3 }
