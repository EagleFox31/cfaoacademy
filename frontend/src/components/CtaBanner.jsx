import { Link } from 'react-router-dom'
import Reveal from './Reveal.jsx'
import useLocale from '../hooks/useLocale.js'
import { resolveSectionBackdrop } from '../data/homeSectionBg.js'
import { normalizeSectionVeil } from '../data/sectionBackdropVeils.js'

/**
 * Bandeau CTA réutilisable — titre + texte + bouton Contact uniquement.
 * Surcharger eyebrow / title* / body / contactTo si besoin sur une page.
 */
export default function CtaBanner({
  id,
  eyebrow,
  titleBefore,
  titleEm,
  titleLine2,
  body,
  contactTo = '/contact',
  sectionBg,
  sectionBgPosition,
  sectionVeil,
  className = '',
}) {
  const { t } = useLocale('cta')

  const autoBackdrop = resolveSectionBackdrop(id)
  const bgImage = sectionBg ?? autoBackdrop?.image ?? null
  const bgPosition = sectionBg
    ? (sectionBgPosition ?? 'center')
    : (sectionBgPosition ?? autoBackdrop?.position ?? 'center')
  const veilKey = normalizeSectionVeil(sectionVeil ?? autoBackdrop?.veil)

  return (
    <section
      id={id}
      className={`tight cta-banner-section${bgImage ? ' has-section-bg' : ''}${className ? ` ${className}` : ''}`}
      data-section-veil={bgImage ? veilKey : undefined}
    >
      {bgImage && (
        <div
          className="section-bg"
          aria-hidden="true"
          style={{
            backgroundImage: `url(${bgImage})`,
            backgroundPosition: bgPosition,
          }}
        />
      )}
      <div className="container">
        <Reveal className="cta-banner">
          <div className="blob-m parallax" data-speed="-0.15" aria-hidden="true" />
          <div className="cta-banner-main">
            {(eyebrow ?? t.eyebrow) && (
              <div className="cta-banner-eyebrow">{eyebrow ?? t.eyebrow}</div>
            )}
            <h2 className="cta-banner-title">
              {titleBefore ?? t.titleBefore}
              <em>{titleEm ?? t.titleEm}</em>
              <br />
              {titleLine2 ?? t.titleLine2}
            </h2>
          </div>
          <div className="cta-banner-side">
            {(body ?? t.body) && <p className="cta-banner-body">{body ?? t.body}</p>}
            <Link to={contactTo} className="btn btn-primary cta-banner-contact">
              {t.contact} <span className="arrow">→</span>
            </Link>
          </div>
        </Reveal>
      </div>
    </section>
  )
}
