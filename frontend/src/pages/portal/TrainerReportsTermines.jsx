import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Nav from '../../components/Nav'
import useSiteEffects from '../../hooks/useSiteEffects'
import { periodeLongue } from '../../utils/compteRendu'
import { brouillonsTermines, synchroniser } from '../../utils/brouillonsCompteRendu'
import '../../styles/compte-rendu.css'

/** « le 28 septembre 2026 », pour dater un compte rendu termine. */
function dateLongue(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' })
}

/**
 * Les comptes rendus termines : l'archive du formateur.
 *
 * Un compte rendu y arrive des que toutes ses pages sont remplies — la
 * regle du sommaire de l'etape « Completer ». Chaque carte se presente
 * comme une saisie en cours — code, intitule, periode, effectif — avec
 * sa date de fin. L'ouvrir mene a sa derniere etape, ou « Terminer »
 * telecharge le PowerPoint. Une correction qui laisse une page vide le
 * renvoie parmi les saisies en cours.
 */
export default function TrainerReportsTermines() {
  useSiteEffects()
  const naviguer = useNavigate()
  const [termines, setTermines] = useState(() => brouillonsTermines())
  useEffect(() => {
    let actif = true
    synchroniser().then(liste => { if (actif && liste) setTermines(brouillonsTermines(liste)) })
    return () => { actif = false }
  }, [])

  const ouvrir = b => naviguer(`/portail/compte-rendu/nouveau?session=${b.id}`)

  return (
    <>
      <Nav />
      <main className="portal-page cr-assistant">
        <header className="cr-home-header cr-home-header--slim">
          <div className="container cr-entete-assistant">
            <button type="button" className="cr-retour"
              onClick={() => naviguer('/portail/formateur')}>
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
                    <div key={b.id} className="cr-session cr-brouillon" role="button" tabIndex={0}
                      onClick={() => ouvrir(b)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); ouvrir(b) }
                      }}>
                      <div className="cr-session-top">
                        <span className="cr-session-code">
                          {b.code || (b.manuel ? 'Saisie libre' : '—')}
                        </span>
                        <span className="cr-badge cr-badge--ok">Terminé</span>
                      </div>
                      <h3 className="cr-session-title" title={b.session || ''}>
                        {b.session || 'Compte rendu sans intitulé'}
                      </h3>
                      <div className="cr-session-meta">
                        {b.debut && <span>{periodeLongue(b.debut, b.fin)}</span>}
                        <span>{b.effectif} {b.certification ? 'candidat' : 'stagiaire'}{b.effectif > 1 ? 's' : ''}</span>
                      </div>
                      <div className="cr-session-meta">
                        <span>Terminé {dateLongue(b.termineLe) && `le ${dateLongue(b.termineLe)}`}</span>
                        <span>{b.certification ? 'Certification' : 'Formation'}</span>
                      </div>
                      <div className="cr-brouillon-pied">
                        <span className="cr-brouillon-reprendre">Ouvrir →</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

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
