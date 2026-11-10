/**
 * Le brouillon d'un compte rendu et son lien avec la session.
 *
 * Une session du referentiel a un identifiant numerique : son code et
 * l'identite de ses stagiaires viennent alors de l'API et ne se
 * modifient pas ici. Les sessions d'essai (`ses-…`) et les saisies
 * manuelles (`manuel-…`) restent libres.
 */
import { typeDepuisCode } from './certification'
import { nombreDeJours } from './compteRendu'

export function brouillonVide() {
  return {
    sessionId: null,
    manuel: false,
    intitule: '',
    codeFormation: '',
    marque: '',
    lieu: '',
    pays: '',
    debut: '',
    fin: '',
    participants: [],
    photos: {},
    dispositions: {},
    textes: {},
    parties: {},
    satisfaction: {},
    // Formation (tests d'entree et de sortie) ou certification pratique
    // (modules notes sur 100) : decide a l'etape 1, il change la saisie
    // des notes, les fiches et quelques titres du document.
    type: 'formation',
    phase: 0,
  }
}

/** Vrai si l'identifiant est celui d'une session du referentiel (numerique). */
export const estSessionReferentiel = id => /^\d+$/.test(String(id ?? ''))

/** Vrai si le brouillon est rattache a une session du referentiel : identite en lecture seule. */
export const identiteVerrouillee = b => !b?.manuel && estSessionReferentiel(b?.sessionId)

const SAISIE_VIDE = { entreeBrut: '', sortieTheoBrut: '', sortiePratBrut: '', appreciation: '' }

/** Prepare un brouillon depuis une session (planning d'essai ou referentiel). */
export function depuisSession(s) {
  const referentiel = estSessionReferentiel(s.id)
  return {
    ...brouillonVide(),
    sessionId: String(s.id),
    intitule: s.moduleFormation,
    codeFormation: s.codeFormation,
    marque: s.marque,
    lieu: s.lieu,
    pays: s.paysHote,
    debut: s.debut,
    fin: s.fin,
    nbJours: nombreDeJours(s),
    ...(referentiel ? { seuil: s.seuil } : {}),
    ...typeDepuisCode(s.codeFormation),
    participants: (s.participants || []).map(p => (referentiel
      ? { id: p.id, nom: p.nom, prenom: p.prenom, pays: p.pays, present: !p.absent, ...SAISIE_VIDE }
      : { ...p, ...SAISIE_VIDE })),
  }
}

/**
 * La session telle que les etapes la lisent, d'apres le brouillon : une
 * saisie manuelle ou une session du referentiel (dont l'identite est
 * recopiee dans le brouillon). `connue` complete avec ce que le
 * brouillon ne garde pas (code de session, formateur).
 */
export function sessionDepuisBrouillon(b, connue = null) {
  return {
    ...(connue || {}),
    moduleFormation: b.intitule,
    codeFormation: b.codeFormation,
    marque: b.marque,
    lieu: b.lieu,
    paysHote: b.pays,
    debut: b.debut,
    fin: b.fin,
    nbJours: b.nbJours,
  }
}
