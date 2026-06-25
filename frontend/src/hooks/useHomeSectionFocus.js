import { useEffect, useState } from 'react'

/**
 * Section dont le centre est le plus proche du milieu du viewport (effet Netflix).
 * Ajoute .is-section-active sur la section courante.
 */
export default function useHomeSectionFocus(sectionIds, { heroId = 'accueil' } = {}) {
  const [activeId, setActiveId] = useState(null)
  const [heroVisible, setHeroVisible] = useState(true)

  useEffect(() => {
    const hero = document.getElementById(heroId)
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean)

    if (!sections.length) return undefined

    let frame = 0

    const update = () => {
      frame = 0
      const vh = window.innerHeight
      const vCenter = vh * 0.5

      if (hero) {
        const hr = hero.getBoundingClientRect()
        const heroDominant = hr.bottom > vCenter * 0.85
        setHeroVisible(heroDominant)
        if (heroDominant) {
          setActiveId(null)
          sections.forEach((el) => el.classList.remove('is-section-active'))
          return
        }
      }

      let bestId = null
      let bestDist = Infinity

      sections.forEach((el) => {
        const rect = el.getBoundingClientRect()
        if (rect.bottom <= 0 || rect.top >= vh) return
        const center = rect.top + rect.height / 2
        const dist = Math.abs(center - vCenter)
        if (dist < bestDist) {
          bestDist = dist
          bestId = el.id
        }
      })

      setActiveId(bestId)
      sections.forEach((el) => {
        el.classList.toggle('is-section-active', el.id === bestId)
      })
    }

    const onScroll = () => {
      if (frame) return
      frame = requestAnimationFrame(update)
    }

    update()
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      sections.forEach((el) => el.classList.remove('is-section-active'))
    }
  }, [sectionIds, heroId])

  return { activeId, heroVisible }
}
