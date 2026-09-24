import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Nav from '../../components/Nav'
import useSiteEffects from '../../hooks/useSiteEffects'
import { periodeLongue } from '../../utils/compteRendu'
import { brouillonsEnregistres, oublier } from '../../utils/brouillonsCompteRendu'
import '../../styles/compte-rendu.css'

const ETAPES = ['La session', 'Les résultats', 'La structure', 'L’édition']

/** « il y a 2 jours », pour situer une reprise sans afficher une date brute. */
function venuDe(iso) {
  if (!iso) return ''
  const jours = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000)
  if (jours <= 0) return "aujourd'hui"
  if (jours === 1) return 'hier'
  if (jours < 14) return `il y a ${jours} jours`
  return `il y a ${Math.round(jours / 7)} semaines`
}

function IconeCorbeille() {
  return (
    <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor"
      strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 7h16M9.5 7V4.5h5V7M6.5 7l.9 12.5h9.2L17.5 7M10 11v5M14 11v5" />
    </svg>
  )
}

/**
 * Les comptes rendus commences, avant d'en reprendre un.
 *
 * L'accueil n'y mene plus que par une carte : une carte par brouillon
 * noyait les entrees du module des qu'il y en avait trois ou quatre.
 * Ici chaque saisie se presente comme une session du planning — code,
 * intitule, periode, effectif — avec ce qui distingue un brouillon :
 * l'etape atteinte, les notes deja saisies, la derniere modification.
 * Un clic la reprend ; la corbeille la supprime, apres confirmation.
 */
export default function TrainerReportsEnCours() {
  useSiteEffects()
  const naviguer = useNavigate()
  const [brouillons, setBrouillons] = useState(() => brouillonsEnregistres())

  const reprendre = b => naviguer(`/portail/compte-rendu/nouveau?session=${b.id}`)

  function supprimer(b) {
    const titre = b.session || 'ce compte rendu'
    if (!window.confirm(`Supprimer « ${titre} » ? Les notes, textes et photos déjà `
      + 'saisis seront perdus.')) return
    oublier(b.id)
    setBrouillons(brouillonsEnregistres())
  }

  return (
    <>
      <Nav />
      <main className="portal-page cr-assistant">
        <header className="cr-home-header cr-home-header--slim">
          <div className="container cr-entete-assistant">
            <button type="button" className="cr-retour"
              onClick={() => naviguer('/portail/formateur')}>
              ← Mes comptes rendus
            </button>
            <h1 className="cr-home-title cr-home-title--sm">Comptes rendus en cours</h1>
          </div>
        </header>

        <section className="cr-etape">
          <div className="container" style={{ padding: '12px 32px 20px' }}>
            <div className="cr-panel cr-panel--choix">
              <div className="cr-panel-head">
                <h2 className="cr-panel-title">Reprendre une saisie</h2>
                <p className="cr-panel-hint">
                  {brouillons.length
                    ? 'Les comptes rendus commencés, du plus récent au plus ancien.'
                    : 'Aucun compte rendu en cours.'}
                </p>
              </div>

              {brouillons.length > 0 && (
                <div className="cr-session-grid">
                  {brouillons.map(b => (
                    <div key={b.id} className="cr-session cr-brouillon" role="button" tabIndex={0}
                      onClick={() => reprendre(b)}
                      onKeyDown={e => {
                        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); reprendre(b) }
                      }}>
                      <div className="cr-session-top">
                        <span className="cr-session-code">
                          {b.code || (b.manuel ? 'Saisie libre' : '—')}
                        </span>
                        <span className="cr-badge cr-badge--warn">
                          Étape {Math.min(b.phase, 3) + 1} · {ETAPES[Math.min(b.phase, 3)]}
                        </span>
                      </div>
                      <h3 className="cr-session-title">{b.session || 'Compte rendu sans intitulé'}</h3>
                      <div className="cr-session-meta">
                        {b.debut && <span>{periodeLongue(b.debut, b.fin)}</span>}
                        <span>{b.effectif} participant{b.effectif > 1 ? 's' : ''}</span>
                      </div>
                      <div className="cr-session-meta">
                        <span>
                          {b.notes ? `Notes : ${b.notes}/${b.effectif}` : 'Aucune note saisie'}
                        </span>
                        <span>Modifié {venuDe(b.modifieLe)}</span>
                      </div>
                      <div className="cr-brouillon-pied">
                        <span className="cr-brouillon-reprendre">Reprendre →</span>
                        <button type="button" className="cr-brouillon-suppr"
                          title="Supprimer ce compte rendu en cours"
                          onClick={e => { e.stopPropagation(); supprimer(b) }}
                          onKeyDown={e => e.stopPropagation()}>
                          <IconeCorbeille /> Supprimer
                        </button>
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
