import manifeste from '../data/imagesResponsives.json'

/*
 * Variantes WebP des images de `/assets/` produites par
 * `frontend/scripts/images-responsives.py` (dossier `/assets/_r/`).
 * Une image absente du manifeste (logo, drapeau, URL externe) est rendue telle quelle.
 */
const PREFIXE = '/assets/'

function cle(src) {
  if (typeof src !== 'string' || !src.startsWith(PREFIXE)) return null
  const chemin = src.slice(PREFIXE.length).split(/[?#]/)[0]
  try {
    return decodeURIComponent(chemin)
  } catch {
    return chemin
  }
}

function urlVariante(chemin, largeur) {
  return `${PREFIXE}_r/${chemin.replace(/\.[^./]+$/, '')}-${largeur}.webp`
}

/**
 * @param {string} src chemin public, ex. `/assets/hero/default.jpg`
 * @returns {null | { src: string, srcSet: string, width: number, height: number, flou: string }}
 */
export function imageResponsive(src) {
  const chemin = cle(src)
  const entree = chemin ? manifeste[chemin] : null
  if (!entree) return null
  const plusGrande = entree.v[entree.v.length - 1]
  return {
    src: urlVariante(chemin, plusGrande),
    srcSet: entree.v.map((w) => `${urlVariante(chemin, w)} ${w}w`).join(', '),
    width: entree.w,
    height: entree.h,
    flou: entree.f,
  }
}

/** Largeur d'affichage d'un fond plein écran, densité plafonnée à 2. */
export function largeurEcran() {
  if (typeof window === 'undefined') return 1600
  return Math.round((window.innerWidth || 1600) * Math.min(window.devicePixelRatio || 1, 2))
}

/**
 * Fond CSS : la plus petite variante couvrant `largeur`, posée au-dessus de sa miniature floue.
 * @returns {{ url: string, image: string }} `image` = valeur pour `background-image`
 */
export function fondResponsive(src, largeur = largeurEcran()) {
  const chemin = cle(src)
  const entree = chemin ? manifeste[chemin] : null
  if (!entree) return { url: src, image: `url('${src}')` }
  const w = entree.v.find((v) => v >= largeur) ?? entree.v[entree.v.length - 1]
  const url = urlVariante(chemin, w)
  return { url, image: `url('${url}'), url('${entree.f}')` }
}

/** Précharge en priorité haute l'image principale (fond du hero, LCP). Renvoie le nettoyage. */
export function prechargerImage(url) {
  if (typeof document === 'undefined' || !url) return () => {}
  const lien = document.createElement('link')
  lien.rel = 'preload'
  lien.as = 'image'
  lien.href = url
  lien.setAttribute('fetchpriority', 'high')
  document.head.appendChild(lien)
  return () => lien.remove()
}
