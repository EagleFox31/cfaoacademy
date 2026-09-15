import { useState, useEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { useLocale } from '../i18n'

/** Écran de chargement premium multilingue (FR / EN / PT) CFAO Academy */
export default function PortalLoader({
  leaving = false,
  messages: messagesProp,
  ariaLabel: ariaLabelProp,
}) {
  let localeCtx = null
  try {
    localeCtx = useLocale()
  } catch {
    /* fallback si rendu en dehors d'un LocaleProvider */
  }

  const t = localeCtx?.t

  const defaultMessages = useMemo(() => {
    if (t) {
      return [
        t('loader.msg1'),
        t('loader.msg2'),
        t('loader.msg3'),
      ]
    }
    return [
      'Connexion sécurisée...',
      'Chargement de la campagne...',
      'Identification des besoins en formations...',
    ]
  }, [t])

  const messages = messagesProp?.length ? messagesProp : defaultMessages
  const ariaLabel = ariaLabelProp || (t ? t('loader.ariaLabel') : 'Chargement de la campagne')

  const [messageIndex, setMessageIndex] = useState(0)

  useEffect(() => {
    setMessageIndex(0)
  }, [messages])

  useEffect(() => {
    if (!messages || messages.length <= 1) return undefined
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length)
    }, 2000)
    return () => clearInterval(interval)
  }, [messages])

  return createPortal(
    <div
      className={`portal-loader${leaving ? ' is-leaving' : ''}`}
      role="status"
      aria-live="polite"
      aria-label={ariaLabel}
    >
      <div
        className="portal-loader-bg"
        style={{ backgroundImage: "url('/assets/cfao-academy-douala.jpg')" }}
      />
      <div className="portal-loader-inner">
        <div className="portal-loader-brand">
          <img
            src="/assets/favicon.svg"
            alt="CFAO"
            className="portal-loader-logo"
            width={54}
            height={54}
          />
          <span className="portal-loader-wordmark">
            CFAO Academy<span>.</span>
          </span>
        </div>
        <div className="portal-loader-progress">
          <div className="portal-loader-bar">
            <span className="portal-loader-bar-fill" />
          </div>
          <div className="portal-loader-text">
            <span key={`${messageIndex}-${messages[messageIndex]}`}>
              {messages[messageIndex] || ''}
            </span>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  )
}
