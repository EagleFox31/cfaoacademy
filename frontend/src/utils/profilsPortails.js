import { ROLE_PRIORITY } from '../pages/portal/portalProfiles.js'
import { describeProfile, MEDACAP_STAGE_ORDER, MEDACAP_STAGES } from '../config/medacapMatrix.js'

/**
 * Profils montrés au directeur du centre dans « Portails des profils », par
 * groupe, avec ce que chacun voit. Ni le super admin, ni l'équipe build.
 */
export const PROFILS_EXCLUS = ['superadmin', 'build_team']

export const GROUPES_PROFILS = [
  { id: 'centre', roles: [
    { role: 'center_director', perimetre: 'centre_filiales' },
    { role: 'training_coordinator', perimetre: 'centre' },
    { role: 'center_assistant', perimetre: 'centre' },
    { role: 'trainer', perimetre: 'sessions' },
  ] },
  { id: 'groupe', roles: [
    { role: 'group_director', perimetre: 'groupe' },
    { role: 'group_admin', perimetre: 'groupe' },
    { role: 'group_hr', perimetre: 'groupe' },
    { role: 'regional_director', perimetre: 'region' },
  ] },
  { id: 'filiale', roles: [
    { role: 'branch_director', perimetre: 'filiale' },
    { role: 'dps', perimetre: 'filiale' },
    { role: 'dop', perimetre: 'filiale' },
    { role: 'branch_hr', perimetre: 'filiale' },
    { role: 'branch_admin', perimetre: 'filiale' },
    { role: 'workshop_manager', perimetre: 'atelier' },
    { role: 'team_manager', perimetre: 'equipe' },
    { role: 'ki', perimetre: 'filiale' },
    { role: 'pic', perimetre: 'filiale' },
    { role: 'technical_expert', perimetre: 'filiale' },
  ] },
  { id: 'apprenant', roles: [
    { role: 'learner', perimetre: 'parcours' },
  ] },
]

/** Les profils attendus : tous ceux de la plateforme, apprenant compris, hors exclus. */
export const PROFILS_ATTENDUS = [...ROLE_PRIORITY, 'learner'].filter(r => !PROFILS_EXCLUS.includes(r))

/** Profils dont le portail suit la matrice MEDACAP d'un autre profil. */
const MATRICE_DU_PROFIL = {
  dop: 'dps', branch_director: 'dps', regional_director: 'dps', group_director: 'dps',
  branch_admin: 'branch_hr', group_admin: 'group_hr',
  pic: 'ki', technical_expert: 'ki',
}

/**
 * Profils du centre de formation : absents de la matrice, leurs étapes sont
 * celles validées par le métier (étape → fonctionnalités, libellés `dir_portails_fonc_<id>`).
 */
const MEDACAP_CENTRE = {
  center_director: { E: ['centreResultats'], D: ['centreBesoins', 'centreDevis'], A1: ['centreOffres', 'centreFormations', 'centreCalendrier'], P: ['centreRapports', 'centreRoi'] },
  training_coordinator: { D: ['centreBesoins', 'centreCle'], A1: ['centreSessions', 'centreCalendrier'] },
  center_assistant: { A1: ['centreSessions', 'centreCalendrier', 'centreComptesRendus'] },
  trainer: { E: ['formateurResultats'], A1: ['formateurSessions'], C: ['formateurCertifs'], P: ['formateurProgression'] },
}

/**
 * Les 7 étapes MEDACAP d'un profil, dans l'ordre, avec les fonctionnalités
 * que la matrice (config/medacapMatrix.js) lui ouvre à chaque étape. Une étape
 * sans fonctionnalité est une lettre éteinte. `null` : profil absent de la matrice.
 */
export function medacapDuProfil(role) {
  const centre = MEDACAP_CENTRE[role]
  const profil = centre ? null : describeProfile(MATRICE_DU_PROFIL[role] ?? role)
  if (!centre && !profil) return null
  return MEDACAP_STAGE_ORDER.map(cle => ({
    cle,
    lettre: cle[0],
    labelKey: MEDACAP_STAGES[cle].labelKey,
    fonctions: centre ? (centre[cle] ?? []) : profil.sections.filter(s => s.stage === cle).map(s => s.id),
  }))
}

export const ROLES_PAGE_PORTAILS =['center_director', 'superadmin']

export function peutVoirPagePortails(roles = []) {
  return (roles ?? []).some(r => ROLES_PAGE_PORTAILS.includes(r))
}
