import { useState } from 'react'
import BrandCard from './BrandCard.jsx'
import useLocale from '../hooks/useLocale.js'

const COLS = 4
const ROWS = 2
const INITIAL_COUNT = COLS * ROWS

export default function BrandOfferGrid({
  brands,
  showAll = false,
  onBrandHover,
  onBrandHoverEnd,
}) {
  const { t: cardsT } = useLocale('cards')
  const [expanded, setExpanded] = useState(false)
  const hasMore = !showAll && brands.length > INITIAL_COUNT
  const visible = showAll || expanded ? brands : brands.slice(0, INITIAL_COUNT)

  return (
    <div className="brand-offer-wrap">
      <div className="brand-offer-grid">
        {visible.map((b, i) => (
          <BrandCard
            key={b.name + i}
            brand={b}
            onBrandHover={onBrandHover}
            onBrandHoverEnd={onBrandHoverEnd}
          />
        ))}
      </div>
      {hasMore && !expanded && (
        <div className="brand-offer-more-wrap">
          <button
            type="button"
            className="btn btn-dark brand-offer-more"
            onClick={() => setExpanded(true)}
          >
            {cardsT.seeMoreBrands} <span className="arrow">→</span>
          </button>
        </div>
      )}
    </div>
  )
}
