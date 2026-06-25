import PvCard from './PvCard.jsx'
import { OFFER_CATALOGUES, getOfferCataloguePdf } from '../utils/offerCatalogues.js'
import useLocale from '../hooks/useLocale.js'
import { localizedOfferFields } from '../utils/localizeCard.js'

export default function CatalogueOfferCard({ offerId }) {
  const { locale } = useLocale('cards')
  const { t: cardsT } = useLocale('cards')
  const offer = OFFER_CATALOGUES[offerId]
  const href = getOfferCataloguePdf(offerId, locale)
  if (!offer || !href) return null

  const copy = localizedOfferFields(offerId, offer, locale)

  return (
    <a
      className="catalogue-offer-link"
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      title={copy.title}
    >
      <PvCard
        variant="doc"
        corner
        img={copy.img}
        kicker={copy.kicker}
        title={copy.title}
        meta={copy.meta}
        cta={cardsT.openCatalogue}
        hoverHint={cardsT.openCatalogueHint}
      />
    </a>
  )
}
