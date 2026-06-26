/**
 * Couche fond plein écran — opacité pilotée au scroll via --backdrop-op-{id} sur html.
 */
export default function BackdropLayer({ id, image, position = 'center' }) {
  if (!image) return null
  return (
    <div
      className="home-backdrop-layer"
      data-section-id={id}
      style={{
        backgroundImage: `url(${image})`,
        backgroundPosition: position,
        opacity: `var(--backdrop-op-${id}, 0)`,
      }}
      aria-hidden="true"
    />
  )
}
