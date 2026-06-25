import { useCallback, useState } from 'react'
import useLocale from '../hooks/useLocale.js'
import { FAQ_SHOWCASE_ITEMS } from '../i18n/contact.js'
import {
  LOGO_CFAO_EQUIPMENT,
  LOGO_CFAO_MOBILITY,
} from '../utils/resolveDetailCfaoLogo.js'

const UNIT_LOGO = {
  mobility: LOGO_CFAO_MOBILITY,
  equipment: LOGO_CFAO_EQUIPMENT,
}

function NavArrow({ direction, onClick, label }) {
  return (
    <button type="button" className="testimonial-nav-btn" onClick={onClick} aria-label={label}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
        {direction === 'prev' ? <polyline points="15 18 9 12 15 6" /> : <polyline points="9 18 15 12 9 6" />}
      </svg>
    </button>
  )
}

export default function FaqShowcase() {
  const { t } = useLocale('contact')
  const items = FAQ_SHOWCASE_ITEMS
  const [index, setIndex] = useState(0)
  const count = items.length

  const goTo = useCallback((next) => {
    setIndex((next + count) % count)
  }, [count])

  const prev = useCallback(() => goTo(index - 1), [goTo, index])
  const next = useCallback(() => goTo(index + 1), [goTo, index])

  const item = items[index] ?? items[0]
  if (!item) return null

  const logo = UNIT_LOGO[item.unit] ?? LOGO_CFAO_MOBILITY
  const question = t[item.q]
  const answer = t[item.a]
  const category = t[item.cat]

  return (
    <div className="testimonial-showcase faq-showcase">
      <div className="testimonial-showcase-nav" aria-label={t.faqNavAria}>
        <NavArrow direction="prev" onClick={prev} label={t.faqPrev} />
        <div className="testimonial-dots" role="tablist" aria-label={t.faqChoose}>
          {items.map((entry, i) => (
            <button
              key={entry.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={t.faqItemN.replace('{n}', String(i + 1))}
              className={`testimonial-dot${i === index ? ' is-active' : ''}`}
              onClick={() => goTo(i)}
            />
          ))}
        </div>
        <NavArrow direction="next" onClick={next} label={t.faqNext} />
      </div>

      <div className="testimonial-showcase-stage">
        <div className="testimonial-showcase-media faq-showcase-media">
          {item.poster && (
            <img src={item.poster} alt="" className="faq-showcase-poster" loading="lazy" />
          )}
          <div className="faq-showcase-media-inner">
            <img src={logo} alt="" className="faq-showcase-logo" loading="lazy" />
          </div>
        </div>

        <blockquote className="testimonial-showcase-panel">
          <img src={logo} alt="" className="testimonial-showcase-mark" aria-hidden="true" />
          <p className="testimonial-showcase-quote">{answer}</p>
          <footer className="testimonial-showcase-author">
            <strong>{question}</strong>
            <span>{category}</span>
          </footer>
        </blockquote>
      </div>
    </div>
  )
}
