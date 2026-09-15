import { useState } from 'react'

import { brandLogo } from '../lib/assets'

/**
 * Pastille de marque — logo si le fichier existe, monogramme sinon.
 *
 * Le repli est un monogramme et non une image générique : une marque sans logo
 * doit rester identifiable d'un coup d'œil dans une liste, et un carré vide
 * ressemble à un chargement en échec.
 */
export default function BrandLogo({ code, label, transverse = false, variant, size = 34 }) {
  const [failed, setFailed] = useState(false)
  const src = brandLogo(code)
  const isCarrosserie = variant === 'carrosserie'
  const style = { width: size, height: size }

  if (isCarrosserie) {
    return (
      <span
        className="brand-logo brand-logo--carrosserie"
        style={style}
        aria-hidden="true"
        title="Carrosserie"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="brand-logo__carrosserie-icon"
        >
          <path d="M3 11h4l2-4h6l2 4h4v6h-2a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H3z" />
          <path d="M7 11h10" />
        </svg>
        <span className="brand-logo__carrosserie-text">CARROSSERIE</span>
      </span>
    )
  }

  if (transverse) {
    return (
      <span className="brand-logo brand-logo--all" style={style} aria-hidden="true">
        <img src="/assets/favicon.svg" alt={label || 'CFAO'} loading="lazy" />
      </span>
    )
  }

  if (!src || failed) {
    return (
      <span className="brand-logo brand-logo--mono" style={style} aria-hidden="true">
        {(label || code || '?').trim().charAt(0).toUpperCase()}
      </span>
    )
  }

  // `data-brand` permet de rattraper en CSS les fichiers dont la marge blanche
  // est cuite dans l'image, sans toucher aux logos correctement détourés.
  return (
    <span className="brand-logo" style={style} data-brand={code}>
      <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} />
    </span>
  )
}
