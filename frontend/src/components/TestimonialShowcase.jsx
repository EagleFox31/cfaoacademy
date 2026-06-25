import { useCallback, useEffect, useState } from 'react'
import ArticleVideoEmbed from './ArticleVideoEmbed.jsx'
import { getVideoThumbnail } from '../utils/videoEmbed.js'
import useLocale from '../hooks/useLocale.js'

const CFAO_MARK = '/assets/logo-cfao-mobility.jpg'

function NavArrow({ direction, onClick, label }) {
  return (
    <button type="button" className="testimonial-nav-btn" onClick={onClick} aria-label={label}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        {direction === 'prev' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </button>
  )
}

function PlayIcon() {
  return (
    <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5v14l11-7z" />
    </svg>
  )
}

export default function TestimonialShowcase({ items: fallbackItems }) {
  const { t } = useLocale('testimonials')
  const items = t.items?.length ? t.items.map((entry, i) => ({
    ...entry,
    poster: fallbackItems?.[i]?.poster ?? entry.poster,
    video: fallbackItems?.[i]?.video,
  })) : fallbackItems

  const [index, setIndex] = useState(0)
  const [playing, setPlaying] = useState(false)
  const count = items.length

  const item = items[index] ?? items[0]
  const poster = item?.video ? getVideoThumbnail(item.video) || item.poster : item?.poster
  const hasVideo = Boolean(item?.video)

  const goTo = useCallback((next) => {
    setPlaying(false)
    setIndex((next + count) % count)
  }, [count])

  const prev = useCallback(() => goTo(index - 1), [goTo, index])
  const next = useCallback(() => goTo(index + 1), [goTo, index])

  useEffect(() => {
    setPlaying(false)
  }, [index])

  if (!item) return null

  return (
    <div className="testimonial-showcase">
      <div className="testimonial-showcase-nav" aria-label={t.navAria}>
        <NavArrow direction="prev" onClick={prev} label={t.prev} />
        <div className="testimonial-dots" role="tablist" aria-label={t.choose}>
          {items.map((entry, i) => (
            <button
              key={entry.name + i}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={t.testimonialN.replace('{n}', i + 1).replace('{name}', entry.name)}
              className={`testimonial-dot${i === index ? ' is-active' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <NavArrow direction="next" onClick={next} label={t.next} />
      </div>

      <div className="testimonial-showcase-stage">
        <div className="testimonial-showcase-media">
          {playing && hasVideo ? (
            <ArticleVideoEmbed url={item.video} title={t.videoTitle.replace('{name}', item.name)} />
          ) : (
            <>
              <img src={poster} alt="" className="testimonial-showcase-poster" loading="lazy" />
              {hasVideo && (
                <button
                  type="button"
                  className="testimonial-showcase-play"
                  onClick={() => setPlaying(true)}
                  aria-label={t.playVideo.replace('{name}', item.name)}
                >
                  <PlayIcon />
                </button>
              )}
            </>
          )}
        </div>

        <blockquote className="testimonial-showcase-panel">
          <img src={CFAO_MARK} alt="" className="testimonial-showcase-mark" aria-hidden="true" />
          <p className="testimonial-showcase-quote">« {item.quote} »</p>
          <footer className="testimonial-showcase-author">
            <strong>{item.name}</strong>
            <span>{item.role}</span>
          </footer>
        </blockquote>
      </div>
    </div>
  )
}
