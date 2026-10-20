/**
 * Les mises en page de photos du modele CFAO.
 *
 * Relevees sur les emplacements photo du `MODELE-REFERENCES.pptx` —
 * diapositives 9, 12 a 15 et 21 a 24 — et non inventees : chaque entree
 * reproduit une disposition que le modele propose deja, avec ses
 * proportions.
 *
 * Toutes tiennent en deux rangees. La premiere porte l'image mise en
 * avant, la seconde les images secondaires ; `poidsRangees` dit comment
 * la hauteur se partage entre les deux, tel que le modele la partage.
 *
 * Les proportions sont donnees en fractions du cadre reserve aux
 * photos, pas de la diapositive : une disposition se pose aussi bien
 * dans la colonne de droite d'une page d'objectifs que sur la pleine
 * largeur d'une page de deroule.
 */

/**
 * @typedef {object} Disposition
 * @property {string} id
 * @property {string} nom
 * @property {number} nombre       photos attendues
 * @property {number[]} poidsRangees  partage vertical, haut puis bas
 * @property {number[][]} rangees  nombre de colonnes par rangee
 * @property {number} ratio        rapport largeur/hauteur du cadre
 * @property {string} source       diapositive du modele d'ou elle vient
 * @property {number} [colonnes]   grille plus fine que les rangees, pour
 *                                 les images qui ne s'alignent pas
 * @property {number[][]} [places] colonnes [debut, fin] de chaque image,
 *                                 dans l'ordre ; prime sur le partage egal
 */

/** Le repertoire, du plus simple au plus fourni. */
export const DISPOSITIONS = [
  {
    id: 'une',
    nom: 'Pleine hauteur',
    nombre: 1,
    poidsRangees: [1],
    rangees: [[1]],
    ratio: 1.17,
    source: 'slide5',
    note: 'Une image occupe tout le cadre',
  },
  {
    id: 'deux-empilees',
    nom: 'Superposées',
    nombre: 2,
    poidsRangees: [1, 1],
    rangees: [[1], [1]],
    ratio: 1.08,
    source: 'slide21',
    note: 'Deux images à égalité, l’une sur l’autre',
  },
  {
    id: 'deux-cote',
    nom: 'Côte à côte',
    nombre: 2,
    poidsRangees: [1],
    rangees: [[1, 1]],
    ratio: 1.08,
    source: 'relevé des comptes rendus',
    note: 'Deux images de même largeur',
  },
  {
    id: 'deux-decalees',
    nom: 'En escalier',
    nombre: 2,
    poidsRangees: [1, 1],
    rangees: [[1], [1]],
    colonnes: 6,
    places: [[1, 6], [2, 7]],
    ratio: 1.21,
    source: 'slide9',
    note: 'Deux images décalées, l’une sous l’autre',
  },
  {
    id: 'trois-une-deux',
    nom: 'Une grande, deux petites',
    nombre: 3,
    poidsRangees: [1.57, 1],
    rangees: [[1], [1, 1]],
    ratio: 1.17,
    source: 'slide13',
    note: 'La première domine, deux la soutiennent',
  },
  {
    id: 'trois-deux-une',
    nom: 'Deux petites, une grande',
    nombre: 3,
    poidsRangees: [1, 1],
    rangees: [[1, 1], [1]],
    ratio: 1.08,
    source: 'slide22',
    note: 'Deux images puis une pleine largeur',
  },
  {
    id: 'quatre-grille',
    nom: 'Quadrillage',
    nombre: 4,
    poidsRangees: [1, 1],
    rangees: [[1, 1], [1, 1]],
    ratio: 1.17,
    source: 'slide14',
    note: 'Quatre images à égalité',
  },
  {
    id: 'quatre-une-trois',
    nom: 'Une grande, trois petites',
    nombre: 4,
    poidsRangees: [1.57, 1],
    rangees: [[1], [1, 1, 1]],
    ratio: 1.17,
    source: 'slide15',
    note: 'La première domine, trois la soutiennent',
  },
  {
    id: 'cinq-une-quatre',
    nom: 'Une grande, quatre petites',
    nombre: 5,
    poidsRangees: [2.77, 1],
    rangees: [[1], [1, 1, 1, 1]],
    ratio: 1.08,
    source: 'slide24',
    note: 'La première domine, quatre en bandeau',
  },
]

/**
 * Les anciennes dispositions « legendees » : la legende est devenue un
 * choix a part (`MODES_LEGENDE`). Un brouillon qui en avait retenu une
 * retrouve sa disposition, avec une legende par photo.
 */
const ANCIENNES_LEGENDEES = {
  'deux-empilees-legendees': 'deux-empilees',
  'trois-une-deux-legendees': 'trois-une-deux',
  'quatre-grille-legendee': 'quatre-grille',
  'quatre-une-trois-legendees': 'quatre-une-trois',
}

/** L'identifiant actuel d'une disposition enregistree. */
export const idDisposition = id => ANCIENNES_LEGENDEES[id] || id || null

/**
 * Les legendes des photos, choisies a part de la disposition : toute
 * disposition existe sans legende, avec une legende sous chaque photo,
 * ou avec une legende commune sous l'ensemble. Pour une seule photo,
 * les deux dernieres reviennent au meme : « avec legende ».
 */
export const MODES_LEGENDE = [
  { id: 'aucune', nom: 'Sans légende', note: 'Les photos prennent toute la place' },
  { id: 'chaque', nom: 'Une par photo', note: 'Une légende sous chaque photo' },
  { id: 'commune', nom: 'Une pour toutes', note: 'Une seule légende sous l’ensemble' },
]

/** Les modes proposes pour un nombre de photos. */
export function modesLegendePour(nombre) {
  if (nombre > 1) return MODES_LEGENDE
  return [MODES_LEGENDE[0], { ...MODES_LEGENDE[1], nom: 'Avec légende', note: 'Une légende sous la photo' }]
}

/**
 * Le mode de legende d'une rubrique. Choisi, il prime ; sinon on le
 * deduit de l'ancien brouillon : disposition legendee, legende commune
 * deja saisie, ou rien. Une seule photo n'a pas de legende « commune ».
 */
export function modeLegende(b, rubrique) {
  const n = (b?.photos?.[rubrique] || []).length
  let mode = b?.modesLegende?.[rubrique]
  if (!mode) {
    if (ANCIENNES_LEGENDEES[b?.dispositions?.[rubrique]]) mode = 'chaque'
    else mode = String(b?.legendes?.[rubrique] || '').trim() ? 'commune' : 'aucune'
  }
  return n <= 1 && mode === 'commune' ? 'chaque' : mode
}

/**
 * Les dispositions possibles pour un nombre de photos.
 *
 * Aucune au-dela de cinq : le modele n'en propose pas, et repartir
 * davantage d'images dans le meme cadre les rendrait illisibles.
 */
export function dispositionsPour(nombre) {
  return DISPOSITIONS.filter(d => d.nombre === nombre)
}

/** Le nombre de photos le plus eleve que le repertoire sache poser. */
export const MAX_PHOTOS = Math.max(...DISPOSITIONS.map(d => d.nombre))

/**
 * Le repertoire entier, les dispositions utilisables en tete.
 *
 * On montre tout pour que le formateur sache ce qui existe, mais ce
 * qu'il peut choisir tout de suite vient en premier : sans cela, avec
 * une seule photo, la seule disposition active se retrouve noyee au
 * milieu de huit vignettes eteintes.
 */
export function dispositionsClassees(nombre) {
  const utilisable = d => d.nombre === nombre
  return [...DISPOSITIONS].sort((a, b) => utilisable(b) - utilisable(a))
}

/** Les colonnes de la grille : fixees, ou celles de la rangee la plus fournie. */
function colonnesDe(d) {
  return d.colonnes || Math.max(...d.rangees.map(r => r.length))
}

/**
 * La grille CSS d'une disposition.
 *
 * Les rangees reprennent `poidsRangees`, les colonnes le nombre de
 * cases de la rangee la plus fournie : chaque case declare ensuite la
 * portion qu'elle occupe.
 */
export function grilleDe(d) {
  if (!d) return { gridTemplateColumns: '1fr' }
  const colonnes = colonnesDe(d)
  return {
    gridTemplateColumns: `repeat(${colonnes}, 1fr)`,
    gridTemplateRows: d.poidsRangees.map(p => `${p}fr`).join(' '),
  }
}

/** Chaque photo : sa rangee et ses lignes de colonne [debut, fin[. */
function placesDe(d) {
  const colonnes = colonnesDe(d)
  const places = []
  d.rangees.forEach((rangee, r) => {
    const largeur = colonnes / rangee.length
    rangee.forEach((_, c) => {
      const fixee = d.places?.[places.length]
      places.push({
        rangee: r,
        colonnes: fixee || [c * largeur + 1, (c + 1) * largeur + 1],
      })
    })
  })
  return places
}

/** La place de chaque photo dans la grille, dans l'ordre du document. */
export function casesDe(d) {
  if (!d) return [{}]
  return placesDe(d).map(p => ({
    gridColumn: `${p.colonnes[0]} / ${p.colonnes[1]}`,
    gridRow: `${p.rangee + 1}`,
  }))
}

/**
 * Les cases d'une disposition en fractions de son cadre.
 *
 * C'est la meme geometrie que la grille de l'editeur, exprimee pour le
 * service qui pose les photos dans la diapositive : `x`, `y`, `l`, `h`
 * entre 0 et 1. Les ecarts entre photos sont l'affaire du service.
 */
export function rectanglesDe(d) {
  if (!d) return []
  const colonnes = colonnesDe(d)
  const total = d.poidsRangees.reduce((a, b) => a + b, 0)
  const avant = r => d.poidsRangees.slice(0, r).reduce((a, b) => a + b, 0)
  return placesDe(d).map(p => ({
    x: (p.colonnes[0] - 1) / colonnes,
    l: (p.colonnes[1] - p.colonnes[0]) / colonnes,
    y: avant(p.rangee) / total,
    h: d.poidsRangees[p.rangee] / total,
  }))
}
