import { TEAM_BRAND_DEFS } from '../utils/teamBrands.js'

const BRAND_LOGOS = {
  toyota: '/assets/logos/toyota.png',
  mercedes: '/assets/logos/mercedes.png',
  suzuki: '/assets/logos/suzuki.png',
  mitsubishi: '/assets/logos/mitsubishi.png',
  byd: '/assets/logos/byd.png',
  citroen: '/assets/logos/citroen.png',
  yamaha: '/assets/logos/yamaha.png',
  fuso: '/assets/logos/fuso.png',
  hino: '/assets/logos/hino.png',
  jcb: '/assets/logos/jcb.png',
  lovol: '/assets/logos/lovol.png',
  'renault-trucks': '/assets/logos/renault-trucks.png',
  'king-long': '/assets/logos/kinglong.png',
}

export function resolveBrandLogo(brand) {
  return BRAND_LOGOS[brand] ?? TEAM_BRAND_DEFS[brand]?.logo ?? null
}

export default function PortalBrandLogo({ brand, size = 'default', title }) {
  const src = resolveBrandLogo(brand)
  const label = title ?? TEAM_BRAND_DEFS[brand]?.label ?? brand
  const wrapClass = size === 'geo'
    ? 'portal-header-brand-logo-wrap portal-header-brand-logo-wrap--geo'
    : 'portal-header-brand-logo-wrap'

  if (src) {
    return (
      <span className={wrapClass} title={label}>
        <img src={src} alt={label} className="portal-header-brand-logo" />
      </span>
    )
  }

  return (
    <span className={`portal-brand-chip ${brand} portal-header-brand-chip`}>
      {label}
    </span>
  )
}
