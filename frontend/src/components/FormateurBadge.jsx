import {
  getFormateurAvatarUrl,
  isFormateurUnknownAvatar,
} from '../utils/resolveFormateurPhoto.js'
import useLocale from '../hooks/useLocale.js'

export default function FormateurBadge({
  name,
  variant = 'card',
  showLabel = true,
  className = '',
}) {
  const { t } = useLocale('cards')
  const trimmed = name?.trim()
  if (!trimmed) return null

  const avatarSrc = getFormateurAvatarUrl(trimmed)
  const isUnknown = isFormateurUnknownAvatar(trimmed)
  const cls = ['formateur-badge', `formateur-badge--${variant}`, className].filter(Boolean).join(' ')

  return (
    <span className={cls}>
      {avatarSrc && (
        <img
          src={avatarSrc}
          alt=""
          className={`formateur-badge-avatar${isUnknown ? ' is-unknown' : ''}`}
          loading="lazy"
          width={variant === 'fiche' ? 32 : 28}
          height={variant === 'fiche' ? 32 : 28}
        />
      )}
      {showLabel && (
        <span className="formateur-badge-text">
          {t.trainer} <strong>{trimmed}</strong>
        </span>
      )}
    </span>
  )
}
