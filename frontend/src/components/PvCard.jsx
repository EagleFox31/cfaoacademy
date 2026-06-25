import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'

const DEFAULT_IMG = '/assets/logo-cfao-mobility.jpg'

export default function PvCard({
  kicker, title, meta, variant, corner,
  to, href, img, imgFallback, imgPosition, cardMedia, logo, brandLabel, brandAside,
  cta, ctaAside, ctaDateTime, secondCta, secondCtaTo,
  accentColor,
  hoverHint,
  onClick,
  onBeforeNavigate,
  selected,
  className = '',
}) {
  const isInteractive = Boolean(onClick)
  const hasDualCta = Boolean(secondCta && secondCtaTo)
  const resolvedHoverHint = hoverHint === false || !hoverHint ? null : hoverHint
  const primaryImg = img || DEFAULT_IMG
  const [resolvedImg, setResolvedImg] = useState(primaryImg)

  useEffect(() => {
    setResolvedImg(primaryImg)
  }, [primaryImg])

  function handleImgError() {
    if (imgFallback && resolvedImg !== imgFallback) {
      setResolvedImg(imgFallback)
      return
    }
    if (resolvedImg !== DEFAULT_IMG) setResolvedImg(DEFAULT_IMG)
  }

  const Tag = isInteractive
    ? 'button'
    : hasDualCta
      ? 'div'
      : href
        ? 'a'
        : to
          ? Link
          : 'div'
  const cls = [
    'pv-card',
    variant ? `pv-card--${variant}` : '',
    selected ? 'is-selected' : '',
    className,
  ].filter(Boolean).join(' ')
  const outerProps = isInteractive
    ? { type: 'button', onClick }
    : hasDualCta
      ? {}
      : href
        ? { href, target: '_blank', rel: 'noopener noreferrer' }
        : to
          ? {
              to,
              onMouseDown: onBeforeNavigate
                ? (e) => {
                    if (e.button === 0) onBeforeNavigate()
                  }
                : undefined,
              onClick: onBeforeNavigate
                ? (e) => {
                    if (e.button === 0) onBeforeNavigate()
                  }
                : undefined,
            }
          : {}
  const outerStyle = accentColor ? { '--pv-accent': accentColor } : undefined

  return (
    <Tag className={cls} style={outerStyle} {...outerProps}>
      <div className="pv-card-media">
        {cardMedia ?? (
          <div className="pv-card-img">
            <img
              src={resolvedImg}
              alt=""
              loading="lazy"
              onError={handleImgError}
              style={imgPosition ? { objectPosition: imgPosition } : undefined}
            />
          </div>
        )}
        {resolvedHoverHint && (
          <span className="pv-card-hover-hint" role="tooltip">
            {resolvedHoverHint}
          </span>
        )}
      </div>
      <div className="pv-card-body">
        {(logo || brandLabel || brandAside) && (
          <div className="pv-card-brand-row">
            {logo && <img src={logo} alt="" className="pv-card-brand-logo" loading="lazy" />}
            {!logo && brandLabel && (
              <span className="pv-card-brand-label">{brandLabel}</span>
            )}
            {brandAside}
          </div>
        )}
        {kicker && <div className="kicker">{kicker}</div>}
        <h3>{title}</h3>
        {meta && <div className="meta">{meta}</div>}

        {(ctaAside || cta || secondCta) && (
          <div className={`pv-card-cta${hasDualCta ? ' pv-card-cta--dual' : ''}${ctaAside ? ' pv-card-cta--split' : ''}`}>
            {ctaAside && (
              <time className="pv-card-cta-aside" dateTime={ctaDateTime}>
                {ctaAside}
              </time>
            )}
            {cta && (
              hasDualCta && href
                ? <a href={href} target="_blank" rel="noopener noreferrer" className="pv-cta-link pv-cta-link--primary">
                    {cta} <span className="arrow">→</span>
                  </a>
                : <span className="pv-cta-link">{cta} <span className="arrow">→</span></span>
            )}
            {hasDualCta && (
              <Link to={secondCtaTo} className="pv-cta-link pv-cta-link--alt">
                {secondCta} <span className="arrow">→</span>
              </Link>
            )}
          </div>
        )}

        {corner && <span className="corner">↗</span>}
      </div>
    </Tag>
  )
}
