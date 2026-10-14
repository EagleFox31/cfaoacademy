import { useEffect, useRef, useState } from 'react'

/**
 * Un bouton qui deplie une courte liste de choix : les classeurs a
 * enregistrer, ou l'import et ses modeles vierges.
 *
 * `choix` : `{ libelle, detail, action }`, ou `{ groupe }` pour un
 * intertitre. Le menu se ferme au choix, a Echap et au clic ailleurs.
 */
export default function MenuExcel({ libelle, icone, className = '', disabled, title, choix }) {
  const [ouvert, setOuvert] = useState(false)
  const racine = useRef(null)

  useEffect(() => {
    if (!ouvert) return
    const dehors = e => { if (!racine.current?.contains(e.target)) setOuvert(false) }
    const echap = e => { if (e.key === 'Escape') setOuvert(false) }
    document.addEventListener('mousedown', dehors)
    document.addEventListener('keydown', echap)
    return () => {
      document.removeEventListener('mousedown', dehors)
      document.removeEventListener('keydown', echap)
    }
  }, [ouvert])

  return (
    <div className="cr-menu" ref={racine}>
      <button type="button" className={`cr-btn cr-btn--ghost cr-export ${className}`}
        disabled={disabled} title={title}
        aria-haspopup="true" aria-expanded={ouvert}
        onClick={() => setOuvert(v => !v)}>
        {icone}
        {libelle}
        <span className="cr-menu-chevron" aria-hidden="true">{ouvert ? '▴' : '▾'}</span>
      </button>
      {ouvert && (
        <div className="cr-menu-liste" role="menu">
          {choix.map((c, i) => (c.groupe
            ? <p key={i} className="cr-menu-groupe">{c.groupe}</p>
            : (
              <button key={i} type="button" role="menuitem" className="cr-menu-choix"
                onClick={() => { setOuvert(false); c.action() }}>
                <span className="cr-menu-libelle">{c.libelle}</span>
                {c.detail && <span className="cr-menu-detail">{c.detail}</span>}
              </button>
            )))}
        </div>
      )}
    </div>
  )
}
