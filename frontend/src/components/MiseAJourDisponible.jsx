import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react'
import useLocale from '../hooks/useLocale.js'
import {
  ECART_MIN_MS,
  INTERVALLE_MS,
  VERSION_LOCALE,
  actualiser,
  estReporte,
  lireOffre,
  rechercherMiseAJour,
  reporter,
} from '../lib/miseAJour.js'
import '../styles/mise-a-jour.css'

/**
 * « Une nouvelle version est disponible » (contrat : src/lib/miseAJour.js).
 *
 * Lit version.json toutes les 10 min, au retour sur l'onglet et quand un morceau
 * de page ne se charge plus. Barre pleine largeur au-dessus de la nav, sans bloquer
 * la saisie ; « Plus tard »
 * le fait taire 30 min. Modale sans « Plus tard » seulement si la version en ligne
 * est critique ou exige un client plus récent que celui-ci.
 */
export default function MiseAJourDisponible({
  url = '/version.json',
  locale = VERSION_LOCALE,
  intervalle = INTERVALLE_MS,
  faireFetch,
  recharger,
}) {
  const { t } = useLocale('miseAJour')
  const [offre, setOffre] = useState(null)
  const derniere = useRef(0)

  const verifier = useCallback(async () => {
    derniere.current = Date.now()
    // Publie aussi l'offre pour le menu du compte, qui la garde visible après « Plus tard ».
    if (await rechercherMiseAJour({ url, locale, faireFetch }) !== 'disponible') return
    const resultat = lireOffre()
    if (!resultat.critique && estReporte()) return
    setOffre(resultat)
  }, [url, locale, faireFetch])

  useEffect(() => {
    if (!locale?.build) return undefined
    verifier()
    const minuterie = setInterval(verifier, intervalle)
    const auRetour = () => {
      if (document.visibilityState === 'visible' && Date.now() - derniere.current >= ECART_MIN_MS) verifier()
    }
    document.addEventListener('visibilitychange', auRetour)
    window.addEventListener('vite:preloadError', verifier)
    return () => {
      clearInterval(minuterie)
      document.removeEventListener('visibilitychange', auRetour)
      window.removeEventListener('vite:preloadError', verifier)
    }
  }, [locale?.build, intervalle, verifier])

  // Barre en haut de page : la nav et ce qui s'aligne dessus descendent d'autant (mise-a-jour.css).
  const barre = useRef(null)
  const barreVisible = Boolean(offre && !offre.critique)
  useLayoutEffect(() => {
    if (!barreVisible) return undefined
    const racine = document.documentElement
    racine.classList.add('nv-actif')
    const mesurer = () => {
      const h = barre.current?.offsetHeight
      if (h) racine.style.setProperty('--maj-h', `${h}px`)
    }
    mesurer()
    const obs = typeof ResizeObserver === 'function' ? new ResizeObserver(mesurer) : null
    if (obs && barre.current) obs.observe(barre.current)
    return () => {
      obs?.disconnect()
      racine.classList.remove('nv-actif')
      racine.style.removeProperty('--maj-h')
    }
  }, [barreVisible])

  if (!offre) return null

  const surActualiser = () => actualiser(recharger ? { recharger } : undefined)
  const surPlusTard = () => {
    reporter()
    setOffre(null)
  }
  const version = offre.version ? (t.version ?? '').replace('{version}', offre.version) : ''
  const notes = offre.notesKey ? t.notes?.[offre.notesKey] : ''

  if (offre.critique) {
    return (
      <div className="nv-voile">
        <div className="nv-modale" role="alertdialog" aria-modal="true"
          aria-labelledby="nv-titre" aria-describedby="nv-texte">
          <h2 id="nv-titre">{t.titreCritique}</h2>
          <p id="nv-texte">{t.texteCritique}</p>
          {notes && <p className="nv-notes">{notes}</p>}
          {version && <p className="nv-version">{version}</p>}
          <button type="button" className="nv-btn nv-btn--principal" onClick={surActualiser} autoFocus>
            {t.actualiser}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="nv-bandeau" role="status" aria-live="polite" ref={barre}>
      <div className="nv-bandeau-corps">
        <svg className="nv-icone" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M20 11a8 8 0 1 0-2.3 5.7M20 4v7h-7" fill="none" stroke="currentColor"
            strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        <p className="nv-bandeau-texte">
          <strong>{t.titre}</strong>
          <span className="nv-bandeau-detail">{notes || t.texte}</span>
        </p>
        <div className="nv-bandeau-actions">
          <button type="button" className="nv-btn nv-btn--principal" onClick={surActualiser}>{t.actualiser}</button>
          <button type="button" className="nv-btn nv-btn--discret" onClick={surPlusTard}
            title={t.rappel} aria-describedby="nv-rappel">{t.plusTard}</button>
          <span id="nv-rappel" className="nv-masque">{t.rappel}</span>
        </div>
      </div>
    </div>
  )
}
