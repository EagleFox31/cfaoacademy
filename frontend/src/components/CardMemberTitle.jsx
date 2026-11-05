import ProfileAvatar from './ProfileAvatar.jsx'

export function memberInitials(nom) {
  const parts = (nom ?? '').split(/\s+/).filter(Boolean)
  if (!parts.length) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

/** Initiales / icône poste·Gx + nom — avatar avec relief (cartes portail équipe / priorités). */
export default function CardMemberTitle({ name, variant = 'default', person = null, avatarSrc = null }) {
  return (
    <span className={`portal-card-member-title portal-card-member-title--${variant}`}>
      <ProfileAvatar
        person={person}
        name={name}
        src={avatarSrc}
        className="portal-card-member-avatar"
      />
      <span className="portal-card-member-name">{name}</span>
    </span>
  )
}
