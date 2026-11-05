import { resolveProfileIcon } from '../utils/resolveProfileIcon.js'

function initialsFromName(nom) {
  const parts = (nom ?? '').split(/\s+/).filter(Boolean)
  if (!parts.length) return ''
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return `${parts[0][0] ?? ''}${parts[parts.length - 1][0] ?? ''}`.toUpperCase()
}

/**
 * Avatar circulaire — icône profil si résolue, sinon initiales.
 */
export default function ProfileAvatar({
  person = null,
  name = '',
  src = null,
  className = 'portal-card-member-avatar',
  imgClassName = 'portal-profile-avatar-img',
  size = null,
}) {
  const iconSrc = src ?? resolveProfileIcon(person)
  const label = name || [person?.firstName, person?.lastName].filter(Boolean).join(' ') || person?.nom || ''

  if (iconSrc) {
    return (
      <span
        className={`${className} portal-profile-avatar--photo`}
        style={size ? { width: size, height: size } : undefined}
        aria-hidden="true"
      >
        <img src={iconSrc} alt="" className={imgClassName} decoding="async" />
      </span>
    )
  }

  return (
    <span
      className={className}
      style={size ? { width: size, height: size } : undefined}
      aria-hidden="true"
    >
      {initialsFromName(label)}
    </span>
  )
}
