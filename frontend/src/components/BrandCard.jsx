import { Link } from 'react-router-dom'
import { getBrandCataloguePdf, isBrandCatalogueComingSoon } from '../utils/brandCatalogues.js'
import { resolveBrandFormateurDisplay } from '../utils/catalogFormateur.js'
import FormateurDisplay from './FormateurDisplay.jsx'
import useLocale from '../hooks/useLocale.js'
import { localizedBrandCat } from '../utils/localizeCard.js'

export default function BrandCard({ brand, onBrandHover, onBrandHoverEnd }) {
  const { locale } = useLocale('cards')
  const { t: cardsT } = useLocale('cards')
  const comingSoon = isBrandCatalogueComingSoon(brand.name)
  const cataloguePdf = getBrandCataloguePdf(brand.name, locale)
  const formateurDisplay = resolveBrandFormateurDisplay(brand)
  const className = [
    'pv-card',
    'pv-card--brand',
    comingSoon ? 'pv-card--brand-locked' : '',
    comingSoon && onBrandHover ? 'pv-card--brand-bg-hover' : '',
  ].filter(Boolean).join(' ')

  const brandHoverHandlers = onBrandHover ? {
    onMouseEnter: () => onBrandHover(brand),
    onMouseLeave: onBrandHoverEnd,
    onFocus: () => onBrandHover(brand),
    onBlur: onBrandHoverEnd,
  } : {}

  const hoverHintLabel = cataloguePdf
    ? cardsT.openBrandCatalogue
    : cardsT.viewFormations
  const hoverHint = !comingSoon ? (
    <span className="pv-card-hover-hint" role="tooltip">
      {hoverHintLabel}
    </span>
  ) : null

  const inner = (
    <>
      <div className="pv-card-media">
        <div className="pv-card-img" style={{ padding: '24px', background: 'white' }}>
          {brand.logo ? (
            <img
              src={brand.logo}
              alt={brand.name}
              loading="lazy"
              style={{ objectFit: 'contain', width: '100%', height: '100%' }}
            />
          ) : (
            <div
              className="pv-brand-wordmark"
              style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%' }}
            >
              {brand.name}
            </div>
          )}
        </div>
        {hoverHint}
      </div>
      {comingSoon ? (
        <div className="count pv-brand-soon">{cardsT.soon}</div>
      ) : (
        <div className="count">{String(brand.n).padStart(2, '0')} {cardsT.sessionsCount}</div>
      )}
      <div style={{ padding: '20px' }}>
        <div className="cat">{localizedBrandCat(brand, locale)}</div>
        <div className="name">{brand.name}</div>
        {formateurDisplay && (
          <FormateurDisplay
            display={formateurDisplay}
            variant="card"
            className="pv-brand-formateur"
          />
        )}
        {cataloguePdf && (
          <div className="pv-brand-pdf-hint">{cardsT.cataloguePdf}</div>
        )}
      </div>
    </>
  )

  if (comingSoon) {
    return (
      <div
        className={className}
        aria-disabled="true"
        title={cardsT.soonTitle}
        {...brandHoverHandlers}
      >
        {inner}
      </div>
    )
  }

  if (cataloguePdf) {
    return (
      <a
        className={className}
        href={cataloguePdf}
        target="_blank"
        rel="noopener noreferrer"
        title={cardsT.openBrandCatalogueTitle.replace('{brand}', brand.name)}
        {...brandHoverHandlers}
      >
        {inner}
      </a>
    )
  }

  return (
    <Link className={className} to="/formations" {...brandHoverHandlers}>
      {inner}
    </Link>
  )
}
