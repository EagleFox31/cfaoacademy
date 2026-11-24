import { useCallback, useEffect, useRef, useState } from 'react'
import useLocale from '../hooks/useLocale.js'
import {
  ECART_MIN_MS,
  INTERVALLE_MS,
  VERSION_LOCALE,
  actualiser,
  estReporte,
  evaluer,
  lireVersionEnLigne,
  reporter,
} from '../lib/miseAJour.js'
import '../styles/mise-a-jour.css'

/**
 * « Une nouvelle version est disponible » (contrat : src/lib/miseAJour.js).
 *
 * Lit version.json toutes les 10 min, au retour sur l'onglet et quand un morceau
 * de page ne se charge plus. Bandeau discret, sans bloquer la saisie ; « Plus tard »
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
    const distant = await lireVersionEnLigne(url, faireFetch)
    const resultat = evaluer(distant, locale)
    if (!resultat) return
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
    <div className="nv-bandeau" role="status" aria-live="polite">
      <div className="nv-bandeau-texte">
        <strong>{t.titre}</strong>
        <span>{t.texte}{version && <> · {version}</>}</span>
        {notes && <span className="nv-notes">{notes}</span>}
        <span className="nv-rappel">{t.rappel}</span>
      </div>
      <div className="nv-bandeau-actions">
        <button type="button" className="nv-btn nv-btn--principal" onClick={surActualiser}>{t.actualiser}</button>
        <button type="button" className="nv-btn" onClick={surPlusTard}>{t.plusTard}</button>
      </div>
    </div>
  )
}
