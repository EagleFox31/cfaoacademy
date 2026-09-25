/**
 * Mise a l'echelle de l'interface selon la fenetre.
 *
 * L'interface est dessinee pour 1920 pixels de large. Sur un autre ecran
 * (portable a 125 %, ecran 1366, ecran 2560) ou dans une fenetre reduite,
 * la page ne se resserre pas : elle est agrandie ou reduite d'un bloc,
 * comme avec le zoom du navigateur, et garde sa composition de reference.
 * Sous 1024 pixels (tablette, telephone), la mise en page adaptative
 * reprend la main, sans reduction.
 *
 * `zoom` sur la racine a deux angles morts, compenses ailleurs :
 * - les unites d'ecran (`vh`, `vw`) ne sont pas corrigees : Vite les
 *   divise par `--echelle` a la compilation (cf. vite.config.js) ;
 * - les requetes `max-height` voient la hauteur reelle : les seuils
 *   passent par l'attribut `data-bas`, calcule sur la hauteur effective.
 * Enfin, les mesures (`getBoundingClientRect`, `clientX`) sont en pixels
 * d'ecran : les reporter en CSS demande de les diviser par `echelle()`.
 */
const REFERENCE = 1920
const LARGEUR_MINIMALE = 1024
const PLANCHER = 0.6
const PLAFOND = 2
// Les seuils de hauteur des feuilles de style (`:root[data-bas~="820"]`).
const SEUILS_HAUTEUR = [540, 720, 820]

/** Le facteur applique a l'interface (1 a la largeur de reference). */
export function echelle() {
  return Number(document.documentElement.dataset.echelle) || 1
}

function appliquer() {
  const racine = document.documentElement
  // `innerWidth` ignore le `zoom` de la racine : c'est la largeur de la
  // fenetre en pixels CSS, quel que soit le facteur deja applique.
  const largeur = window.innerWidth || REFERENCE
  const z = largeur >= LARGEUR_MINIMALE
    ? Math.round(Math.min(PLAFOND, Math.max(PLANCHER, largeur / REFERENCE)) * 1000) / 1000
    : 1
  if (z !== 1) {
    racine.style.zoom = String(z)
    racine.style.setProperty('--echelle', String(z))
    racine.dataset.echelle = String(z)
  } else {
    racine.style.removeProperty('zoom')
    racine.style.removeProperty('--echelle')
    delete racine.dataset.echelle
  }
  const hauteur = window.innerHeight / z
  racine.dataset.bas = SEUILS_HAUTEUR.filter(n => hauteur <= n).join(' ')
}

/**
 * A appeler avant le premier rendu. Un redimensionnement, comme le passage
 * sur un ecran d'une autre mise a l'echelle, change `innerWidth` : `resize`
 * suffit a suivre les deux.
 */
export function suivreEchelle() {
  appliquer()
  window.addEventListener('resize', appliquer)
}
