import { periodeLongue } from './compteRendu'
import { seuilDe } from './baremeCfao'
import {
  calculerCertification, syntheseCertification, niveauDe, NON_FINALISE, VALIDE,
} from './certification'

/**
 * Les remarques d'une certification : les donnees du moteur de
 * redaction et les rubriques du bilan pre-remplies.
 *
 * Le bilan d'une certification ne parle ni de progression ni de test
 * d'entree : il dit combien de candidats valident la pratique, lesquels
 * restent en dessous, quels modules le groupe reussit ou manque, et ce
 * qu'il reste a faire en e-learning avant la certification definitive.
 */

const entier = v => (v == null ? null : Math.round(Number(v)))
const nomDe = p => [p.prenom, p.nom].filter(Boolean).join(' ').trim()
const presents = b => (b?.participants || []).filter(p => p.present !== false)

/** Les modules du plus reussi au moins reussi, sans ceux sans note. */
function modulesClasses(s) {
  return s.parModule.filter(m => m.moyenne != null)
    .sort((a, b) => b.moyenne - a.moyenne)
}

/** Ce qu'un candidat donne au moteur : ses notes, jamais un texte a reprendre. */
export function candidatPourMoteur(p, b) {
  const seuil = seuilDe(b)
  const c = calculerCertification(p, b?.modules, seuil)
  return {
    nom: p.nom || '',
    prenom: p.prenom || '',
    genre: p.genre || undefined,
    filiale: p.pays || '',
    niveau: niveauDe(b),
    seuil,
    pourcentage: entier(c.pourcentage),
    pratique: c.pratique,
    final: c.final,
    elearning: c.elearning,
    modules: (b?.modules || []).map((m, i) => ({
      code: m.code || '', intitule: m.intitule || '', note: c.notes[i],
    })).filter(m => m.note != null),
  }
}

/** Ce que le moteur recoit pour le bilan de la certification. */
export function donneesCertification(b, session) {
  const seuil = seuilDe(b)
  const s = syntheseCertification(b?.participants, b?.modules, seuil)
  const t = b?.textes || {}
  const classes = modulesClasses(s)
  return {
    intitule: t['couverture.intitule'] || b?.intitule || session?.moduleFormation || '',
    niveau: niveauDe(b),
    periode: periodeLongue(b?.debut, b?.fin),
    lieu: t['couverture.lieu'] || b?.lieu || session?.lieu || '',
    pays: b?.pays || '',
    seuil,
    effectif: s.saisis || null,
    reussis: s.saisis ? s.reussis : null,
    taux_reussite: s.tauxReussite,
    moyenne: entier(s.scoreFinal),
    certifies: s.certifies,
    elearning_a_finir: s.elearningAFinir,
    candidats: presents(b).map(p => {
      const c = calculerCertification(p, b?.modules, seuil)
      return { nom: nomDe(p), pourcentage: entier(c.pourcentage), pratique: c.pratique, final: c.final }
    }).filter(c => c.pourcentage != null),
    modules_forts: classes.slice(0, 3).filter(m => m.moyenne >= 85)
      .map(m => ({ intitule: m.module.intitule, moyenne: entier(m.moyenne) })),
    modules_faibles: classes.slice(-3).reverse().filter(m => m.moyenne < seuil + 10)
      .map(m => ({ intitule: m.module.intitule, moyenne: entier(m.moyenne), sous_seuil: m.sousSeuil })),
  }
}

/** Une liste lisible : « a, b et c ». */
function enumerer(v) {
  const l = v.filter(Boolean)
  return l.length > 1 ? `${l.slice(0, -1).join(', ')} et ${l[l.length - 1]}` : (l[0] || '')
}

/**
 * Les quatre rubriques du bilan, pre-remplies depuis les chiffres.
 * C'est ce que la page montre tant que rien n'est ecrit ni redige.
 */
export function rubriquesBilanCertification(b) {
  const seuil = seuilDe(b)
  const s = syntheseCertification(b?.participants, b?.modules, seuil)
  const d = donneesCertification(b)
  const periode = periodeLongue(b?.debut, b?.fin)
  const lieu = b?.pays ? ` au Centre CFAO ${b.pays}` : ''
  const contexte = s.effectif
    ? `La certification ${b.intitule || ''} s’est tenue ${periode}${lieu}, `
      + `avec ${s.effectif} candidat${s.effectif > 1 ? 's' : ''} évalué${s.effectif > 1 ? 's' : ''} `
      + `sur ${(b.modules || []).length} modules pratiques.`
    : ''
  const resultats = s.saisis
    ? `${s.reussis} candidat${s.reussis > 1 ? 's' : ''} sur ${s.saisis} `
      + `valide${s.reussis > 1 ? 'nt' : ''} la partie pratique, soit un taux de réussite de `
      + `${s.tauxReussite} % pour une moyenne de ${entier(s.scoreFinal)} %.`
      + (d.modules_forts.length
        ? ` Le groupe réussit particulièrement les modules ${enumerer(d.modules_forts.map(m => `« ${m.intitule} »`))}.`
        : '')
    : ''
  const faibles = d.modules_faibles.filter(m => m.moyenne < seuil)
  const vigilance = s.saisis
    ? [
      s.enRetrait
        ? `${s.enRetrait} candidat${s.enRetrait > 1 ? 's' : ''} reste${s.enRetrait > 1 ? 'nt' : ''} `
          + `sous le seuil de ${seuil} %.`
        : 'L’ensemble des candidats atteint le seuil de validation.',
      faibles.length
        ? `Les modules les moins réussis : ${enumerer(faibles.map(m => `« ${m.intitule} »`))}.`
        : '',
    ].filter(Boolean).join(' ')
    : ''
  const suites = s.saisis
    ? [
      s.enRetrait
        ? 'Un plan de remédiation individuel est recommandé pour les candidats en retrait, '
          + 'avant une nouvelle présentation à la certification.'
        : '',
      s.elearningAFinir
        ? `${s.elearningAFinir} candidat${s.elearningAFinir > 1 ? 's' : ''} doi${s.elearningAFinir > 1 ? 'vent' : 't'} `
          + 'encore finaliser le parcours e-learning pour obtenir la certification définitive.'
        : '',
      'La certification est obtenue lorsque la session pratique et le parcours e-learning sont validés.',
    ].filter(Boolean).join(' ')
    : ''
  return [
    { cle: 'contexte', titre: 'Contexte', texte: contexte },
    { cle: 'resultats', titre: 'Résultats', texte: resultats },
    { cle: 'vigilance', titre: 'Points de vigilance', texte: vigilance },
    { cle: 'suites', titre: 'Suites à donner', texte: suites },
  ]
}

/** Le statut e-learning d'un candidat, pour l'afficher. */
export function statutElearning(c) {
  if (c?.elearning?.statut === VALIDE) return VALIDE
  if (c?.elearning?.statut === NON_FINALISE) return NON_FINALISE
  return '—'
}
