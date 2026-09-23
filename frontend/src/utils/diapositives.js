import { periodeLongue, titreDeCouverture } from './compteRendu'
import { DISPOSITIONS, dispositionsPour, rectanglesDe } from '../data/dispositions_photos'

/**
 * Le lien entre les pages de l'assistant et les diapositives du modele.
 *
 * L'assistant compose des pages ; le service d'apercu convertit des
 * diapositives numerotees du `MODELE-REFERENCES.pptx`. Cette table dit
 * laquelle montrer pour chaque page.
 *
 * Les valeurs, elles, sont les drapeaux du modele — les `{nom_complet}`
 * et consorts — que le service substitue avant de convertir. Un drapeau
 * sans valeur reste visible dans l'image : une page incomplete doit se
 * voir plutot que de s'effacer.
 */

/** La diapositive du modele qui correspond a chaque page composee. */
export const DIAPO_PAR_PAGE = {
  couverture: 1,
  objectifs: 9,
  participants: 4,
  deroule: 11,
  resultats: 17,
  satisfaction: 19,
  bilan: 20,
  fiches: 27,
  cloture: 28,
}

/**
 * Les pages des objectifs, une par forme.
 *
 * Des qu'il y a une photo, le modele passe au tableau avec sa colonne
 * d'images (9) ; sans photo, il pose une liste, dans le marquage choisi.
 */
const DIAPO_OBJECTIFS = { romain: 6, puces: 7, mixte: 8 }
const DIAPO_OBJECTIFS_IMAGES = 9

/** La page des objectifs qui correspond au brouillon. */
export function diapoObjectifs(brouillon) {
  const b = brouillon || {}
  if ((b.photos?.objectifs || []).length) return DIAPO_OBJECTIFS_IMAGES
  return DIAPO_OBJECTIFS[b.marquageObjectifs] ?? DIAPO_OBJECTIFS.puces
}

/** Le numero de diapositive d'une page, ou null si elle n'en a pas.
 *
 *  Deux familles de pages se repetent et portent donc une cle indexee :
 *  `jour-1`, `jour-2`... pour le deroule, `fiche-<id>` pour les fiches
 *  individuelles. Toutes partagent le gabarit de leur famille.
 *
 *  Les objectifs, eux, changent de page selon le brouillon.
 */
export function diapoDe(page, brouillon) {
  if (!page) return null
  const cle = page.cle || ''
  if (cle === 'objectifs') return diapoObjectifs(brouillon)
  if (cle.startsWith('jour-')) return DIAPO_PAR_PAGE.deroule
  if (cle.startsWith('fiche-')) return DIAPO_PAR_PAGE.fiches
  return DIAPO_PAR_PAGE[cle] ?? null
}

/**
 * Les phrases que la diapositive 17 pose sous ses deux graphiques.
 *
 * Elles doivent reprendre le run du modele mot pour mot, apostrophe
 * droite comprise : la substitution compare le texte entier.
 */
const PHRASE_PROGRESSION =
  "Nous pouvons constater que l'ensemble des participants avait un "
  + 'niveau théorique inferieur en arrivant à cette formation et '
  + "qu'ils ont progressé de [taux] %."
const PHRASE_ACQUISITION =
  '[n] participants sur [n] ont réussi à cette session de '
  + "formation. Pour un pourcentage d'acquisition de compétence "
  + 'de [taux] %.'

/**
 * Un champ volontairement vide.
 *
 * Le service laisse en place le drapeau d'une donnee manquante, pour
 * qu'une page incomplete se voie. Ce marqueur dit l'inverse : le champ
 * est vide parce qu'on l'a voulu, et le mot du modele doit disparaitre.
 * Il double `VIDE` dans `services/apercu/service.py`.
 */
export const VIDE = '∅'

/**
 * Les photos a poser, par numero de diapositive.
 *
 * `refsPhotos` associe chaque photo du brouillon a l'identifiant que le
 * service lui a donne a la reception. Une photo pas encore recue est
 * laissee de cote : l'apercu se refera quand elle le sera.
 */
function photosDesDiapos(b, refsPhotos) {
  const liste = b.photos?.objectifs || []
  if (!liste.length || diapoObjectifs(b) !== DIAPO_OBJECTIFS_IMAGES) return {}
  const d = DISPOSITIONS.find(x => x.id === b.dispositions?.objectifs
    && x.nombre === liste.length) || dispositionsPour(liste.length)[0]
  const cases = rectanglesDe(d)
  const posees = liste
    .map((p, i) => ({ id: refsPhotos?.[p.id], ...cases[i] }))
    .filter(p => p.id && p.l != null)
  return posees.length ? { [DIAPO_OBJECTIFS_IMAGES]: posees } : {}
}

/** Les drapeaux du modele, renseignes depuis le brouillon. */
export function valeursDrapeaux(brouillon, session, synthese, page, refsPhotos) {
  const b = brouillon || {}
  const t = b.textes || {}
  const periode = periodeLongue(b.debut, b.fin)
  // La page de couverture ecrit ses corrections sous « couverture.* ».
  // On les prefere aux valeurs de l'etape 1, sans quoi l'apercu et le
  // document afficheraient deux choses differentes.
  const couv = (cle, defaut) => {
    const v = t[`couverture.${cle}`]
    return v != null && v !== '' ? v : defaut
  }
  // Le titre n'est pas saisi : il se recompose depuis le code et
  // l'intitule, corriges sur la page ou repris de l'etape 1.
  const couvTitre = titreDeCouverture(
    couv('code', b.codeFormation || ''),
    couv('intitule', b.intitule || ''))
  // Un sous-titre laisse vide est un choix, pas un oubli : sans ce
  // marqueur, le service garderait le mot « Sous titre » du modele.
  const couvSousTitre = couv('sousTitre', '') || VIDE
  const couvPeriode = couv('periode', periode)
  const couvLieu = couv('lieu', b.lieu || '')
  return {
    // Les couvertures du modele portent des mots nus plutot que des
    // drapeaux entre accolades : le service les remplace quand le run
    // ne contient que le mot.
    // L'edition de la couverture prime sur l'etape 1 : ce que le
    // formateur a reecrit dans la page est ce qui part au document.
    Titre: couvTitre,
    'Sous titre': couvSousTitre,
    'Sous-titre': couvSousTitre,
    PERIODE: couvPeriode,
    periode: couvPeriode,
    lieu: couvLieu,

    '{titre}': couvTitre,
    '{sous_titre}': couvSousTitre,
    '{periode}': couvPeriode,
    '{lieu}': couvLieu,
    '{pays}': b.pays || '',
    '{nb_participants}': String((b.participants || []).length || ''),
    '{taux_progression}': synthese?.progression != null
      ? String(synthese.progression) : '',
    '{taux_acquis}': synthese?.acquis != null ? String(synthese.acquis) : '',
    '{bilan_contexte}': t.contexte || '',
    '{bilan_resultats}': t.resultats || '',
    '{bilan_vigilance}': t.vigilance || '',
    '{bilan_suites}': t.suites || '',
    '{objectifs}': t.objectifs || '',

    // Les pages des objectifs (6 a 9) : la session en tete du tableau,
    // puis un paragraphe par objectif, que le service repete autant de
    // fois qu'il y a d'elements.
    '{code_formation}': couv('code', b.codeFormation || ''),
    '{intitule_formation}': couv('intitule', b.intitule || ''),
    '{objectif_1}': objectifsDe(b),

    // Les deux constats de la diapositive 17 : le modele y pose des
    // phrases completes, pas des drapeaux. Le service substitue le run
    // entier quand son texte correspond a la phrase du gabarit.
    [PHRASE_PROGRESSION]: t['resultats.commentaireProgression'] || '',
    [PHRASE_ACQUISITION]: t['resultats.commentaireAcquisition'] || '',
    '{appréciation_formateur}': t.appreciation || '',

    // Les photos ne sont pas des drapeaux : le service les pose dans les
    // emplacements de la diapositive, selon la disposition retenue.
    '@photos': photosDesDiapos(b, refsPhotos),

    // La page courante, quand c'est une fiche, surcharge les drapeaux
    // communs : le modele repete la meme diapositive par stagiaire.
    ...drapeauxDeFiche(brouillon, page),
  }
}

/**
 * Les objectifs a poser, sous la forme qu'attend leur page.
 *
 * Une liste simple pour les puces, le romain et le tableau. En marquage
 * mixte sans photo, une ligne vide separe les groupes : la premiere
 * ligne de chacun en est le titre, les suivantes ses sous-objectifs —
 * c'est ainsi que l'editeur les numerote.
 *
 * Un brouillon anterieur a la saisie ligne a ligne n'a que le
 * paragraphe libre : on le redecoupe plutot que de laisser la page vide.
 */
function objectifsDe(b) {
  const lignes = (b.objectifs
    ? b.objectifs.map(o => o.texte || '')
    : String(b.textes?.['objectifs.objectifs'] ?? b.textes?.objectifs ?? '')
      .split(/\r?\n/)).map(l => l.trim())
  if (diapoObjectifs(b) !== DIAPO_OBJECTIFS.mixte) return lignes.filter(Boolean)
  const groupes = []
  lignes.forEach((l, i) => {
    if (!l) return
    if (i === 0 || !lignes[i - 1]) groupes.push({ texte: l, sous: [] })
    else groupes[groupes.length - 1].sous.push(l)
  })
  return groupes
}

/**
 * Les drapeaux propres a une fiche individuelle.
 *
 * La diapositive 27 ne laisse qu'une zone libre — l'appreciation de la
 * formation et de l'accueil — et porte le nom du stagiaire en titre.
 */
function drapeauxDeFiche(brouillon, page) {
  const cle = page?.cle || ''
  if (!cle.startsWith('fiche-')) return {}
  const id = cle.slice('fiche-'.length)
  const p = (brouillon?.participants || []).find(x => String(x.id) === id)
  const t = brouillon?.textes || {}
  return {
    '{nom_complet}': p ? `${p.prenom || ''} ${p.nom || ''}`.trim() : '',
    '{appréciation_formation_accueil}': t[`${cle}.appreciation`] || '',
  }
}
