import { useEffect, useState } from 'react'
import useEnHautDePage from '../hooks/useEnHautDePage'
import useSiteEffects from '../hooks/useSiteEffects'
import { lireErreurs } from '../utils/journalErreurs'
import '../styles/compte-rendu.css'

const ORIGINES = [['', 'Toutes'], ['service', 'Service'], ['portail', 'Portail']]

const date = iso => new Date(iso).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'medium' })

/**
 * Le journal des erreurs des comptes rendus, pour l'équipe technique.
 *
 * Lien direct du module (`/portail/journal-erreurs`, aussi renvoyé par le portail). Le service
 * décide seul qui le lit (Cerbos) ; un refus affiche l'accès réservé.
 * Chaque ligne se déplie sur sa pile et son contexte.
 */
export default function JournalErreurs() {
  useEnHautDePage('Journal des erreurs')
  useSiteEffects()
  const [origine, setOrigine] = useState('')
  const [erreurs, setErreurs] = useState()
  const [probleme, setProbleme] = useState(false)
  const [rafraichi, setRafraichi] = useState(0)

  useEffect(() => {
    let actif = true
    setProbleme(false)
    lireErreurs(origine)
      .then(liste => { if (actif) setErreurs(liste) })
      .catch(() => { if (actif) setProbleme(true) })
    return () => { actif = false }
  }, [origine, rafraichi])

  return (
    <>
      <main className="portal-page cr-assistant">
        <header className="cr-home-header cr-home-header--slim">
          <div className="container cr-entete-assistant">
            <h1 className="cr-home-title cr-home-title--sm">Journal des erreurs</h1>
          </div>
        </header>

        <section className="cr-etape">
          <div className="container" style={{ padding: '12px 32px 20px' }}>
            <div className="cr-panel">
              {erreurs === null ? (
                <p className="cr-panel-hint">Accès réservé à l’équipe technique.</p>
              ) : (
                <>
                  <div className="cr-panel-head cr-journal-outils">
                    <h2 className="cr-panel-title">
                      {erreurs ? `${erreurs.length} erreur${erreurs.length > 1 ? 's' : ''}` : 'Chargement…'}
                    </h2>
                    <label>
                      Origine{' '}
                      <select value={origine} onChange={e => setOrigine(e.target.value)}>
                        {ORIGINES.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                      </select>
                    </label>
                    <button type="button" className="cr-echappee-lien" onClick={() => setRafraichi(n => n + 1)}>
                      Actualiser
                    </button>
                  </div>
                  {probleme && <p className="cr-panel-hint" role="alert">Journal indisponible pour le moment.</p>}
                  {erreurs?.length === 0 && <p className="cr-panel-hint">Aucune erreur enregistrée.</p>}
                  {erreurs?.length > 0 && (
                    <table className="cr-journal">
                      <thead>
                        <tr><th>Date</th><th>Origine</th><th>Utilisateur</th><th>Action</th><th>Message</th></tr>
                      </thead>
                      <tbody>
                        {erreurs.map(e => (
                          <tr key={e.id}>
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
