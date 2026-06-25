/**
 * Détecte si un point flottant (FAB, croix sticky…) doit être en ton clair ou sombre
 * selon la section / zone sous le curseur — même logique que BackToTopFab.
 * @returns {'light' | 'dark'}
 */
export function resolveFabTone(x, y, ignoreSelector = null) {
  const stack = document.elementsFromPoint(x, y).filter((el) => {
    if (el === document.documentElement || el === document.body) return false
    if (ignoreSelector && el.closest(ignoreSelector)) return false
    return true
  })

  for (const el of stack) {
    if (el.closest('footer, .cta-banner, [data-fab-tone="dark"]')) {
      return 'dark'
    }

    if (el.closest('header.hero, .marquee-wrap, .nav, .page-header, [data-fab-tone="light"]')) {
      return 'light'
    }

    const section = el.closest('section')
    if (section) {
      const sections = document.querySelectorAll('section')
      const idx = [...sections].indexOf(section)
      if (idx !== -1) return idx % 2 === 1 ? 'dark' : 'light'
    }
  }

  return 'light'
}

export function resolveFabToneAtElement(el, ignoreSelector = null) {
  if (!el) return 'light'
  const rect = el.getBoundingClientRect()
  const x = rect.left + rect.width * 0.5
  const y = rect.top + rect.height * 0.5
  return resolveFabTone(x, y, ignoreSelector)
}
