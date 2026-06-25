export function memberInitials(nom) {
  return (nom ?? '')
    .split(' ')
    .filter(Boolean)
    .map(n => n[0])
    .join('')
    .toUpperCase()
}

/** Initiales + nom — avatar avec relief (cartes portail équipe / priorités). */
export default function CardMemberTitle({ name, variant = 'default' }) {
  return (
    <span className={`portal-card-member-title portal-card-member-title--${variant}`}>
      <span className="portal-card-member-avatar" aria-hidden="true">
        {memberInitials(name)}
      </span>
      <span className="portal-card-member-name">{name}</span>
    </span>
  )
}
