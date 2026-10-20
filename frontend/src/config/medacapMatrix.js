/**
 * Matrice MEDACAP — configuration paramétrable par profil.
 *
 * MEDACAP = Mesurer · Exploiter · Définir · Acquérir · Certifier · Appliquer · Performer
 *
 * Chaque profil = un sous-ensemble d'étapes × un scope × une posture (consult / valid / admin).
 * Le renderer (<MedacapDashboard />) itère sur `sections` et instancie chaque lego du
 * SECTION_REGISTRY avec ses overrides.
 *
 * Règles d'héritage 80/20 :
 *   RH        = DPS/DOP + strate admin (annuaire administrable + campagnes)
 *   DPS/DOP   = Manager + scope filiale/département
 *   Manager   = Technicien + équipe
 *
 * Voir mémoire projet [[medacap-acronym]].
 */

export const MEDACAP_STAGES = {
  M: { key: 'M', verb: 'measure',   labelKey: 'medacap_stage_measure' },
  E: { key: 'E', verb: 'exploit',   labelKey: 'medacap_stage_exploit' },
  D: { key: 'D', verb: 'define',    labelKey: 'medacap_stage_define' },
  A1: { key: 'A1', verb: 'acquire', labelKey: 'medacap_stage_acquire' },
  C: { key: 'C', verb: 'certify',   labelKey: 'medacap_stage_certify' },
  A2: { key: 'A2', verb: 'apply',   labelKey: 'medacap_stage_apply' },
  P: { key: 'P', verb: 'perform',   labelKey: 'medacap_stage_perform' },
}

export const MEDACAP_STAGE_ORDER = ['M', 'E', 'D', 'A1', 'C', 'A2', 'P']

/**
 * Scopes hiérarchiques — plus le scope est haut, plus la posture bascule vers monitoring/admin.
 */
export const PROFILE_SCOPE = {
  self:      { level: 0, key: 'self' },
  team:      { level: 1, key: 'team' },
  workshop:  { level: 2, key: 'workshop' },
  agency:    { level: 3, key: 'agency' },
  branch:    { level: 4, key: 'branch' },
  region:    { level: 5, key: 'region' },
  group:     { level: 6, key: 'group' },
}

/**
 * Permissions par section — dérivées du profil.
 * `read`  → lecture seule
 * `write` → peut agir dans le périmètre (valider, assigner, etc.)
 * `admin` → peut créer/supprimer/planifier des campagnes ou comptes
 */
export const PERMISSION = { READ: 'read', WRITE: 'write', ADMIN: 'admin' }

/**
 * Matrice profil × MEDACAP.
 *
 * Chaque `section` référence un `id` du SECTION_REGISTRY et peut overrider :
 *   - titleKey / eyebrowKey / methodKey : i18n
 *   - permission                        : read | write | admin
 *   - props                             : (ctx) => object — injection dynamique
 *   - visible                           : (ctx) => bool   — masquage conditionnel
 */
export const MEDACAP_PROFILE_CONFIG = {
  /* ─────────────── TECHNICIEN ─────────────── */
  learner: {
    profileKey: 'learner',
    scope: PROFILE_SCOPE.self,
    heroVariant: 'learner',
    sections: [
      { id: 'nextActions',           stage: 'M',  permission: PERMISSION.READ },
      { id: 'personalMeasure',       stage: 'M',  permission: PERMISSION.WRITE }, // passe ses tests
      { id: 'personalExploit',       stage: 'E',  permission: PERMISSION.READ  }, // ses scores par marque
      { id: 'personalPifTimeline',   stage: 'D',  permission: PERMISSION.READ  }, // pluri-annuel N/N+1/N+2
      { id: 'personalAcquisition',   stage: 'A1', permission: PERMISSION.READ  }, // ses modules
      { id: 'personalCertifs',       stage: 'C',  permission: PERMISSION.READ  }, // ses attestations
      { id: 'personalPerformance',   stage: 'P',  permission: PERMISSION.READ  }, // sa progression
      { id: 'assistance',            stage: null, permission: PERMISSION.WRITE },
    ],
  },

  /* ─────────────── KEY INSTRUCTOR / PIC ─────────────── */
  ki: {
    profileKey: 'ki',
    scope: PROFILE_SCOPE.branch,
    heroVariant: 'ki',
    extendsProfile: 'learner', // KI cumule casquette apprenant
    sections: [
      // Vue instructeur d'abord — casquette apprenant héritée en dessous
      { id: 'kiNextActions',         stage: 'D',  permission: PERMISSION.READ  },
      { id: 'kiFilialeExploit',      stage: 'E',  permission: PERMISSION.READ  }, // résultats filiale par marque certifiée
      { id: 'kiFilialePif',          stage: 'D',  permission: PERMISSION.READ  },
      { id: 'personalPifTimeline',   stage: 'D',  permission: PERMISSION.READ  }, // son propre PIF
      { id: 'personalMeasure',       stage: 'M',  permission: PERMISSION.WRITE }, // KI passe aussi ses tests
      { id: 'personalCertifs',       stage: 'C',  permission: PERMISSION.READ  },
      { id: 'assistance',            stage: null, permission: PERMISSION.WRITE },
    ],
  },

  /* ─────────────── MANAGER (team / workshop) ─────────────── */
  team_manager: {
    profileKey: 'team_manager',
    scope: PROFILE_SCOPE.team,
    heroVariant: 'manager',
    sections: [
      { id: 'managerNextActions',    stage: 'M',  permission: PERMISSION.WRITE }, // À valider Déclaratifs + À arbitrer PIF
      { id: 'teamRoster',            stage: null, permission: PERMISSION.READ  },
      { id: 'teamExploit',           stage: 'E',  permission: PERMISSION.READ  }, // matrice tech × palier × marque
      { id: 'teamPifTimeline',       stage: 'D',  permission: PERMISSION.WRITE }, // action Valider année N si policy
      { id: 'teamAcquisition',       stage: 'A1', permission: PERMISSION.READ  },
      { id: 'teamPerformance',       stage: 'P',  permission: PERMISSION.READ  },
      { id: 'assistance',            stage: null, permission: PERMISSION.WRITE },
    ],
  },
  workshop_manager: {
    profileKey: 'workshop_manager',
    scope: PROFILE_SCOPE.workshop,
    heroVariant: 'manager',
    extendsProfile: 'team_manager',
    mode: 'workshop', // rend teamRoster en multi-équipes
    sections: [
      { id: 'managerNextActions',    stage: 'M',  permission: PERMISSION.WRITE },
      { id: 'teamRoster',            stage: null, permission: PERMISSION.READ, props: () => ({ workshop: true }) },
      { id: 'teamExploit',           stage: 'E',  permission: PERMISSION.READ  },
      { id: 'teamPifTimeline',       stage: 'D',  permission: PERMISSION.WRITE },
      { id: 'teamAcquisition',       stage: 'A1', permission: PERMISSION.READ  },
      { id: 'teamPerformance',       stage: 'P',  permission: PERMISSION.READ  },
      { id: 'assistance',            stage: null, permission: PERMISSION.WRITE },
    ],
  },

  /* ─────────────── DPS / DOP (référence validée) ─────────────── */
  dps: {
    profileKey: 'dps',
    scope: PROFILE_SCOPE.branch,
    heroVariant: 'dps',
    observer: true, // rôle observateur : pas de CTA d'action superflu (mémoire feedback_roles_observateurs)
    sections: [
      { id: 'dpsCollaboratorResults', stage: 'E', permission: PERMISSION.READ },
      { id: 'dpsTierResults',         stage: 'E', permission: PERMISSION.READ },
      { id: 'dpsFilialePifTimeline',  stage: 'D', permission: PERMISSION.WRITE }, // valider années N/N+1/N+2
      { id: 'dpsPerformance',         stage: 'P', permission: PERMISSION.READ  }, // comparatif période
      { id: 'dpsActivity',            stage: 'P', permission: PERMISSION.READ  },
      { id: 'assistance',             stage: null, permission: PERMISSION.READ },
    ],
  },

  /* ─────────────── RH FILIALE / GROUPE ─────────────── */
  branch_hr: {
    profileKey: 'branch_hr',
    scope: PROFILE_SCOPE.branch,
    heroVariant: 'hr',
    extendsProfile: 'dps', // RH = superset DPS + strate admin
    sections: [
      // Hérite toutes les sections DPS puis ajoute le delta admin en tête
      { id: 'hrNextActions',           stage: null, permission: PERMISSION.ADMIN }, // onboarding en attente, contrats expirants…
      { id: 'hrCampaignsScheduler',    stage: 'M',  permission: PERMISSION.ADMIN }, // planif campagnes tests + acquérir + recrut.
      { id: 'dpsCollaboratorResults',  stage: 'E',  permission: PERMISSION.READ  },
      { id: 'dpsTierResults',          stage: 'E',  permission: PERMISSION.READ  },
      { id: 'hrPifValidation',         stage: 'D',  permission: PERMISSION.WRITE }, // regénère PIF cohorte + valide
      { id: 'hrPerformanceCompare',    stage: 'P',  permission: PERMISSION.READ  }, // comparatif inter-filiales
      { id: 'hrDirectoryAdmin',        stage: null, permission: PERMISSION.ADMIN }, // annuaire administrable + funnel add
      { id: 'assistance',              stage: null, permission: PERMISSION.READ  },
    ],
  },
  group_hr: {
    profileKey: 'group_hr',
    scope: PROFILE_SCOPE.group,
    heroVariant: 'hr',
    extendsProfile: 'branch_hr',
    sections: [
      { id: 'hrNextActions',          stage: null, permission: PERMISSION.ADMIN },
      { id: 'hrCampaignsScheduler',   stage: 'M',  permission: PERMISSION.ADMIN },
      { id: 'hrPerformanceCompare',   stage: 'P',  permission: PERMISSION.READ, props: () => ({ scope: 'group' }) },
      { id: 'dpsTierResults',         stage: 'E',  permission: PERMISSION.READ  },
      { id: 'hrPifValidation',        stage: 'D',  permission: PERMISSION.WRITE },
      { id: 'hrDirectoryAdmin',       stage: null, permission: PERMISSION.ADMIN },
      { id: 'assistance',             stage: null, permission: PERMISSION.READ  },
    ],
  },
}

/**
 * Résout les sections effectives d'un profil en appliquant l'héritage `extendsProfile`.
 * Les sections propres sont placées AVANT les sections héritées (ordre déclaré = ordre affiché).
 */
export function resolveProfileSections(profileKey) {
  const cfg = MEDACAP_PROFILE_CONFIG[profileKey]
  if (!cfg) return []
  const seen = new Set(cfg.sections.map(s => s.id))
  const inherited = cfg.extendsProfile
    ? resolveProfileSections(cfg.extendsProfile).filter(s => !seen.has(s.id))
    : []
  return [...cfg.sections, ...inherited]
}

/**
 * Décrit un profil de façon compacte pour l'admin builder.
 */
export function describeProfile(profileKey) {
  const cfg = MEDACAP_PROFILE_CONFIG[profileKey]
  if (!cfg) return null
  const sections = resolveProfileSections(profileKey)
  const stages = new Set(sections.map(s => s.stage).filter(Boolean))
  return {
    profileKey,
    scope: cfg.scope,
    heroVariant: cfg.heroVariant,
    extendsProfile: cfg.extendsProfile ?? null,
    sections,
    stagesCovered: MEDACAP_STAGE_ORDER.filter(k => stages.has(k)),
    stagesMissing: MEDACAP_STAGE_ORDER.filter(k => !stages.has(k)),
  }
}
