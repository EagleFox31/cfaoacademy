import { useEffect, useRef, useState } from 'react'
import { formatPortalUpdatedAgo } from '../utils/portalDataFreshness.js'

function PortalDataMeta({ updating, updatedAt, methodText, t }) {
  const [methodOpen, setMethodOpen] = useState(false)
  const [, refreshTick] = useState(0)
  const methodRef = useRef(null)

  useEffect(() => {
    const id = window.setInterval(() => refreshTick(n => n + 1), 60000)
    return () => window.clearInterval(id)
  }, [])

  useEffect(() => {
    if (!methodOpen) return undefined
    function onPointerDown(e) {
      if (methodRef.current && !methodRef.current.contains(e.target)) setMethodOpen(false)
    }
    function onKeyDown(e) {
      if (e.key === 'Escape') setMethodOpen(false)
    }
    document.addEventListener('mousedown', onPointerDown)
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [methodOpen])

  const freshness = updating
    ? t.data_updating
    : formatPortalUpdatedAgo(updatedAt, t)

  return (
    <div className="portal-section-meta">
      <span className="portal-section-freshness" aria-live="polite">
        {freshness}
      </span>
      {methodText ? (
        <div className="portal-section-method" ref={methodRef}>
          <button
            type="button"
            className={`portal-section-method-btn${methodOpen ? ' is-open' : ''}`}
            aria-expanded={methodOpen}
            aria-controls="portal-method-popover"
            onClick={() => setMethodOpen(v => !v)}
          >
            {t.data_method_btn}
          </button>
          {methodOpen ? (
            <div id="portal-method-popover" className="portal-section-method-popover" role="tooltip">
              <p>{methodText}</p>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}

export default function PortalSectionHead({
  eyebrow,
  title,
  lead,
  updatedAt,
  updating = false,
  methodText,
  t,
}) {
  return (
    <div className="portal-section-head">
      <div className="portal-section-head-row">
        <div className="portal-section-head-start">{eyebrow}</div>
        <PortalDataMeta
          updating={updating}
          updatedAt={updatedAt}
          methodText={methodText}
          t={t}
        />
      </div>
      {title ? <h2 className="portal-section-title">{title}</h2> : null}
      {lead ? <p className="portal-section-lead">{lead}</p> : null}
    </div>
  )
}
