import { periodeLongue, titreDeCouverture } from './compteRendu'
import { DISPOSITIONS, dispositionsPour, rectanglesDe } from '../data/dispositions_photos'
import {
  constatsParDefaut, rubriquesBilan, valeursClasseurs, valeursClasseursStagiaire,
} from './remarquesSession'

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

/**
 * Les pages jour alternent, comme dans le modele : texte a gauche et
 * photos a droite les jours impairs (11), l'inverse les jours pairs (13).
 */
const DIAPOS_JOUR = [DIAPO_PAR_PAGE.deroule, 13]
export const diapoJour = n => DIAPOS_JOUR[(Math.max(n, 1) - 1) % DIAPOS_JOUR.length]
const numeroJour = cle => Number(/^jour-(\d+)$/.exec(cle || '')?.[1]) || null

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
  if (cle.startsWith('jour-')) return diapoJour(numeroJour(cle))
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
function photosDesDiapos(b, refsPhotos, page) {
  const poses = {}
  if (diapoObjectifs(b) === DIAPO_OBJECTIFS_IMAGES) {
    const objectifs = photosPosees(b, 'objectifs', refsPhotos)
    if (objectifs.length) poses[DIAPO_OBJECTIFS_IMAGES] = objectifs
  }
  const bilan = photosPosees(b, 'bilan', refsPhotos)
  if (bilan.length) poses[DIAPO_PAR_PAGE.bilan] = bilan
  const jour = numeroJour(page?.cle)
  if (jour) {
    const photos = photosPosees(b, page.cle, refsPhotos)
    if (photos.length) poses[diapoJour(jour)] = photos
  }
  return poses
}

/** La disposition retenue pour une rubrique, ou la premiere possible. */
function dispositionDe(b, rubrique) {
  const n = (b.photos?.[rubrique] || []).length
  return DISPOSITIONS.find(x => x.id === b.dispositions?.[rubrique] && x.nombre === n)
    || dispositionsPour(n)[0]
}

/** Les photos d'une rubrique, placees selon sa disposition. */
function photosPosees(b, rubrique, refsPhotos) {
  const liste = b.photos?.[rubrique] || []
  if (!liste.length) return []
  const d = dispositionDe(b, rubrique)
  const cases = rectanglesDe(d)
  return liste
    .map((p, i) => ({
      id: refsPhotos?.[p.id],
      ...cases[i],
      ...(p.cadrage ? { cadrage: p.cadrage } : {}),
      // Une disposition legendee reserve sa bande meme a une legende
      // vide : la photo garde la taille que l'editeur lui montre.
      ...(d.legendes ? { legende: p.legende || '' } : {}),
    }))
    .filter(p => p.id && p.l != null)
}

/**
 * Les drapeaux d'une page jour : son numero, ses trois rubriques en
 * listes, que le service repete une puce par ligne, et la legende
 * commune.
 *
 * La legende commune est facultative : vide, elle s'efface plutot que
 * de laisser son drapeau. Une disposition legendee photo par photo
 * l'efface aussi, le service donnant sa place au cadre.
 */
function drapeauxDeJour(b, page) {
  const n = numeroJour(page?.cle)
  if (!n) return {}
  const j = b.jours?.[n] || {}
  const lignes = cle => (j[cle] || []).map(l => String(l).trim()).filter(Boolean)
  const parImage = !!dispositionDe(b, page.cle)?.legendes
    && (b.photos?.[page.cle] || []).length > 0
  const commune = parImage ? '' : String(b.legendes?.[page.cle] || '').trim()
  return {
    '{jour_numero}': String(n),
    '{jour_thematique}': lignes('thematiques'),
    '{jour_fort}': lignes('forts'),
    '{jour_amelioration}': lignes('ameliorations'),
    '{jour_legende}': commune || VIDE,
  }
}

/** Les formateurs saisis, ou a defaut celui de la session. */
function formateursDe(b, session) {
  const saisis = (b.formateurs || []).filter(f => f.nom || f.fonction || f.portrait)
  if (saisis.length) return saisis
  return session?.formateur ? [{ nom: session.formateur, fonction: 'Formateur' }] : []
}

/**
 * Les formateurs de la page des participants.
 *
 * Le modele n'a qu'un bloc portrait + nom ; le service le repete, une
 * copie par formateur, cote a cote.
 */
function formateurDe(b, session) {
  return {
    '@formateurs': formateursDe(b, session).map(f => ({
      '{formateur_nom}': f.nom || '',
      '{formateur_fonction}': f.fonction || '',
    })),
  }
}

/** Les stagiaires presents, une ligne chacun : nom complet et pays. */
function lignesStagiaires(b) {
  return (b.participants || [])
    .filter(p => p.present !== false)
    .map(p => ({
      '{stagiaire_nom}': [p.prenom, p.nom].filter(Boolean).join(' '),
      '{stagiaire_pays}': p.pays || '',
    }))
    .filter(l => l['{stagiaire_nom}'])
}

/** Le portrait et la photo de groupe, chacun dans son emplacement. */
function photosParticipants(b, refsPhotos) {
  const poses = {}
  const pose = (nom, photo) => {
    const id = photo && refsPhotos?.[photo.id]
    if (id) poses[nom] = { id, ...(photo.cadrage ? { cadrage: photo.cadrage } : {}) }
  }
  // Chaque copie du bloc formateur numerote son emplacement.
  formateursDe(b).forEach((f, i) => pose(`Emplacement portrait ${i + 1}`, f.portrait))
  pose('Emplacement groupe', b.photoGroupe)
  return Object.keys(poses).length ? { [DIAPO_PAR_PAGE.participants]: poses } : {}
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
    ...drapeauxBilan(b),
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
    // Sans remarque saisie, la phrase du modele porte les chiffres.
    [PHRASE_PROGRESSION]: t['resultats.commentaireProgression']
      || constatsParDefaut(b).commentaireProgression,
    [PHRASE_ACQUISITION]: t['resultats.commentaireAcquisition']
      || constatsParDefaut(b).commentaireAcquisition,

    // Le pied de page des pages de resultats et du bilan.
    '{intitulé_formation}': couv('intitule', b.intitule || ''),
    '{date_début}': dateCourte(b.debut),
    '{date_fin}': dateCourte(b.fin),

    // Les tableaux et graphiques des diapositives 17 et 19 : des classeurs
    // embarques, que le service remplit puis redessine.
    '@classeurs': valeursClasseurs(b),
    '{appréciation_formateur}': t.appreciation || '',

    // Les photos ne sont pas des drapeaux : le service les pose dans les
    // emplacements de la diapositive, selon la disposition retenue.
    '@photos': { ...photosDesDiapos(b, refsPhotos, page), ...photosParticipants(b, refsPhotos) },

    // La page des participants : le formateur, puis une ligne de tableau
    // par stagiaire present, que le service repete.
    ...formateurDe(b, session),
    '@lignes': { '{stagiaire_nom}': lignesStagiaires(b) },

    // La page courante, quand c'est une fiche, surcharge les drapeaux
    // communs : le modele repete la meme diapositive par stagiaire.
    ...drapeauxDeFiche(brouillon, page),
    ...drapeauxDeJour(b, page),
  }
}

/** Une date du pied de page : « 07/09/2026 ». */
function dateCourte(iso) {
  if (!iso) return ''
  const [a, m, j] = String(iso).split('-')
  return j && m && a ? `${j}/${m}/${a}` : ''
}

/**
 * Les quatre rubriques du bilan (diapositive 20).
 *
 * Ce que le formateur a ecrit prime ; a defaut, le pre-remplissage que
 * l'editeur lui montre. Une rubrique videe a dessein disparait de la
 * page au lieu de laisser son drapeau.
 */
function drapeauxBilan(b) {
  const t = b.textes || {}
  return Object.fromEntries(rubriquesBilan(b).map(r => {
    const saisi = t[`bilan.${r.cle}`]
    const valeur = saisi == null ? r.texte : saisi
    return [`{bilan_${r.cle}}`, String(valeur || '').trim() || VIDE]
  }))
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
    // Les tableaux et graphiques de la fiche : les chiffres du stagiaire,
    // pas ceux du groupe.
    '@classeurs': valeursClasseursStagiaire(brouillon, id),
  }
}
