import { certificationDe } from '../data/certifications'
import { SEUIL } from './baremeCfao'

/**
 * Les comptes rendus de certification pratique.
 *
 * Deux sortes de sessions produisent un compte rendu, et ce n'est pas
 * leur titre qui les distingue — une « certification » SSQS s'evalue
 * comme une formation — mais la maniere d'evaluer :
 *
 *   * **formation** : test d'entree, test de sortie, pratique ; on en
 *     tire une progression et un taux d'acquisition ;
 *   * **certification pratique** : une serie de modules notes chacun
 *     sur 100, sans test d'entree. Le candidat valide la partie pratique
 *     a 70 %, comme le classeur « Résultats de la certification ».
 *
 * S'y ajoute l'e-learning : modules requis et valides, et un statut que
 * la plateforme donne (« Validé » ou « Non finalisé »). Aucun seuil ne
 * le deduit — on a vu « Validé » a 95 % et « Non finalisé » a 82 % — :
 * le formateur le reporte tel quel.
 *
 * Le resultat final suit la regle des comptes rendus G3 : CERTIFIÉ
 * seulement si la pratique et l'e-learning sont valides.
 */

export const FORMATION = 'formation'
export const CERTIFICATION = 'certification'

export const VALIDE = 'Validé'
export const ECHOUE = 'Échoué'
export const NON_FINALISE = 'Non finalisé'
export const STATUTS_ELEARNING = [VALIDE, NON_FINALISE]
export const CERTIFIE = 'CERTIFIÉ'
export const NON_CERTIFIE = 'NON CERTIFIÉ'

/** Le compte rendu est-il celui d'une certification pratique ? */
export const estCertification = b => b?.type === CERTIFICATION

let compteur = 0
/** Un identifiant de module, stable pour la duree du brouillon. */
const nouvelId = () => `mod-${Date.now().toString(36)}-${(compteur++).toString(36)}`

/** Une ligne de module vide, a completer. */
export function moduleVide() {
  return { id: nouvelId(), code: '', intitule: '' }
}

/** Les modules connus pour ce code de formation, ou une ligne vide. */
export function modulesInitiaux(code) {
  const c = certificationDe(code)
  if (!c) return [moduleVide()]
  return c.modules.map(([mc, intitule]) => ({ id: nouvelId(), code: mc, intitule }))
}

/**
 * Le type et les modules d'un brouillon qui commence, d'apres son code.
 * Une session du planning dont le code figure au catalogue est une
 * certification ; toute autre, une formation.
 */
export function typeDepuisCode(code) {
  return champsDeType(certificationDe(code) ? CERTIFICATION : FORMATION, code)
}

/** Les champs d'un brouillon du type choisi : une certification part des modules du catalogue. */
export function champsDeType(type, code) {
  return type === CERTIFICATION
    ? { type: CERTIFICATION, modules: modulesInitiaux(code) }
    : { type: FORMATION }
}

/** Le niveau affiche sur la fiche : celui du catalogue, ou le suffixe du code. */
export function niveauDe(b) {
  return certificationDe(b?.codeFormation)?.niveau
    || /-(G\d)\b/i.exec(b?.codeFormation || '')?.[1]?.toUpperCase() || ''
}

/** Le libelle d'un module : « G38001 : Décharge… ». */
export function libelleModule(m) {
  return [m?.code, m?.intitule].map(v => String(v || '').trim()).filter(Boolean).join(' : ')
}

const nombre = v => {
  if (v === '' || v == null) return null
  const n = Number(String(v).replace(',', '.'))
  return Number.isNaN(n) ? null : n
}
const arrondi = v => (v == null ? null : Math.round(v * 10) / 10)

/**
 * Les resultats d'un candidat.
 *
 * Le pourcentage n'existe qu'une fois toutes les notes saisies : sur
 * un module manquant, le classeur compterait zero et annoncerait un
 * echec qui n'en est pas un.
 */
export function calculerCertification(p, modules) {
  const liste = modules || []
  const notes = liste.map(m => nombre(p?.notesModules?.[m.id]))
  const saisies = notes.filter(n => n != null).length
  const complet = liste.length > 0 && saisies === liste.length
  const total = notes.reduce((t, n) => t + (n ?? 0), 0)
  const pourcentage = complet ? arrondi((100 * total) / (100 * liste.length)) : null
  const pratique = pourcentage == null ? null : pourcentage >= SEUIL ? VALIDE : ECHOUE

  const e = p?.elearning || {}
  const requis = nombre(e.requis)
  const valides = nombre(e.valides)
  const taux = requis ? Math.round((100 * (valides ?? 0)) / requis) : null
  const statut = STATUTS_ELEARNING.includes(e.statut) ? e.statut : null

  // Une pratique echouee suffit a conclure ; une pratique validee
  // attend le statut de l'e-learning.
  const final = pratique === ECHOUE ? NON_CERTIFIE
    : pratique === VALIDE && statut ? (statut === VALIDE ? CERTIFIE : NON_CERTIFIE)
      : null

  return {
    notes, saisies, complet, total, max: 100 * liste.length,
    pourcentage, pratique,
    elearning: { requis, valides, taux, statut },
    final,
    // Les noms communs aux deux sortes de compte rendu : les etapes qui
    // ne font que compter les notes saisies lisent les memes.
    scoreFinal: pourcentage,
    valide: pratique == null ? null : pratique === VALIDE,
  }
}

/** La synthese d'une certification : effectifs, reussite et modules. */
export function syntheseCertification(participants, modules) {
  const presents = (participants || []).filter(p => p.present !== false)
  const liste = modules || []
  const calculs = presents.map(p => calculerCertification(p, liste))
  const notes = calculs.filter(c => c.complet)
  const moyenne = v => (v.length ? arrondi(v.reduce((a, b) => a + b, 0) / v.length) : null)
  const enRetrait = notes.filter(c => c.pratique === ECHOUE).length
  const parModule = liste.map((m, i) => {
    const v = calculs.map(c => c.notes[i]).filter(n => n != null)
    return { module: m, moyenne: moyenne(v), sousSeuil: v.filter(n => n < SEUIL).length, saisies: v.length }
  })
  return {
    effectif: presents.length,
    saisis: notes.length,
    complet: presents.length > 0 && notes.length === presents.length,
    scoreFinal: moyenne(notes.map(c => c.pourcentage)),
    enRetrait,
    reussis: notes.length - enRetrait,
    tauxReussite: notes.length ? Math.round((100 * (notes.length - enRetrait)) / notes.length) : null,
    certifies: calculs.filter(c => c.final === CERTIFIE).length,
    elearningAFinir: calculs.filter(c => c.pratique === VALIDE && c.elearning.statut === NON_FINALISE).length,
    parModule,
    // Sans test d'entree, ni progression ni sortie theorique.
    entree: null, sortieTheorique: null, sortiePratique: null, progression: null,
  }
}

/** Le candidat a-t-il une note, meme partielle ? */
export function aDesNotesDeModules(p) {
  return Object.values(p?.notesModules || {}).some(v => String(v ?? '').trim() !== '')
}
