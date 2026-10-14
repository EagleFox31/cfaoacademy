import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../lib/auth'
import useEnHautDePage from '../hooks/useEnHautDePage'
import useSiteEffects from '../hooks/useSiteEffects'
import { sessionsDuFormateur } from '../data/mock_sessions_formateur'
import CarteCompteRendu, {
  BadgeCompteRendu, carteDeBrouillon, carteDeSession,
} from '../components/compte-rendu/CarteCompteRendu'
import { brouillonsEnregistres, oublier, synchroniser } from '../utils/brouillonsCompteRendu'
import { aDocumenter } from '../utils/planningFormateur.js'
import '../styles/compte-rendu.css'

/**
 * Les comptes rendus commences, avant d'en reprendre un.
 *
 * L'accueil n'y mene plus que par une carte : une carte par brouillon
 * noyait les entrees du module des qu'il y en avait trois ou quatre.
 * Ici chaque saisie se presente comme une session du planning — code,
 * intitule, periode, effectif — avec ce qui distingue un brouillon :
 * l'etape atteinte, les notes deja saisies, la derniere modification.
 * Un clic la reprend ; la corbeille la supprime, apres confirmation.
 *
 * Avec `aDocumenterAussi` (carte « Comptes rendus a documenter » de
 * l'accueil), la page liste aussi ce qui reste a commencer : les sessions
 * de formation passees qui n'ont encore aucun compte rendu.
 */
export default function TrainerReportsEnCours({ aDocumenterAussi = false }) {
  useEnHautDePage('Comptes rendus en cours')
  useSiteEffects()
  const naviguer = useNavigate()
  const { user } = useAuth()
  const sessions = useMemo(() => sessionsDuFormateur(user), [user])
  const [tous, setTous] = useState(() => brouillonsEnregistres())
  useEffect(() => {
    let actif = true
    synchroniser().then(liste => { if (actif && liste) setTous(liste) })
    return () => { actif = false }
  }, [])
  const { aContinuer: brouillons, aCommencer } = aDocumenter(sessions, tous)
  const commencer = s => naviguer(`/portail/compte-rendu/nouveau?session=${s.id}`)

  const reprendre = b => naviguer(`/portail/compte-rendu/nouveau?session=${b.id}`)

  function supprimer(b) {
    const titre = b.session || 'ce compte rendu'
    if (!window.confirm(`Supprimer « ${titre} » ? Les notes, textes et photos déjà `
      + 'saisis seront perdus.')) return
    oublier(b.id)
    setTous(brouillonsEnregistres())
  }

  return (
    <>
      <main className="portal-page cr-assistant">
        <header className="cr-home-header cr-home-header--slim">
          <div className="container cr-entete-assistant">
            <button type="button" className="cr-retour"
              onClick={() => naviguer('/')}>
              ← Mes comptes rendus
            </button>
            <h1 className="cr-home-title cr-home-title--sm">
              {aDocumenterAussi ? 'Comptes rendus à documenter' : 'Comptes rendus en cours'}
            </h1>
          </div>
        </header>

        <section className="cr-etape">
          <div className="container" style={{ padding: '12px 32px 20px' }}>
            <div className="cr-panel cr-panel--choix">
              {/* Les deux groupes defilent ensemble ; l'echappee reste au bas. */}
              <div className="cr-groupes">
                <div className="cr-panel-head">
                  <h2 className="cr-panel-title">
                    {aDocumenterAussi ? `À continuer (${brouillons.length})` : 'Reprendre une saisie'}
                  </h2>
                  <p className="cr-panel-hint">
                    {brouillons.length
                      ? 'Les comptes rendus commencés, du plus récent au plus ancien.'
                      : 'Aucun compte rendu en cours.'}
                  </p>
                </div>

                {brouillons.length > 0 && (
                  <div className="cr-session-grid">
                    {brouillons.map(b => (
                      <CarteCompteRendu key={b.id} carte={carteDeBrouillon(b)}
                        badge={<BadgeCompteRendu etat="en_cours_redaction" phase={b.phase} />}
                        onClick={() => reprendre(b)} onSupprimer={() => supprimer(b)} />
                    ))}
                  </div>
                )}

                {aDocumenterAussi && (
                  <>
                    <div className="cr-panel-head cr-panel-head--suite">
                      <h2 className="cr-panel-title">À commencer ({aCommencer.length})</h2>
                      <p className="cr-panel-hint">
                        {aCommencer.length
                          ? 'Les sessions de formation passées qui attendent encore leur compte rendu.'
                          : 'Toutes vos sessions de formation passées ont leur compte rendu.'}
                      </p>
                    </div>
                    {aCommencer.length > 0 && (
                      <div className="cr-session-grid">
                        {aCommencer.map(s => (
                          <CarteCompteRendu key={s.id} carte={carteDeSession(s)}
                            badge={<BadgeCompteRendu etat="a_rediger" />}
                            onClick={() => commencer(s)} />
                        ))}
                      </div>
                    )}
                  </>
                )}
              </div>

              <div className="cr-echappee">
                <span className="cr-echappee-texte">Une autre formation à documenter ?</span>
                <button type="button" className="cr-echappee-lien"
                  onClick={() => naviguer('/portail/compte-rendu/nouveau')}>
                  Nouveau compte rendu →
                </button>
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
