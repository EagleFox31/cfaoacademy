import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import useEnHautDePage from '../hooks/useEnHautDePage'
import useSiteEffects from '../hooks/useSiteEffects'
import CarteCompteRendu, { BadgeCompteRendu, carteDeBrouillon } from '../components/compte-rendu/CarteCompteRendu'
import ListeVide from '../components/compte-rendu/ListeVide'
import { brouillonsTermines, synchroniser } from '../utils/brouillonsCompteRendu'
import '../styles/compte-rendu.css'

// Le bouton retour de l'assistant ramene a cette liste.
const DEPUIS = { chemin: '/portail/compte-rendu/mes-rapports', libelle: 'Comptes rendus terminés' }

/**
 * Les comptes rendus termines : l'archive du formateur.
 *
 * Un compte rendu y arrive des que toutes ses pages sont remplies — la
 * regle du sommaire de l'etape « Completer ». Chaque carte est la carte
 * commune du module (`CarteCompteRendu`), datee dans son badge. L'ouvrir mene a sa derniere etape, ou « Terminer »
 * telecharge le PowerPoint. Une correction qui laisse une page vide le
 * renvoie parmi les saisies en cours.
 */
export default function TrainerReportsTermines() {
  useEnHautDePage('Mes comptes rendus')
  useSiteEffects()
  const naviguer = useNavigate()
  const [termines, setTermines] = useState(() => brouillonsTermines())
  useEffect(() => {
    let actif = true
    synchroniser().then(liste => { if (actif && liste) setTermines(brouillonsTermines(liste)) })
    return () => { actif = false }
  }, [])

  const ouvrir = b => naviguer(`/portail/compte-rendu/nouveau?session=${b.id}`, { state: { depuis: DEPUIS } })

  return (
    <>
      <main className="portal-page cr-assistant">
        <header className="cr-home-header cr-home-header--slim">
          <div className="container cr-entete-assistant">
            <button type="button" className="cr-retour"
              onClick={() => naviguer('/')}>
              ← Accueil formateur
            </button>
            <h1 className="cr-home-title cr-home-title--sm">Mes comptes rendus</h1>
          </div>
        </header>

        <section className="cr-etape">
          <div className="container" style={{ padding: '12px 32px 20px' }}>
            <div className="cr-panel cr-panel--choix">
              <div className="cr-panel-head">
                <h2 className="cr-panel-title">
                  {termines.length
                    ? `${termines.length} compte${termines.length > 1 ? 's' : ''} rendu${termines.length > 1 ? 's' : ''} terminé${termines.length > 1 ? 's' : ''}`
                    : 'Aucun compte rendu terminé'}
                </h2>
                <p className="cr-panel-hint">
                  {termines.length
                    ? 'Toutes leurs pages sont remplies. Ouvrez-en un pour télécharger son PowerPoint.'
                    : 'Un compte rendu arrive ici dès que toutes ses pages sont remplies.'}
                </p>
              </div>

              {termines.length > 0 && (
                <div className="cr-session-grid">
                  {termines.map(b => (
                    <CarteCompteRendu key={b.id} carte={carteDeBrouillon(b)}
                      badge={<BadgeCompteRendu etat="termine" termineLe={b.termineLe} />}
                      onClick={() => ouvrir(b)} />
                  ))}
                </div>
              )}
              {termines.length === 0 && <ListeVide />}

              <div className="cr-echappee">
                <span className="cr-echappee-texte">Un autre compte rendu à rédiger ?</span>
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
