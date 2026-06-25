import { Children, useRef, useState, useEffect, useCallback } from 'react'

export default function CardCarousel({ children, className = '', bleed = false }) {
  const itemCount = Children.count(children)
  const usePeek = bleed ? false : itemCount > 4
  const scrollRef = useRef(null)
  const [showLeft, setShowLeft] = useState(false)
  const [showRight, setShowRight] = useState(false)

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return
    const { scrollLeft, scrollWidth, clientWidth } = scrollRef.current
    const overflow = scrollWidth > clientWidth + 2
    setShowLeft(overflow && scrollLeft > 4)
    setShowRight(overflow && Math.ceil(scrollLeft + clientWidth) < scrollWidth - 4)
  }, [])

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return undefined

    handleScroll()
    const ro = new ResizeObserver(handleScroll)
    ro.observe(el)
    window.addEventListener('resize', handleScroll)
    return () => {
      ro.disconnect()
      window.removeEventListener('resize', handleScroll)
    }
  }, [children, handleScroll])

  return (
    <div
      className={[
        'card-carousel-wrapper',
        bleed ? 'card-carousel--bleed' : '',
        usePeek ? 'card-carousel--peek' : '',
        showRight ? 'card-carousel--can-scroll-right' : '',
        showLeft ? 'card-carousel--can-scroll-left' : '',
        className,
      ].filter(Boolean).join(' ')}
    >
      <div
        className="card-carousel-scroll"
        ref={scrollRef}
        onScroll={handleScroll}
        tabIndex={0}
        role="region"
        aria-label="Carrousel horizontal"
      >
        {children}
      </div>
    </div>
  )
}
