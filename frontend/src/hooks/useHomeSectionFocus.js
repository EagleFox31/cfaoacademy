import { useEffect, useState } from 'react'

function viewportMetrics() {
  const vv = window.visualViewport
  const vh = vv?.height ?? window.innerHeight
  const vTop = vv?.offsetTop ?? 0
  const vCenter = vTop + vh * 0.5
  /** Crossfade entre deux sections adjacentes. */
  const blend = Math.max(120, vh * 0.14)
  return { vh, vTop, vCenter, blend }
}

/** Poids 0–1 pour crossfade (viewport center dans la section = 1). */
function sectionFocus(el, vCenter, vTop, vh, blend) {
  const rect = el.getBoundingClientRect()
  if (rect.bottom <= vTop || rect.top >= vTop + vh) return 0

  if (vCenter >= rect.top && vCenter <= rect.bottom) return 1

  const dist = vCenter < rect.top ? rect.top - vCenter : vCenter - rect.bottom
  return Math.max(0, 1 - dist / blend)
}

function pickActiveSection(sections, vCenter, vTop, vh, blend) {
  const visible = sections.filter((el) => {
    const r = el.getBoundingClientRect()
    return r.bottom > vTop && r.top < vTop + vh
  })

  const containing = visible.filter((el) => {
    const r = el.getBoundingClientRect()
    return vCenter >= r.top && vCenter <= r.bottom
  })

  if (containing.length === 1) return containing[0].id
  if (containing.length > 1) {
    return containing.reduce((best, el) => {
      const r = el.getBoundingClientRect()
      const bestR = best.getBoundingClientRect()
      return r.height < bestR.height ? el : best
    }).id
  }

  let bestId = null
  let bestFocus = -1
  visible.forEach((el) => {
    const focus = sectionFocus(el, vCenter, vTop, vh, blend)
    if (focus > bestFocus) {
      bestFocus = focus
      bestId = el.id
    }
  })
  return bestId
}

function clearBackdropOpacities(root, sectionIds) {
  sectionIds.forEach((id) => {
    root.style.removeProperty(`--backdrop-op-${id}`)
  })
}

/**
 * Netflix scroll : section active + opacités crossfade sur html (--backdrop-op-{id}).
 */
export default function useHomeSectionFocus(sectionIds, { heroId = 'accueil' } = {}) {
  const [activeId, setActiveId] = useState(null)
  const [heroVisible, setHeroVisible] = useState(true)

  useEffect(() => {
    const root = document.documentElement
    const hero = document.getElementById(heroId)
    const sections = sectionIds
      .map((id) => document.getElementById(id))
      .filter(Boolean)

    if (!sections.length) return undefined

    let frame = 0
    let lastActiveId = null

    const update = () => {
      frame = 0
      const { vh, vTop, vCenter, blend } = viewportMetrics()

      if (hero) {
        const hr = hero.getBoundingClientRect()
        const heroDominant = hr.bottom > vCenter * 0.85
        setHeroVisible(heroDominant)
        if (heroDominant) {
          setActiveId(null)
          clearBackdropOpacities(root, sectionIds)
          sections.forEach((el) => el.classList.remove('is-section-active'))
          return
        }
      }

      const weights = sections.map((el) => ({
        id: el.id,
        w: sectionFocus(el, vCenter, vTop, vh, blend),
      }))
      const total = weights.reduce((sum, { w }) => sum + w, 0)

      weights.forEach(({ id, w }) => {
        const opacity = total > 0 ? w / total : 0
        root.style.setProperty(`--backdrop-op-${id}`, opacity.toFixed(4))
      })

      const bestId = pickActiveSection(sections, vCenter, vTop, vh, blend)
      if (bestId !== lastActiveId) {
        lastActiveId = bestId
        setActiveId(bestId)
      }

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
    window.visualViewport?.addEventListener('resize', onScroll)
    window.visualViewport?.addEventListener('scroll', onScroll)

    return () => {
      if (frame) cancelAnimationFrame(frame)
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.visualViewport?.removeEventListener('resize', onScroll)
      window.visualViewport?.removeEventListener('scroll', onScroll)
      clearBackdropOpacities(root, sectionIds)
      sections.forEach((el) => el.classList.remove('is-section-active'))
    }
  }, [sectionIds, heroId])

  return { activeId, heroVisible }
}
