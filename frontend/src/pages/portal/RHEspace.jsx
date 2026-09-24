import { useNavigate, useParams } from 'react-router-dom'
import Nav from '../../components/Nav'
import useSiteEffects from '../../hooks/useSiteEffects'
import '../../styles/compte-rendu.css'

/** Ce que chaque espace contiendra — dans l'ordre du cycle RH. */
const ESPACES = {
  recrutement: {
    titre: 'Recrutement',
    contenu: [
      'Créer une campagne : poste, filiale, BU, marques, niveaux, dates.',
      'Importer les candidats depuis Excel et leur assigner les tests.',
      'Suivre l’avancement des tests, puis exploiter les résultats.',
      'Décider, et faire passer les candidats retenus au statut de technicien.',
    ],
  },
  competences: {
    titre: 'Compétences',
    contenu: [
      'Ouvrir une campagne de mesure et planifier les tests par filiale.',
      'Suivre la couverture par filiale, agence et BU.',
      'Exploiter les résultats par niveau, marque et spécialité.',
    ],
  },
  pif: {
    titre: 'PIF',
    contenu: [
      'Plans individuels de formation par filiale et par BU (Motors, Equipment).',
      'Suivre les propositions et les validations.',
      'Relier chaque plan au planning des formations.',
    ],
  },
  personnes: {
    titre: 'Personnes',
    contenu: [
      'Candidats et techniciens : créer, modifier, supprimer.',
      'Suppression douce : corbeille avec date, auteur, motif, et restauration.',
      'Compléter les fiches sans filiale, BU ou niveau.',
    ],
  },
}

/** Page d'attente d'un espace RH, tant qu'il n'est pas construit. */
export default function RHEspace() {
  useSiteEffects()
  const naviguer = useNavigate()
  const { espace } = useParams()
  const e = ESPACES[espace] ?? { titre: 'Espace RH', contenu: [] }

  return (
    <>
      <Nav />
      <main className="portal-page cr-assistant">
        <header className="cr-home-header cr-home-header--slim">
          <div className="container cr-entete-assistant">
            <button type="button" className="cr-retour" onClick={() => naviguer('/portail')}>
              ← Accueil RH
            </button>
            <h1 className="cr-home-title cr-home-title--sm">{e.titre}</h1>
          </div>
        </header>
        <section className="cr-etape">
          <div className="container" style={{ padding: '12px 32px 20px' }}>
            <div className="cr-panel cr-panel--choix">
              <div className="cr-panel-head">
                <h2 className="cr-panel-title">Espace en préparation</h2>
                <p className="cr-panel-hint">Ce que cet espace réunira :</p>
              </div>
              <div className="portal-log-list">
                {e.contenu.map((l, i) => (
                  <div key={l} className="portal-log-item">
                    <span className="portal-log-time">{String(i + 1).padStart(2, '0')}</span>
                    <span className="portal-log-text">{l}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </>
  )
}
