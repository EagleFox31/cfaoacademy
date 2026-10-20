const NAV_CLEARANCE = 84
const HIGHLIGHT_CLASS = 'is-support-highlight'

export function portalHasAssistance(portalSections) {
  return portalSections?.some((s) => s.id === 'assistance') ?? false
}

function scrollToAssistance() {
  const el = document.getElementById('assistance')
  if (!el) return false
  const top = el.getBoundingClientRect().top + window.scrollY - NAV_CLEARANCE
  window.scrollTo({ top: Math.max(0, top), behavior: 'smooth' })
  return true
}

function pulseSupportCard() {
  const target = document.querySelector('[data-portal-support]')
  if (!target) return false

  target.classList.remove(HIGHLIGHT_CLASS)
  void target.offsetWidth
  target.classList.add(HIGHLIGHT_CLASS)

  const reduceMotion = window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  if (!reduceMotion) {
    target.scrollIntoView({ behavior: 'smooth', block: 'center' })
  }

  window.setTimeout(() => target.classList.remove(HIGHLIGHT_CLASS), reduceMotion ? 1200 : 2800)
  return true
}

function scheduleAssistanceScroll() {
  const attempt = () => scrollToAssistance()
  requestAnimationFrame(() => {
    attempt()
    window.setTimeout(attempt, 400)
    window.setTimeout(attempt, 1000)
  })
}

function scheduleSupportHighlight() {
  const tryPulse = () => pulseSupportCard()
  window.setTimeout(tryPulse, 850)
  window.setTimeout(tryPulse, 1400)
}

/** Ouvre le parcours « poser une question » selon le rôle (assistance portail ou contact). */
export function goToPortalQuestion({ navigate, pathname, portalSections }) {
  if (!portalHasAssistance(portalSections)) {
    navigate('/contact')
    return
  }

  const onDashboard = pathname === '/portail' || pathname === '/portail/'

  if (onDashboard) {
    window.history.pushState(null, '', '/portail#assistance')
    scheduleAssistanceScroll()
    scheduleSupportHighlight()
    return
  }

  if (pathname.startsWith('/portail/assistance')) {
    document.querySelector('.portal-assistance-new-btn')?.focus()
    return
  }

  navigate('/portail#assistance')
  scheduleAssistanceScroll()
  scheduleSupportHighlight()
}
