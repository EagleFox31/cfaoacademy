import { useRef, useState } from 'react'

/**
 * Une image qui remplit son cadre, et qu'on peut decaler dedans.
 *
 * L'image est rognee pour remplir la case (`object-fit: cover`) : une
 * photo plus large ou plus haute que sa case en perd une partie. Par
 * defaut on garde le centre ; le formateur peut choisir la partie
 * montree en faisant glisser l'image, soit en mode recadrage (le bouton
 * de la case), soit a tout moment en maintenant Ctrl.
 *
 * Le cadrage est garde en pourcentages, au sens de `object-position` :
 * `{ x: 0, y: 50 }` colle le bord gauche de l'image au bord gauche de
 * la case. Le service d'apercu applique la meme regle a la diapositive.
 */
export const CADRAGE_CENTRE = { x: 50, y: 50 }

export default function ImageCadree({ src, alt = '', cadrage, onCadrer, actif, className }) {
  const image = useRef(null)
  const [enCours, setEnCours] = useState(null)
  // Un glissement se termine par un clic, que le cadre parent prendrait
  // pour une demande de nouvelle photo : on l'absorbe.
  const aGlisse = useRef(false)
  const pos = enCours?.pos || cadrage || CADRAGE_CENTRE

  function debut(e) {
    if (!onCadrer || !(actif || e.ctrlKey)) return
    const img = image.current
    if (!img?.naturalWidth) return
    e.preventDefault()
    e.stopPropagation()
    // Ce qui depasse de la case, dans chaque sens : c'est la course
    // disponible. Une image deja a la forme de sa case ne bouge pas.
    const boite = img.getBoundingClientRect()
    const echelle = Math.max(boite.width / img.naturalWidth,
      boite.height / img.naturalHeight)
    const depasse = {
      x: img.naturalWidth * echelle - boite.width,
      y: img.naturalHeight * echelle - boite.height,
    }
    aGlisse.current = false
    img.setPointerCapture(e.pointerId)
    setEnCours({ depart: { x: e.clientX, y: e.clientY }, origine: pos, depasse, pos })
  }

  function deplacer(e) {
    if (!enCours) return
    const { depart, origine, depasse } = enCours
    if (Math.abs(e.clientX - depart.x) + Math.abs(e.clientY - depart.y) > 3) {
      aGlisse.current = true
    }
    // Tirer l'image vers la droite montre sa partie gauche : le
    // pourcentage baisse quand la souris avance.
    const axe = (d, o, course) => (course > 1
      ? Math.min(100, Math.max(0, o - (d / course) * 100)) : o)
    setEnCours({
      ...enCours,
      pos: {
        x: Math.round(axe(e.clientX - depart.x, origine.x, depasse.x)),
        y: Math.round(axe(e.clientY - depart.y, origine.y, depasse.y)),
      },
    })
  }

  function fin() {
    if (!enCours) return
    const { pos: finale, origine } = enCours
    setEnCours(null)
    if (finale.x !== origine.x || finale.y !== origine.y) onCadrer(finale)
  }

  return (
    <img ref={image} src={src} alt={alt} draggable={false}
      className={`cr-image-cadree${actif ? ' cr-image-cadree--actif' : ''}`
        + `${enCours ? ' cr-image-cadree--glisse' : ''}${className ? ` ${className}` : ''}`}
      style={{ objectPosition: `${pos.x}% ${pos.y}%` }}
      onPointerDown={debut}
      onPointerMove={deplacer}
      onPointerUp={fin}
      onPointerCancel={fin}
      onClickCapture={e => {
        if (!aGlisse.current && !actif) return
        aGlisse.current = false
        e.stopPropagation()
        e.preventDefault()
      }}
      onDoubleClick={actif && onCadrer ? () => onCadrer(CADRAGE_CENTRE) : undefined} />
  )
}

/** Le bouton qui fait entrer une case en mode recadrage. */
export function BoutonRecadrer({ actif, onBasculer, rang }) {
  return (
    <button type="button"
      className={`cr-case-recadrer${actif ? ' cr-case-recadrer--on' : ''}`}
      aria-pressed={actif}
      title={actif
        ? 'Terminer le recadrage (double-clic sur l’image : recentrer)'
        : 'Recadrer : faire glisser l’image dans sa case (ou Ctrl + glisser)'}
      aria-label={`Recadrer la photo ${rang}`}
      onClick={e => { e.stopPropagation(); onBasculer() }}>
      <span aria-hidden="true">✥</span>
    </button>
  )
}
