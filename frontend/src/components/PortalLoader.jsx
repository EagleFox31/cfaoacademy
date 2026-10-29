import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';

/** Écran de chargement premium à l'entrée du portail. Rendu dans <body> : le
 * conteneur d'animation des routes (transform) capterait sinon le position fixed. */
export default function PortalLoader({
  leaving = false,
  messages: messagesProp,
  intervalMs = 1200,
  ariaLabel = 'Chargement du portail',
}) {
  const [messageIndex, setMessageIndex] = useState(0);
  const messages = messagesProp?.length
    ? messagesProp
    : [
        'Connexion sécurisée...',
        'Chargement de votre espace...',
        'Préparation des données...',
      ];

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, intervalMs);
    return () => clearInterval(interval);
  }, [messages.length, intervalMs]);

  return createPortal(
    <div
      className={`portal-loader${leaving ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <div className="portal-loader-bg" style={{ backgroundImage: "url('/assets/images_articles/event_academy2.jpg')" }} />
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
        <div className="portal-loader-progress">
          <div className="portal-loader-bar">
            <span className="portal-loader-bar-fill" />
          </div>
          <div className="portal-loader-text">
            <span key={messageIndex}>{messages[messageIndex]}</span>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
