import FormateurBadge from './FormateurBadge.jsx'
import {
  getFormateurAvatarUrl,
  isFormateurUnknownAvatar,
} from '../utils/resolveFormateurPhoto.js'
import useLocale from '../hooks/useLocale.js'

function StackAvatar({ name, size, index, total }) {
  const src = getFormateurAvatarUrl(name)
  const isUnknown = isFormateurUnknownAvatar(name)
  if (!src) return null

  return (
    <img
      src={src}
      alt=""
      className={`formateur-stack-avatar${isUnknown ? ' is-unknown' : ''}`}
      loading="lazy"
      width={size}
      height={size}
      style={{ zIndex: total - index }}
    />
  )
}

/** Affichage formateur(s) — simple, paire ou pile d’avatars + principal et +X. */
export default function FormateurDisplay({ display, variant = 'card', className = '' }) {
  const { t } = useLocale('cards')
  if (!display) return null

  if (display.kind === 'single') {
    return (
      <FormateurBadge
        name={display.name}
        variant={variant}
        className={className}
      />
    )
  }

  const size = variant === 'fiche' ? 32 : 28
  const cls = [
    'formateur-display',
    `formateur-display--${variant}`,
    `formateur-display--${display.kind}`,
    className,
  ].filter(Boolean).join(' ')

  return (
    <span className={cls}>
      <span className="formateur-stack" aria-hidden={display.kind === 'pair' ? undefined : true}>
        {display.stack.map((name, index) => (
          <StackAvatar
            key={name}
            name={name}
            size={size}
            index={index}
            total={display.stack.length}
          />
        ))}
      </span>
      <span className="formateur-display-text">
        {display.kind === 'pair' ? (
          <>
            {t.trainers}{' '}
            <strong>{display.names[0]}</strong>
            <span className="formateur-display-sep"> · </span>
            <strong>{display.names[1]}</strong>
          </>
        ) : (
          <>
            {t.trainer}{' '}
            <strong>{display.primary}</strong>{' '}
            <span className="formateur-display-more">
              {t.trainersAndMore.replace('{count}', String(display.extra))}
            </span>
          </>
        )}
      </span>
    </span>
  )
}
