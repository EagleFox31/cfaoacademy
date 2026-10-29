import { createPortal } from 'react-dom'

/** Écran de chargement premium à l'entrée du portail. Rendu dans <body> : le
 * conteneur d'animation des routes (transform) capterait sinon le position fixed. */
export default function PortalLoader({ leaving = false }) {
  return createPortal(
    <div
      className={`portal-loader${leaving ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label="Chargement du portail"
    >
      <div className="portal-loader-inner">
        <div className="portal-loader-brand">
          <img
            src="/assets/logo-cfao-mobility.jpg"
            alt=""
            className="portal-loader-logo"
          />
          <span className="portal-loader-wordmark">
            Academy<span>.</span>
          </span>
        </div>
        <div className="portal-loader-bar">
          <span className="portal-loader-bar-fill" />
        </div>
      </div>
    </div>,
    document.body,
  )
}
