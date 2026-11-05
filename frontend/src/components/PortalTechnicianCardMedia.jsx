import { resolveProfileIcon } from '../utils/resolveProfileIcon.js'

/**
 * Média carte technicien — icône poste / Gx Toyota (ou fallback générique).
 * Pas de logo marque ici : déjà listée dans le corps de carte.
 */
export default function PortalTechnicianCardMedia({
  person = null,
  brand = null,
  iconSrc = null,
  className = '',
  mediaClassName = '',
}) {
  const brandId = brand ?? person?.brand ?? person?.brands?.[0] ?? null
  const brandMod = brandId ?? 'default'
  const resolvedPerson = person
    ? {
        ...person,
        brand: brandId ?? person.brand,
        brands: person.brands?.length
          ? person.brands
          : (brandId ? [brandId] : person.brands),
      }
    : (brandId ? { brand: brandId, brands: [brandId] } : null)
  const src = iconSrc
    ?? resolveProfileIcon(resolvedPerson, { fallbackTech: true })

  return (
    <div
      className={[
        'portal-team-member-card-media',
        `portal-team-member-card-media--${brandMod}`,
        mediaClassName,
        className,
      ].filter(Boolean).join(' ')}
    >
      <div className="portal-team-member-card-media-pattern" aria-hidden="true" />
      <img
        src={src}
        alt=""
        className="portal-dps-collab-tech-icon"
        width={72}
        height={72}
        decoding="async"
      />
    </div>
  )
}
