import { useEffect } from 'react'

export default function PortalModal({ title, onClose, children }) {
  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
    }
  }, [onClose])

  return (
    <div className="portal-modal-overlay" onClick={onClose}>
      <div className="portal-modal" onClick={e => e.stopPropagation()} role="dialog" aria-modal="true">
        <div className="portal-modal-header">
          <h3 className="portal-modal-title">{title}</h3>
          <button className="portal-modal-close" onClick={onClose} aria-label="Fermer">✕</button>
        </div>
        <div className="portal-modal-body">
          {children}
        </div>
      </div>
    </div>
  )
}
