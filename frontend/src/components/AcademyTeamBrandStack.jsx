import { resolveTeamBrands } from '../utils/teamBrands.js'

export default function AcademyTeamBrandStack({ brands }) {
  const items = resolveTeamBrands(brands)
  if (!items.length) return null

  return (
    <div className="academy-team-person-brands" aria-label="Marques formées">
      {items.map((brand) => (
        <div
          key={brand.id}
          className={`academy-team-person-brand academy-team-person-brand--${brand.id}`}
          title={brand.label}
        >
          {brand.logo ? (
            <img src={brand.logo} alt="" loading="lazy" />
          ) : (
            <span className="academy-team-person-brand-text">{brand.label}</span>
          )}
        </div>
      ))}
    </div>
  )
}
