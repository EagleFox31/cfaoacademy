export default function PortalSectionSkeleton({
  cols = 4,
  count = 4,
  ariaLabel,
}) {
  return (
    <div
      className={`portal-section-skeleton portal-stagger-grid cols-${cols}`}
      aria-busy="true"
      aria-label={ariaLabel}
    >
      {Array.from({ length: count }, (_, i) => (
        <div key={i} className="portal-skeleton-card" />
      ))}
    </div>
  )
}
