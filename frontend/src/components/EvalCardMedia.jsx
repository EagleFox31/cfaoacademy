import { useEffect, useState } from 'react'

export default function EvalCardMedia({
  img, imgFallback, modality, label, statusLabel, statusClass, locked = false,
}) {
  const [src, setSrc] = useState(img)

  useEffect(() => {
    setSrc(img)
  }, [img])

  const showTags = (label && modality) || statusLabel

  return (
    <div className={`pv-card-img portal-eval-card-img${locked ? ' is-locked' : ''}`}>
      <img
        src={src}
        alt=""
        loading="lazy"
        onError={() => {
          if (imgFallback && src !== imgFallback) setSrc(imgFallback)
        }}
      />
      {showTags && (
        <div className="portal-eval-img-tags">
          {label && modality && (
            <span className={`portal-eval-modality-tag portal-eval-modality-tag--${modality}`}>
              {label}
            </span>
          )}
          {statusLabel && (
            <span className={`portal-eval-status-tag portal-status-chip ${statusClass}`}>
              {statusLabel}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
