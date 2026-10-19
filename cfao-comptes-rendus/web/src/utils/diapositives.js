import { periodeLongue, titreDeCouverture } from './compteRendu'
import {
  DISPOSITIONS, dispositionsPour, idDisposition, modeLegende, rectanglesDe,
} from '../data/dispositions_photos'
import {
  constatsParDefaut, formeBilan, paragrapheBilan, rubriquesBilan, valeursClasseurs,
  valeursClasseursStagiaire,
} from './remarquesSession'
import {
  CERTIFIE, ECHOUE, NON_CERTIFIE, NON_FINALISE, VALIDE,
  calculerCertification, estCertification, niveauDe,
} from './certification'
import { SEUIL } from './baremeCfao'

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
/** La fiche d'un candidat de certification : e-learning, modules, resultat final. */
export const DIAPO_FICHE_CERTIFICATION = 26

const DIAPO_OBJECTIFS = { romain: 6, puces: 7, mixte: 8 }
const DIAPO_OBJECTIFS_IMAGES = 9

/** La page des objectifs qui correspond au brouillon. */
export function diapoObjectifs(brouillon) {
  const b = brouillon || {}
  if ((b.photos?.objectifs || []).length) return DIAPO_OBJECTIFS_IMAGES
  return DIAPO_OBJECTIFS[b.marquageObjectifs] ?? DIAPO_OBJECTIFS.puces
}

/**
 * Toutes les pages jour suivent le meme sens : texte a gauche, photos a
 * droite (11). L'alternance du modele (13 les jours pairs) a ete refusee.
 */
export const diapoJour = () => DIAPO_PAR_PAGE.deroule
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
  if (cle.startsWith('fiche-')) {
    return estCertification(brouillon) ? DIAPO_FICHE_CERTIFICATION : DIAPO_PAR_PAGE.fiches
  }
  return DIAPO_PAR_PAGE[cle] ?? null
}

/**
 * Les intercalaires du modele : la page qui annonce chaque section du
 * rapport. Le modele les numerote de 1 a 5 ; une section ecartee ne
 * laisse pas de trou, les suivantes prennent le numero libre.
 *
 * L'intercalaire des resultats individuels liste les stagiaires : il
 * reprend le tableau `{stagiaire_nom}` de la premiere fiche.
 */
const INTERCALAIRES = [
  { diapo: 3, numero: '1', ouvre: cle => cle === 'participants' },
  { diapo: 5, numero: '2', ouvre: cle => cle === 'objectifs' },
  { diapo: 10, numero: '3', ouvre: cle => cle.startsWith('jour-') },
  { diapo: 16, numero: '4', ouvre: cle => ['resultats', 'satisfaction', 'bilan'].includes(cle) },
  { diapo: 25, numero: '5', ouvre: cle => cle.startsWith('fiche-'), tableau: '{stagiaire_nom}' },
]

/** Les pages du rapport (`[{cle, diapo, valeurs}]`), chaque section precedee de son intercalaire. */
export function avecIntercalaires(pages) {
  const poses = new Set()
  const sortie = []
  for (const page of pages) {
    const section = INTERCALAIRES.find(s => s.ouvre(page.cle || ''))
    if (section && !poses.has(section)) {
      poses.add(section)
      const valeurs = { [section.numero]: String(poses.size) }
      const lignes = section.tableau && page.valeurs?.['@lignes']?.[section.tableau]
      if (lignes) valeurs['@lignes'] = { [section.tableau]: lignes }
      sortie.push({ cle: `intercalaire-${section.diapo}`, diapo: section.diapo, valeurs })
    }
    sortie.push(page)
  }
  return sortie
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
 * Il double `VIDE` dans `cfao-comptes-rendus/api/rendu/service.py`.
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
    if (objectifs) poses[DIAPO_OBJECTIFS_IMAGES] = objectifs
  }
  const bilan = photosPosees(b, 'bilan', refsPhotos)
  if (bilan) poses[DIAPO_PAR_PAGE.bilan] = bilan
  const jour = numeroJour(page?.cle)
  if (jour) {
    const photos = photosPosees(b, page.cle, refsPhotos)
    if (photos) poses[diapoJour(jour)] = photos
  }
  return poses
}

/** La disposition retenue pour une rubrique, ou la premiere possible. */
function dispositionDe(b, rubrique) {
  const n = (b.photos?.[rubrique] || []).length
  const id = idDisposition(b.dispositions?.[rubrique])
  return DISPOSITIONS.find(x => x.id === id && x.nombre === n)
    || dispositionsPour(n)[0]
}

/**
 * Les photos d'une rubrique, placees selon sa disposition, avec leur
 * mode de legende : `{ photos, legendes, commune }`, ou `null` sans
 * photo prete.
 *
 * `legendes` vaut `aucune` (les photos prennent tout le cadre),
 * `chaque` (une bande sous chaque photo, reservee meme vide : la photo
 * garde la taille que l'editeur lui montre) ou `commune` (une bande
 * sous l'ensemble, portant `commune`).
 */
function photosPosees(b, rubrique, refsPhotos) {
  const liste = b.photos?.[rubrique] || []
  if (!liste.length) return null
  const d = dispositionDe(b, rubrique)
  const mode = modeLegende(b, rubrique)
  const commune = String(b.legendes?.[rubrique] || '').trim()
  const cases = rectanglesDe(d)
  const photos = liste
    .map((p, i) => ({
      id: refsPhotos?.[p.id],
      ...cases[i],
      ...(p.cadrage ? { cadrage: p.cadrage } : {}),
      // Une photo seule « avec legende » reprend, a defaut de la sienne,
      // une legende commune saisie avant.
      ...(mode === 'chaque' ? { legende: p.legende || (liste.length === 1 ? commune : '') } : {}),
    }))
    .filter(p => p.id && p.l != null)
  return photos.length ? { photos, legendes: mode, commune } : null
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
  const commune = modeLegende(b, page.cle) === 'commune'
    ? String(b.legendes?.[page.cle] || '').trim() : ''
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
    // Une certification reprend les pages du modele sous son nom.
    ...motsCertification(b),

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
    ...formuleCertification(b),
    '{objectifs}': t.objectifs || '',

    // Les pages des objectifs (6 a 9) : la session en tete du tableau,
    // puis un paragraphe par objectif, que le service repete autant de
    // fois qu'il y a d'elements.
    '{code_formation}': couv('code', b.codeFormation || ''),
    '{intitule_formation}': couv('intitule', b.intitule || ''),
    '{objectif_1}': objectifsDe(b),
    // La page a photos numerote aussi ses objectifs selon ce choix.
    '@marquage': b.marquageObjectifs || 'puces',

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
    ...(estCertification(b) ? drapeauxDeFicheCertification(b, page) : drapeauxDeFiche(brouillon, page)),
    ...drapeauxDeJour(b, page),
  }
}

/**
 * Les titres du modele, au nom de la certification.
 *
 * Ils sont ecrits en toutes lettres dans le modele, chacun seul dans son
 * run : le service remplace un run dont le texte entier correspond. Les
 * pages jour portent leur numero, d'ou une entree par jour.
 */
function motsCertification(b) {
  if (!estCertification(b)) return {}
  const jours = Object.fromEntries(Array.from({ length: 10 }, (_, i) => [
    `${i + 1}° jour de formation`, `${i + 1}° jour de certification`]))
  return {
    'COMPTE RENDU DE FORMATION': 'COMPTE RENDU DE CERTIFICATION',
    'objectifs DE LA FORMATION': 'objectifs DE LA CERTIFICATION',
    'Détail journalier DE LA FORMATION': 'Détail journalier DE LA CERTIFICATION',
    'Bilan de la formation': 'Bilan de la certification',
    'RESULTAT INDIVIDUEL DE FORMATION :': 'RÉSULTAT INDIVIDUEL DE LA CERTIFICATION : ',
    ...jours,
  }
}

/**
 * Les drapeaux d'une fiche de certification (diapositive 26).
 *
 * Le tableau suit les rapports de reference : la filiale en tete, une
 * ligne « code: intitule / 100 » par module, que le service repete en
 * resserrant le tableau si la place manque, puis le total, le
 * pourcentage et le resultat de la session pratique. Une note sous le
 * seuil passe au rouge.
 */
function drapeauxDeFicheCertification(b, page) {
  const cle = page?.cle || ''
  if (!cle.startsWith('fiche-')) return {}
  const id = cle.slice('fiche-'.length)
  const p = (b.participants || []).find(x => String(x.id) === id)
  if (!p) return {}
  const c = calculerCertification(p, b.modules)
  const e = c.elearning
  const texte = v => (v == null ? '' : String(v))
  const niveau = niveauDe(b)
  return {
    '{nom_complet}': `${p.prenom || ''} ${p.nom || ''}`.trim(),
    '{niveau}': niveau || VIDE,
    '{filiale}': ['CFAO MOBILITY', p.pays || b.pays].filter(Boolean).join(' ').toUpperCase(),
    '{total_points}': c.complet ? texte(c.total) : '',
    '{total_max}': texte(c.max),
    '{pourcentage}': c.pourcentage == null ? '' : String(Math.round(c.pourcentage)),
    '{modules_requis}': texte(e.requis),
    '{modules_valides}': texte(e.valides),
    '{taux_participation}': texte(e.taux),
    '{statut_elearning}': e.statut || '',
    '{resultat_pratique}': c.pratique || '',
    '{resultat_final}': c.final || '',
    '{appréciation_formateur}': b.textes?.[`${cle}.appreciation`] || '',
    // Le code couleur des rapports de certification : vert quand c'est
    // acquis, rouge sinon ; le service recolore les cases de ces drapeaux.
    '@couleurs': Object.fromEntries([
      ['{resultat_pratique}', c.pratique, VALIDE, ECHOUE],
      ['{pourcentage}', c.pratique, VALIDE, ECHOUE],
      ['{statut_elearning}', e.statut, VALIDE, NON_FINALISE],
      ['{resultat_final}', c.final, CERTIFIE, NON_CERTIFIE],
    ].filter(([, v, ok, ko]) => v === ok || v === ko)
      .map(([drapeau, v, ok]) => [drapeau, v === ok ? 'ok' : 'ko'])),
    // Le tableau descend dans la place libre avant de resserrer ses lignes.
    '@etendre': ['{code_module_1}'],
    '@lignes': {
      '{stagiaire_nom}': lignesStagiaires(b),
      '{code_module_1}': (b.modules || []).map((m, i) => ({
        '{code_module_1}': m.code || '',
        '{intitule_module_1}': m.intitule || '',
        '{note_1}': texte(c.notes[i]),
        '@couleurs': c.notes[i] != null && c.notes[i] < SEUIL ? { '{note_1}': 'alerte' } : {},
      })),
    },
  }
}

/** Une date du pied de page : « 07/09/2026 ». */
function dateCourte(iso) {
  if (!iso) return ''
  const [a, m, j] = String(iso).split('-')
  return j && m && a ? `${j}/${m}/${a}` : ''
}

/**
 * La formule des comptes rendus de certification, sous le bilan : tests
 * e-learning + tests pratique = certification. Le service la dessine
 * sur la page du bilan seulement ; la formation n'en a pas.
 */
export function formuleCertification(b) {
  if (!estCertification(b)) return {}
  const marque = String(b.marque || '').trim().toUpperCase()
  return {
    '@formule_certification': `Nous rappelons que la certification${marque ? ` ${marque}` : ''} `
      + 'pour chacun des niveaux est obtenue de la façon suivante :',
  }
}

/** Les intertitres des rubriques du bilan, tels que le modele les ecrit. */
const INTERTITRES_BILAN = [
  'Contexte et appréciation', 'Résultats et acquis', 'Points de vigilance', 'Suites à donner',
]

/**
 * Les quatre rubriques du bilan (diapositive 20).
 *
 * Ce que le formateur a ecrit prime ; a defaut, le pre-remplissage que
 * l'editeur lui montre. Une rubrique videe a dessein disparait de la
 * page au lieu de laisser son drapeau.
 *
 * En un paragraphe, le texte prend la place de la premiere rubrique ; les
 * intertitres et les trois autres drapeaux sont retires de la page.
 */
function drapeauxBilan(b) {
  const t = b.textes || {}
  if (formeBilan(t) === 'paragraphe') {
    return {
      '{bilan_contexte}': paragrapheBilan(t, rubriquesBilan(b)).trim() || VIDE,
      '@retirer_paragraphes': [...INTERTITRES_BILAN,
        '{bilan_resultats}', '{bilan_vigilance}', '{bilan_suites}'],
    }
  }
  return Object.fromEntries(rubriquesBilan(b).map(r => {
    const saisi = t[`bilan.${r.cle}`]
    const valeur = saisi == null ? r.texte : saisi
    return [`{bilan_${r.cle}}`, String(valeur || '').trim() || VIDE]
  }))
}

/**
 * Les objectifs a poser, sous la forme qu'attend leur page.
 *
 * Une liste simple pour les puces et le romain. En marquage mixte, avec
 * ou sans photo, une ligne vide separe les groupes : la premiere
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
  if (b.marquageObjectifs !== 'mixte') return lignes.filter(Boolean)
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
