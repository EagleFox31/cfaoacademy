import BrandCard from './BrandCard.jsx'
import CardRail from './CardRail.jsx'
import useLocale from '../hooks/useLocale.js'

export default function BrandOfferGrid({
  brands,
  onBrandHover,
  onBrandHoverEnd,
}) {
  const { t: commonT } = useLocale('common')

  return (
    <div className="brand-offer-wrap">
      <CardRail
        className="brand-offer-rail"
        ariaLabel="Marques"
        arrowLabelPrev={commonT.prev ?? 'Précédent'}
        arrowLabelNext={commonT.next ?? 'Suivant'}
      >
        {brands.map((b, i) => (
          <BrandCard
            key={b.name + i}
            brand={b}
            onBrandHover={onBrandHover}
            onBrandHoverEnd={onBrandHoverEnd}
          />
        ))}
      </CardRail>
    </div>
  )
}
