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
 * La grille CSS d'une disposition.
 *
 * Les rangees reprennent `poidsRangees`, les colonnes le nombre de
 * cases de la rangee la plus fournie : chaque case declare ensuite la
 * portion qu'elle occupe.
 */
export function grilleDe(d) {
  if (!d) return { gridTemplateColumns: '1fr' }
  const colonnes = Math.max(...d.rangees.map(r => r.length))
  return {
    gridTemplateColumns: `repeat(${colonnes}, 1fr)`,
    gridTemplateRows: d.poidsRangees.map(p => `${p}fr`).join(' '),
  }
}

/** La place de chaque photo dans la grille, dans l'ordre du document. */
export function casesDe(d) {
  if (!d) return [{}]
  const colonnes = Math.max(...d.rangees.map(r => r.length))
  const cases = []
  d.rangees.forEach((rangee, r) => {
    const largeur = colonnes / rangee.length
    rangee.forEach((_, c) => {
      cases.push({
        gridColumn: `${c * largeur + 1} / span ${largeur}`,
        gridRow: `${r + 1}`,
      })
    })
  })
  return cases
}
