import { useEffect } from 'react'

/**
 * Apparition au scroll, généralisée à tout le portail.
 *
 * Tague automatiquement les sections (`portal-reveal reveal`) et les grilles de
 * cartes (`portal-stagger-grid stagger`) présentes sous `.portal-page`, puis les
 * révèle à l'entrée dans le viewport via un IntersectionObserver unique.
 *
 * Réutilise les classes (et donc le timing + le gate prefers-reduced-motion) déjà
 * définies dans portal.css, et ignore les éléments déjà animés manuellement
 * (LearnerDashboard) pour éviter les doubles révélations.
 */
const SECTION_SEL = ':scope > section, :scope > div[id]'
const GRID_SEL = [
  '.pv-grid',
  '.portal-kpi-row',
  '.portal-log-list',
  '.portal-fad-list',
  '.portal-ki-apprenants',
  '.portal-plan-entries',
].join(', ')

function alreadyTagged(el) {
  return el.classList.contains('reveal') ||
    el.classList.contains('stagger') ||
    el.classList.contains('portal-reveal') ||
    el.classList.contains('portal-stagger-grid')
}

export default function usePortalReveal() {
  useEffect(() => {
    const root = document.querySelector('.portal-page')
    if (!root) return undefined

    const targets = []

    root.querySelectorAll(SECTION_SEL).forEach((sec) => {
      if (!alreadyTagged(sec)) {
        sec.classList.add('portal-reveal', 'reveal')
        targets.push(sec)
      }
      sec.querySelectorAll(GRID_SEL).forEach((grid) => {
        if (!alreadyTagged(grid)) {
          grid.classList.add('portal-stagger-grid', 'stagger')
          targets.push(grid)
        }
      })
    })

    if (!targets.length) return undefined

    const reduce = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    if (reduce) {
      targets.forEach((el) => el.classList.add('in'))
      return undefined
    }

    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (e.isIntersecting) {
            e.target.classList.add('in')
            io.unobserve(e.target)
          }
        })
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.08 },
    )

    targets.forEach((el) => io.observe(el))
    return () => io.disconnect()
  }, [])
}
