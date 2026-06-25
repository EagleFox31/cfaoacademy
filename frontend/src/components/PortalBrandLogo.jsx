const BRAND_LOGOS = {
  toyota: '/assets/logos/toyota.png',
  mercedes: '/assets/logos/mercedes.png',
  suzuki: '/assets/logos/suzuki.png',
  mitsubishi: '/assets/logos/mitsubishi.png',
  fuso: '/assets/logos/fuso.png',
  hino: '/assets/logos/hino.png',
  byd: '/assets/logos/byd.png',
  citroen: '/assets/logos/citroen.png',
  yamaha: '/assets/logos/yamaha.png',
  renault: '/assets/logos/renault.png',
  nissan: '/assets/logos/nissan.png',
}

export default function PortalBrandLogo({ brand, size = 'default', className = '' }) {
  const src = BRAND_LOGOS[brand]
  if (!src) {
    return (
      <span className={`portal-brand-chip ${brand} ${className}`.trim()}>
        {brand}
      </span>
    )
  }
  return (
    <span className={`portal-brand-logo portal-brand-logo--${size} ${className}`.trim()}>
      <img src={src} alt="" />
    </span>
  )
}
