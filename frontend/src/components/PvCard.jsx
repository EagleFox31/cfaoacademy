import { useCallback, useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { imageResponsive } from '../utils/imageResponsive.js'
import PortalConstructionMedia from './PortalConstructionMedia.jsx'
import useLocale from '../hooks/useLocale.js'

const DEFAULT_IMG = '/assets/logo-cfao-mobility.jpg'
/** Cartes en `.pv-grid` : 1 colonne sur mobile, 2 en tablette, ~420 px au-delà. */
const CARD_IMG_SIZES = '(max-width: 640px) 100vw, (max-width: 1100px) 50vw, 420px'

/** Chantier sans libellé fourni : « Fonctionnalité en construction » dans la langue active. */
function ChantierParDefaut() {
  const { t } = useLocale('centerHome')
  return <PortalConstructionMedia label={t.under_construction} />
}

/**
 * `enConstruction` (libellé) : la carte ne mène encore nulle part. Elle garde
 * son visuel, perd lien, CTA et coin ↗, et montre le chantier animé d'office.
 * Une carte avec CTA mais sans destination passe d'elle-même en construction.
 */
export default function PvCard({
  kicker, title, meta, variant, corner: cornerProp, enConstruction,
  to: toProp, href: hrefProp, onClick: onClickProp, cta: ctaProp, img, imgFallback, imgPosition, cardMedia, logo, brandLabel, brandAside,
  ctaAside, ctaDateTime, secondCta, secondCtaTo, actions,
  accentColor,
  hoverHint,
  onBeforeNavigate,
  selected,
  className = '',
  noMedia = false,
}) {
  // Une carte qui annonce une action (CTA) sans rien derrière n'a pas encore d'app : chantier d'office.
  const ctaSansCible = Boolean(ctaProp) && !toProp && !hrefProp && !onClickProp && !secondCtaTo && !actions
  const sansDestination = Boolean(enConstruction) || ctaSansCible
  const to = sansDestination ? undefined : toProp
  const href = sansDestination ? undefined : hrefProp
  const onClick = sansDestination ? undefined : onClickProp
  const cta = sansDestination ? undefined : ctaProp
  const corner = sansDestination ? undefined : cornerProp
  const isInteractive = Boolean(onClick)
  const hasDualCta = Boolean(secondCta && secondCtaTo)
  const resolvedHoverHint = sansDestination || hoverHint === false || !hoverHint ? null : hoverHint
  const primaryImg = img || DEFAULT_IMG
  const [resolvedImg, setResolvedImg] = useState(primaryImg)
  const [variantFailed, setVariantFailed] = useState(false)
  const [loadedSrc, setLoadedSrc] = useState(null)
  const responsive = variantFailed ? null : imageResponsive(resolvedImg)
  const shownSrc = responsive?.src ?? resolvedImg
  const imgLoaded = loadedSrc === shownSrc

  useEffect(() => {
    setResolvedImg(primaryImg)
    setVariantFailed(false)
  }, [primaryImg])

  // Image déjà en cache : `complete` est vrai avant que `load` ne soit écouté.
  const markIfComplete = useCallback((node) => {
    if (node?.complete && node.naturalWidth > 0) setLoadedSrc(node.getAttribute('src'))
  }, [])

  function handleImgError() {
    if (responsive) {
      setVariantFailed(true)
      return
    }
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
    sansDestination ? 'pv-card--en-construction' : '',
    selected ? 'is-selected' : '',
    className,
  ].filter(Boolean).join(' ')
  const outerProps = isInteractive
    ? { type: 'button', onClick: (e) => { e.preventDefault(); onClick?.(e) } }
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
      {!noMedia && (
        <div className="pv-card-media">
          {cardMedia ?? (
            <div
              className={`pv-card-img${responsive ? ' has-flou' : ''}${imgLoaded ? ' is-loaded' : ''}`}
              style={responsive ? { '--img-flou': `url('${responsive.flou}')` } : undefined}
            >
              <img
                ref={markIfComplete}
                src={shownSrc}
                srcSet={responsive?.srcSet}
                sizes={responsive ? CARD_IMG_SIZES : undefined}
                width={responsive?.width}
                height={responsive?.height}
                alt=""
                loading="lazy"
                decoding="async"
                onLoad={() => setLoadedSrc(shownSrc)}
                onError={handleImgError}
                style={imgPosition ? { objectPosition: imgPosition } : undefined}
              />
            </div>
          )}
          {sansDestination && (
            <div className="pv-card-construction">
              {enConstruction
                ? <PortalConstructionMedia label={enConstruction} />
                : <ChantierParDefaut />}
            </div>
          )}
          {resolvedHoverHint && (
            <span className="pv-card-hover-hint" role="tooltip">
              {resolvedHoverHint}
            </span>
          )}
        </div>
      )}
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
        {title ? <h3>{title}</h3> : null}
        {meta && <div className="meta">{meta}</div>}

        {actions && <div className="pv-card-cta pv-card-cta--split pv-card-cta--actions">{actions}</div>}
        {!actions && (ctaAside || cta || secondCta) && (
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

        {corner && (
          <span className="corner">
            {typeof corner === 'boolean' ? '↗' : corner}
          </span>
        )}
      </div>
    </Tag>
  )
}
