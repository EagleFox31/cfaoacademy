import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useEnHautDePage from '../hooks/useEnHautDePage'
import useSiteEffects from '../hooks/useSiteEffects'
import ListeVide from '../components/compte-rendu/ListeVide'
import { lireErreurs, supprimerErreurs } from '../utils/journalErreurs'
import '../styles/compte-rendu.css'

// Rafraîchissement continu : une nouvelle erreur apparaît sans action.
const CADENCE = 5000

const date = iso => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' })

/**
 * Le journal des erreurs du service des comptes rendus (et de ses pages
 * portail), pour l'équipe technique ; il ne couvre pas le reste du site.
 *
 * `/portail/journal-erreurs`, ouvert depuis les priorités du superadmin ou
 * le menu de son profil ; le retour ramène au portail. Le service
 * décide seul qui le lit (Cerbos) ; un refus affiche l'accès réservé.
 * La liste se relit toutes les 5 s tant que l'onglet est visible.
 * Chaque ligne se déplie sur sa pile et son contexte ; les lignes cochées
 * se suppriment d'un coup.
 */
export default function JournalErreurs() {
  useEnHautDePage('Journal des erreurs')
  useSiteEffects()
  const naviguer = useNavigate()
  const [erreurs, setErreurs] = useState()
  const [probleme, setProbleme] = useState(false)
  const [choisies, setChoisies] = useState(() => new Set())
  const [relire, setRelire] = useState(0)

  const basculer = id => setChoisies(avant => {
    const apres = new Set(avant)
    if (apres.has(id)) apres.delete(id); else apres.add(id)
    return apres
  })
  const toutes = erreurs?.length > 0 && erreurs.every(e => choisies.has(e.id))
  const basculerToutes = () => setChoisies(toutes ? new Set() : new Set(erreurs.map(e => e.id)))

  const supprimer = async () => {
    const n = choisies.size
    if (!window.confirm(`Supprimer ${n} erreur${n > 1 ? 's' : ''} du journal ? Cette action est définitive.`)) return
    try {
      await supprimerErreurs([...choisies])
      setChoisies(new Set())
      setRelire(x => x + 1)
    } catch {
      setProbleme(true)
    }
  }

  useEffect(() => {
    let actif = true
    const lire = () => {
      if (document.hidden) return
      lireErreurs()
        .then(liste => { if (actif) { setErreurs(liste); setProbleme(false) } })
        .catch(() => { if (actif) setProbleme(true) })
    }
    lire()
    const minuterie = setInterval(lire, CADENCE)
    document.addEventListener('visibilitychange', lire)
    return () => {
      actif = false
      clearInterval(minuterie)
      document.removeEventListener('visibilitychange', lire)
    }
  }, [relire])

  // Une erreur retirée entre-temps (autre onglet, rétention) ne reste pas cochée.
  useEffect(() => {
    if (!erreurs) return
    setChoisies(avant => {
      const presentes = new Set(erreurs.map(e => e.id))
      const apres = new Set([...avant].filter(id => presentes.has(id)))
      return apres.size === avant.size ? avant : apres
    })
  }, [erreurs])

  return (
    <>
      <main className="portal-page cr-assistant">
        <header className="cr-home-header cr-home-header--slim">
          <div className="container cr-entete-assistant">
            <button type="button" className="cr-retour" onClick={() => naviguer('/')}>
              ← Accueil
            </button>
            <h1 className="cr-home-title cr-home-title--sm">Journal des erreurs des comptes rendus</h1>
          </div>
        </header>

        <section className="cr-etape">
          <div className="container" style={{ padding: '12px 32px 20px' }}>
            <div className="cr-panel">
              {erreurs === null ? (
                <p className="cr-panel-hint">Accès réservé à l’équipe technique.</p>
              ) : (
                <>
                  <div className="cr-panel-head">
                    <h2 className="cr-panel-title">
                      {!erreurs ? 'Chargement…'
                        : erreurs.length ? `${erreurs.length} erreur${erreurs.length > 1 ? 's' : ''}`
                        : 'Aucune erreur enregistrée'}
                    </h2>
                    <p className="cr-panel-hint">
                      Erreurs du service des comptes rendus et de ses pages, mises à jour en temps réel.
                    </p>
                  </div>
                  {probleme && <p className="cr-panel-hint" role="alert">Journal indisponible pour le moment.</p>}
                  {erreurs?.length > 0 && (
                    <div className="cr-journal-actions">
                      <button type="button" className="cr-btn cr-btn--primary cr-btn--petit"
                        disabled={!choisies.size} onClick={supprimer}>
                        Supprimer{choisies.size ? ` (${choisies.size})` : ''}
                      </button>
                    </div>
                  )}
                  {erreurs?.length === 0 && <ListeVide />}
                  {erreurs?.length > 0 && (
                    <table className="cr-journal">
                      <thead>
                        <tr>
                          <th className="cr-journal-choix">
                            <input type="checkbox" checked={toutes} onChange={basculerToutes}
                              aria-label="Tout sélectionner" />
                          </th>
                          <th>Date</th><th>Origine</th><th>Utilisateur</th><th>Action</th><th>Message</th>
                        </tr>
                      </thead>
                      <tbody>
                        {erreurs.map(e => (
                          <tr key={e.id}>
                            <td className="cr-journal-choix">
                              <input type="checkbox" checked={choisies.has(e.id)} onChange={() => basculer(e.id)}
                                aria-label={`Sélectionner l’erreur du ${date(e.le)}`} />
                            </td>
                            <td>{date(e.le)}</td>
                            <td>{e.origine}</td>
                            <td>{e.nom || e.utilisateur || '—'}</td>
                            <td>{e.action}</td>
                            <td>
                              <details>
                                <summary>{e.message || 'détail'}</summary>
                                {e.detail && <pre>{e.detail}</pre>}
                                {Object.keys(e.contexte || {}).length > 0 &&
                                  <pre>{JSON.stringify(e.contexte, null, 2)}</pre>}
                              </details>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                </>
              )}
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
