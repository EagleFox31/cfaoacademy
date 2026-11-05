import { Children, useCallback, useEffect, useRef, useState } from 'react'

/**
 * Rail horizontal générique : une seule ligne de cartes qui scrollent, avec flèches
 * gauche/droite (visibles seulement s'il y a débordement) et une demi-carte apparente
 * à droite pour signaler la suite.
 *
 * Paramètres pilotables via CSS custom properties (--rail-count, --rail-peek, --rail-gap).
 * Compatible avec toute carte (ArticleCard, PvCard, LearnerEvalCard, PublicCard, etc.).
 */
export default function CardRail({
  children,
  visibleCount = 4,
  peek = 0.5,
  gap = 20,
  className = '',
  itemClassName = '',
  ariaLabel,
  arrowLabelPrev = 'Précédent',
  arrowLabelNext = 'Suivant',
}) {
  const scrollerRef = useRef(null)
  const [canPrev, setCanPrev] = useState(false)
  const [canNext, setCanNext] = useState(false)

  const updateArrows = useCallback(() => {
    const el = scrollerRef.current
    if (!el) return
    setCanPrev(el.scrollLeft > 4)
    setCanNext(el.scrollLeft + el.clientWidth < el.scrollWidth - 4)
  }, [])

  useEffect(() => {
    updateArrows()
    const el = scrollerRef.current
    if (!el) return
    el.addEventListener('scroll', updateArrows, { passive: true })
    const ro = new ResizeObserver(updateArrows)
    ro.observe(el)
    return () => {
      el.removeEventListener('scroll', updateArrows)
      ro.disconnect()
    }
  }, [updateArrows])

  const scrollByPage = (dir) => {
    const el = scrollerRef.current
    if (!el) return
    const step = Math.max(el.clientWidth * 0.85, 240)
    el.scrollBy({ left: dir * step, behavior: 'smooth' })
  }

  const items = Children.toArray(children)
  if (items.length === 0) return null

  const style = {
    '--rail-count': visibleCount,
    '--rail-peek': peek,
    '--rail-gap': `${gap}px`,
  }

  return (
    <div className={`card-rail ${className}`.trim()} style={style}>
      <button
        type="button"
        className="card-rail__nav card-rail__nav--prev"
        aria-label={arrowLabelPrev}
        onClick={() => scrollByPage(-1)}
        hidden={!canPrev}
      >
        <span aria-hidden="true">‹</span>
      </button>
      <div
        ref={scrollerRef}
        className="card-rail__scroller"
        role="group"
        aria-label={ariaLabel}
      >
        {items.map((child, i) => (
          <div key={child?.key ?? i} className={`card-rail__item ${itemClassName}`.trim()}>
            {child}
          </div>
        ))}
      </div>
      <button
        type="button"
        className="card-rail__nav card-rail__nav--next"
        aria-label={arrowLabelNext}
        onClick={() => scrollByPage(1)}
        hidden={!canNext}
      >
        <span aria-hidden="true">›</span>
      </button>
    </div>
  )
}
