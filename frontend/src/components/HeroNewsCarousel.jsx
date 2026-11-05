import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { catSlug } from '../data/articles/index.js'
import ArticleVideoFrameImage from './ArticleVideoFrameImage.jsx'

const SWAP_HALF_MS = 340
const SWAP_TOTAL_MS = 680

function galleryItemKey(item, index) {
  if (item?.type === 'videoFrame') return `frame-${item.videoUrl}-${item.at}`
  return item?.src ?? `img-${index}`
}

function HeroNewsGalleryImage({ item, className }) {
  if (item?.type === 'videoFrame') {
    return (
      <ArticleVideoFrameImage
        videoUrl={item.videoUrl}
        at={item.at}
        className={className}
      />
    )
  }
  return <img src={item.src} alt="" className={className} loading="eager" />
}

export default function HeroNewsCarousel({
  slide,
  slideIndex,
  slideCount,
  eyebrow,
  readLabel,
  onPause,
  onResume,
}) {
  const firstRenderRef = useRef(true)
  const shownSlugRef = useRef(slide?.slug)
  const [shownSlide, setShownSlide] = useState(slide)
  const [swapPhase, setSwapPhase] = useState(null)

  useEffect(() => {
    if (!slide?.slug) return undefined

    if (firstRenderRef.current) {
      firstRenderRef.current = false
      shownSlugRef.current = slide.slug
      setShownSlide(slide)
      return undefined
    }

    if (slide.slug === shownSlugRef.current) return undefined

    setSwapPhase('out')
    const midTimer = window.setTimeout(() => {
      shownSlugRef.current = slide.slug
      setShownSlide(slide)
      setSwapPhase('in')
    }, SWAP_HALF_MS)
    const endTimer = window.setTimeout(() => {
      setSwapPhase(null)
    }, SWAP_TOTAL_MS)

    return () => {
      window.clearTimeout(midTimer)
      window.clearTimeout(endTimer)
    }
  }, [slide])

  if (!slide || !shownSlide) return null

  const visuals = (shownSlide.gallery ?? []).slice(0, 2)
  const solo = visuals.length === 1
  const articlePath = {
    pathname: `/actualites/${slide.slug}`,
    state: { from: { pathname: '/', hash: 'actualites' } },
  }

  return (
    <div
      className="hero-home-news-stage"
      onMouseEnter={onPause}
      onMouseLeave={onResume}
      onFocus={onPause}
      onBlur={onResume}
    >
      <div key={slide.slug} className="hero-home-news-copy hero-home-glass">
        <div className="hero-home-news-meta">
          <span className={`news-tag news-tag--${catSlug(slide.category)} hero-home-news-tag`}>
            {slide.category}
          </span>
          <p className="hero-home-news-eyebrow">{eyebrow}</p>
        </div>
        <h2 className="hero-home-news-title">
          <Link to={articlePath}>{slide.title}</Link>
        </h2>
        <p className="hero-home-news-summary">{slide.summary}</p>
        <Link to={articlePath} className="btn btn-primary hero-home-news-cta">
          {readLabel}
          <span className="arrow" aria-hidden="true">→</span>
        </Link>
        <div className="hero-home-news-dots" role="tablist" aria-label={eyebrow}>
          {Array.from({ length: slideCount }, (_, i) => (
            <span
              key={i}
              role="tab"
              aria-selected={i === slideIndex}
              className={`hero-home-news-dot${i === slideIndex ? ' is-active' : ''}`}
            />
          ))}
        </div>
      </div>

      {visuals.length > 0 && (
        <Link
          to={articlePath}
          className={[
            'hero-home-news-stack',
            solo ? 'hero-home-news-stack--solo' : '',
            swapPhase === 'out' ? 'hero-home-news-stack--phase-out' : '',
            swapPhase === 'in' ? 'hero-home-news-stack--phase-in' : '',
            swapPhase ? 'is-animating' : '',
          ].filter(Boolean).join(' ')}
          aria-label={slide.title}
        >
          {visuals.map((item, index) => (
            <div
              key={galleryItemKey(item, index)}
              className={`hero-home-news-visual hero-home-news-visual--${index === 0 ? 'back' : 'front'}`}
            >
              <HeroNewsGalleryImage item={item} className="hero-home-news-visual-img" />
            </div>
          ))}
        </Link>
      )}
    </div>
  )
}
