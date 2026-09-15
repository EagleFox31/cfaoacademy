/**
 * Position de scroll de la page d'accueil (pôles / marques).
 *
 * Sauvegardée au clic sur une marque (avant navigation) et en sessionStorage :
 * au retour, le remount de `/` voit d'abord scrollY=0 — un listener qui
 * ré-enregistre trop tôt écraserait la vraie position.
 */

const STORAGE_KEY = 'cfao-needs:home-scroll'

let homeScrollY = 0

function readStored() {
  try {
    return Number(sessionStorage.getItem(STORAGE_KEY)) || 0
  } catch {
    return 0
  }
}

function writeStored(y) {
  try {
    if (y > 0) sessionStorage.setItem(STORAGE_KEY, String(y))
    else sessionStorage.removeItem(STORAGE_KEY)
  } catch {
    /* private mode */
  }
}

/** À appeler avant de quitter `/` (clic marque) ou pendant le scroll sur `/`. */
export function rememberHomeScroll(y = window.scrollY) {
  const next = Math.max(0, Math.round(Number(y) || 0))
  homeScrollY = next
  writeStored(next)
}

export function peekHomeScroll() {
  return homeScrollY > 0 ? homeScrollY : readStored()
}

export function clearHomeScroll() {
  homeScrollY = 0
  writeStored(0)
}

/**
 * Restaure la position mémorisée. Réessaie tant que la page n'est pas assez
 * haute (catalogue encore en chargement). `clear` une fois la cible atteinte.
 */
export function restoreHomeScroll({ attempts = 40, intervalMs = 50, clear = true } = {}) {
  const y = peekHomeScroll()
  if (y <= 0) return undefined

  let left = attempts
  let timer

  const apply = () => {
    window.scrollTo(0, y)
    left -= 1
    const tallEnough =
      document.documentElement.scrollHeight >= y + Math.min(window.innerHeight, 120)
    const closeEnough = Math.abs(window.scrollY - y) < 2
    if ((tallEnough && closeEnough) || left <= 0) {
      if (clear && (closeEnough || tallEnough)) clearHomeScroll()
      return
    }
    timer = window.setTimeout(apply, intervalMs)
  }

  apply()
  return () => {
    if (timer) window.clearTimeout(timer)
  }
}
