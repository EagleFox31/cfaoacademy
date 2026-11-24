import { calculer, syntheseGroupe, SEUIL } from './baremeCfao'
import { satisfactionStagiaire, detailParCritere, CRITERES_FORMATION, CRITERES_ACCUEIL }
  from './satisfactionCfao'
import { periodeLongue } from './compteRendu'
import { estCertification } from './certification'
import { rubriquesBilanCertification } from './remarquesCertification'
import { adresse } from '../lib/adresse'

/**
 * Les remarques de session : les deux constats de la page des resultats
 * (diapositive 17) et les quatre rubriques du bilan (diapositive 20).
 *
 * Trois choses vivent ici, pour que l'editeur, l'apercu et le moteur de
 * redaction lisent les memes chiffres :
 *
 *   * les donnees transmises au moteur (`donneesSession`) ;
 *   * les textes par defaut, quand le formateur n'a rien ecrit ;
 *   * les valeurs des classeurs embarques des diapositives 17 et 19.
 */

const NOMBRES = ['zéro', 'un', 'deux', 'trois', 'quatre', 'cinq', 'six', 'sept', 'huit',
  'neuf', 'dix', 'onze', 'douze', 'treize', 'quatorze', 'quinze', 'seize', 'dix-sept',
  'dix-huit', 'dix-neuf', 'vingt']
const enMots = n => NOMBRES[n] ?? String(n)
const majuscule = t => (t ? t[0].toUpperCase() + t.slice(1) : t)
const entier = v => (v == null ? null : Math.round(Number(v)))

/** Les stagiaires presents. */
function presents(b) {
  return (b?.participants || []).filter(p => p.present !== false)
}

/** Les lignes d'une rubrique sur toutes les journees, sans doublon. */
function lignesDesJours(b, rubrique) {
  const vues = new Set()
  return Object.keys(b?.jours || {})
    .sort((x, y) => Number(x) - Number(y))
    .flatMap(n => b.jours[n]?.[rubrique] || [])
    .map(l => String(l).trim())
    .filter(l => l && !vues.has(l.toLowerCase()) && vues.add(l.toLowerCase()))
}

/** La satisfaction des seuls presents : un absent n'a rien evalue. */
export function satisfactionPresents(b) {
  const ids = new Set(presents(b).map(p => String(p.id)))
  return Object.fromEntries(Object.entries(b?.satisfaction || {})
    .filter(([id]) => ids.has(String(id))))
}

/** Les chiffres de la session, calcules une fois pour tous. */
export function chiffresSession(b) {
  const s = syntheseGroupe(b?.participants, b?.baremes)
  const reponses = satisfactionPresents(b)
  const sat = Object.values(reponses).map(satisfactionStagiaire)
  const moyenne = champ => {
    const v = sat.map(x => x[champ]).filter(x => x != null)
    return v.length ? v.reduce((t, x) => t + x, 0) / v.length : null
  }
  return {
    ...s,
    reussis: s.saisis - s.enRetrait,
    satFormation: moyenne('formation'),
    satAccueil: moyenne('accueil'),
    criteresFormation: detailParCritere(reponses, CRITERES_FORMATION),
    criteresAccueil: detailParCritere(reponses, CRITERES_ACCUEIL),
  }
}

/** Ce que le moteur de redaction recoit : des chiffres, jamais de texte a reprendre. */
export function donneesSession(b, session) {
  const c = chiffresSession(b)
  const t = b?.textes || {}
  const intitule = t['couverture.intitule'] || b?.intitule || session?.moduleFormation || ''
  return {
    intitule,
    periode: periodeLongue(b?.debut, b?.fin),
    lieu: t['couverture.lieu'] || b?.lieu || session?.lieu || '',
    seuil: SEUIL,
    effectif: c.saisis || null,
    reussis: c.saisis ? c.reussis : null,
    entree: entier(c.entree),
    sortie: entier(c.sortieTheorique),
    progression: entier(c.progression),
    taux: entier(c.scoreFinal),
    theorie: entier(c.sortieTheorique),
    pratique: entier(c.sortiePratique),
    sat_formation: entier(c.satFormation),
    sat_accueil: entier(c.satAccueil),
    participants: presents(b).map(p => {
      const k = calculer(p, b?.baremes)
      return {
        nom: [p.prenom, p.nom].filter(Boolean).join(' '),
        score: k.scoreFinal,
        progression: k.progression,
      }
    }),
    thematiques: lignesDesJours(b, 'thematiques'),
    forts: lignesDesJours(b, 'forts'),
    ameliorations: lignesDesJours(b, 'ameliorations'),
  }
}

/**
 * Les constats par defaut de la diapositive 17 : les phrases du modele,
 * chiffres poses. C'est ce que la page montre tant que le formateur n'a
 * ni ecrit ni fait rediger de remarque.
 */
export function constatsParDefaut(b) {
  const c = chiffresSession(b)
  return {
    commentaireProgression: c.progression == null ? ''
      : 'Nous pouvons constater que l’ensemble des participants avait un niveau '
        + 'théorique inférieur en arrivant à cette formation et qu’ils ont progressé '
        + `de ${entier(c.progression)} %.`,
    commentaireAcquisition: c.scoreFinal == null || !c.saisis ? ''
      : `${majuscule(enMots(c.reussis))} participant${c.reussis > 1 ? 's' : ''} `
        + `sur ${enMots(c.saisis)} ${c.reussis > 1 ? 'ont' : 'a'} réussi cette session `
        + 'de formation, pour un pourcentage d’acquisition de compétence de '
        + `${entier(c.scoreFinal)} %.`,
  }
}

/** Les quatre rubriques du bilan, pre-remplies depuis les chiffres. */
export function rubriquesBilan(b) {
  if (estCertification(b)) return rubriquesBilanCertification(b)
  const s = chiffresSession(b)
  const periode = periodeLongue(b?.debut, b?.fin)
  const lieu = b?.pays ? ` au Centre CFAO ${b.pays}` : ''
  const contexte = s.effectif
    ? `La formation ${b.intitule || ''} s’est tenue ${periode}${lieu}, `
      + `avec ${s.effectif} participant${s.effectif > 1 ? 's' : ''}.`
    : ''
  const resultats = s.scoreFinal != null
    ? `Le score moyen du groupe s’établit à ${entier(s.scoreFinal)} %`
      + (s.progression != null
        ? `, pour une progression de ${entier(s.progression)} %.`
        : '.')
    : ''
  const vigilance = s.saisis > 0
    ? (s.enRetrait === 0
      ? 'L’ensemble des participants atteint le seuil de validation.'
      : `${s.enRetrait} participant${s.enRetrait > 1 ? 's' : ''} sur ${s.saisis} `
        + `rest${s.enRetrait > 1 ? 'ent' : 'e'} sous le seuil de ${SEUIL} %.`)
    : ''
  const suites = s.enRetrait > 0
    ? 'La reprise des modules e-learning est recommandée pour les participants en retrait.'
    : 'La mise en pratique en atelier consolidera ces acquis.'
  return [
    { cle: 'contexte', titre: 'Contexte', texte: contexte },
    { cle: 'resultats', titre: 'Résultats et acquis', texte: resultats },
    { cle: 'vigilance', titre: 'Points de vigilance', texte: vigilance },
    { cle: 'suites', titre: 'Suites à donner', texte: s.saisis > 0 ? suites : '' },
  ]
}

/**
 * La forme du bilan : un paragraphe, comme dans les comptes rendus de
 * reference, ou les quatre rubriques de la diapositive. Le paragraphe
 * est la forme par defaut.
 */
export function formeBilan(textes) {
  return textes?.['bilan.forme'] === 'rubriques' ? 'rubriques' : 'paragraphe'
}

/**
 * Le bilan en un paragraphe : celui qu'a ecrit le formateur, ou a defaut
 * ses quatre rubriques mises bout a bout — passer d'une forme a l'autre
 * ne perd rien de ce qui a ete saisi.
 */
export function paragrapheBilan(textes, rubriques) {
  const saisi = textes?.['bilan.paragraphe']
  if (saisi != null) return saisi
  return (rubriques || [])
    .map(r => String(textes?.[`bilan.${r.cle}`] ?? r.texte ?? '').trim())
    .filter(Boolean).join(' ')
}

/**
 * Les valeurs des classeurs embarques, en fractions comme Excel les
 * tient. Le service reconnait chaque classeur a son titre et pose ces
 * valeurs dans ses cellules, puis redessine l'objet.
 */
export function valeursClasseurs(b) {
  const c = chiffresSession(b)
  const f = v => (v == null ? null : Math.round(Number(v)) / 100)
  const complement = v => (v == null ? null : Math.round((1 - v) * 100) / 100)
  const sat = {}
  c.criteresFormation.forEach((k, i) => { sat[`B${2 + i}`] = f(k.moyenne) })
  sat.B9 = f(c.satFormation)
  sat.C9 = complement(sat.B9)
  c.criteresAccueil.forEach((k, i) => { sat[`B${12 + i}`] = f(k.moyenne) })
  sat.B18 = f(c.satAccueil)
  sat.C18 = complement(sat.B18)
  return {
    progression: { B2: f(c.entree), B3: f(c.sortieTheorique), B4: f(c.progression) },
    acquisition: { B2: f(c.sortieTheorique), B3: f(c.sortiePratique), B4: f(c.scoreFinal) },
    satisfaction: sat,
  }
}

/**
 * Les valeurs des classeurs d'une fiche individuelle (diapositive 27) :
 * les memes calculs, restreints au seul stagiaire.
 */
export function valeursClasseursStagiaire(b, id) {
  const p = (b?.participants || []).find(x => String(x.id) === String(id))
  if (!p) return valeursClasseurs(b)
  const reponses = b?.satisfaction?.[p.id] ?? b?.satisfaction?.[String(p.id)]
  return valeursClasseurs({
    ...b,
    participants: [{ ...p, present: true }],
    satisfaction: reponses ? { [p.id]: reponses } : {},
  })
}

/**
 * Une remarque du moteur. Chaque appel tire une graine nouvelle : deux
 * clics sur « Autre proposition » donnent deux textes differents.
 *
 * Renvoie le texte (ou les rubriques du bilan), ou `null` si le service
 * ne repond pas — la saisie manuelle reste alors le chemin normal.
 */
export async function redigerRemarque(type, donnees, rubrique) {
  try {
    const reponse = await fetch(adresse('/apercu/redaction'), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type, session: donnees, rubrique,
        graine: Math.floor(Math.random() * 2 ** 31),
      }),
    })
    if (!reponse.ok) return null
    const sortie = await reponse.json()
    return type.startsWith('bilan') ? sortie?.rubriques || null : sortie?.texte || null
  } catch {
    return null
  }
}
