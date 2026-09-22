import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import Nav from '../../components/Nav'
import Footer from '../../components/Footer'
import useSiteEffects from '../../hooks/useSiteEffects'
import {
  SESSIONS_FORMATEUR,
  SESSION_STATUTS,
} from '../../data/mock_sessions_formateur'
import { periodeLongue } from '../../utils/compteRendu'
import { brouillonsEnregistres } from '../../utils/brouillonsCompteRendu'
import '../../styles/compte-rendu.css'

/**
 * Accueil du formateur, calque sur le tableau de bord du technicien.
 *
 * Deux sections, dans l'ordre ou le formateur en a besoin :
 *
 *   1. **A faire maintenant** — les sessions terminees sans compte
 *      rendu. C'est la seule chose qui presse, et c'est ce qu'il vient
 *      chercher en ouvrant l'outil.
 *   2. **Comptes rendus** — les entrees du module : en commencer un,
 *      reprendre un brouillon, consulter les precedents.
 *
 * Le parcours de redaction lui-meme tient en trois phases. Une session
 * de formation se documente le vendredi soir, entre deux trains : un
 * assistant qui annonce neuf etapes fait reporter la tache.
 */
export default function TrainerHome() {
  useSiteEffects()
  const naviguer = useNavigate()

  const aRediger = useMemo(
    () => SESSIONS_FORMATEUR.filter(s => s.statut === 'a_rediger'),
    [],
  )
  const brouillons = useMemo(() => brouillonsEnregistres(), [])
  const termines = useMemo(
    () => SESSIONS_FORMATEUR.filter(s => s.statut === 'termine'),
    [],
  )

  return (
    <>
      <Nav />
      <main className="portal-page">
        {/* ── En-tete ─────────────────────────────────────────── */}
        <header className="cr-home-header">
          <div className="container" style={{ padding: '38px 32px 30px' }}>
            <span className="cr-home-role">Formateur</span>
            <h1 className="cr-home-title">Bonjour, Eugène</h1>
            <p className="cr-home-sub">
              {aRediger.length > 0
                ? `${aRediger.length} session${aRediger.length > 1 ? 's' : ''} attend${aRediger.length > 1 ? 'ent' : ''} son compte rendu.`
                : 'Aucun compte rendu en attente.'}
            </p>
          </div>
        </header>

        {/* ── 1. À faire maintenant ───────────────────────────── */}
        {aRediger.length > 0 && (
          <section id="a-faire" className="cr-section-claire">
            <div className="container" style={{ padding: '30px 32px 8px' }}>
              <div className="portal-section-head">
                <p className="portal-section-eyebrow">Priorité — compte rendu</p>
                <h2 className="portal-section-title">À faire maintenant</h2>
              </div>
              {/* Une session a documenter n'est pas un contenu a
                  illustrer : la carte porte l'information utile, sans
                  visuel qui ne dirait rien de plus. */}
              <div className="cr-card-grid">
                {aRediger.map(s => (
                  <button key={s.id} type="button" className="cr-todo"
                    onClick={() => naviguer(`/portail/compte-rendu/nouveau?session=${s.id}`)}>
                    <span className="cr-todo-tete">
                      <span className="cr-session-code">{s.codeSession}</span>
                      <span className="cr-badge cr-badge--warn">À rédiger</span>
                    </span>
                    <span className="cr-todo-titre">{s.moduleFormation}</span>
                    <span className="cr-session-meta">
                      <span>{periodeLongue(s.debut, s.fin)}</span>
                      <span>{s.participants.length} participants</span>
                    </span>
                    <span className="cr-session-meta">
                      <span>{s.marque}</span>
                      <span>{s.lieu}</span>
                    </span>
                    <span className="cr-todo-action">Rédiger le compte rendu →</span>
                  </button>
                ))}
              </div>
            </div>
          </section>
        )}

        {/* ── 2. Comptes rendus ───────────────────────────────── */}
        <section id="comptes-rendus" className="cr-section-claire">
          <div className="container" style={{ padding: '24px 32px 56px' }}>
            <div className="portal-section-head">
              <p className="portal-section-eyebrow">Vos documents</p>
              <h2 className="portal-section-title">Comptes rendus</h2>
            </div>

            <div className="cr-entries">
              <button type="button" className="cr-entry cr-entry--primary"
                onClick={() => naviguer('/portail/compte-rendu/nouveau')}>
                <span className="cr-entry-mark" aria-hidden="true">+</span>
                <span className="cr-entry-body">
                  <span className="cr-entry-title">Nouveau compte rendu</span>
                  <span className="cr-entry-desc">
                    Depuis une session planifiée, ou en saisissant tout
                    manuellement.
                  </span>
                </span>
              </button>

              <button type="button" className="cr-entry"
                onClick={() => naviguer('/portail/compte-rendu/mes-rapports')}>
                <span className="cr-entry-mark" aria-hidden="true">▤</span>
                <span className="cr-entry-body">
                  <span className="cr-entry-title">
                    Mes comptes rendus
                    {termines.length > 0 && (
                      <span className="cr-entry-count">{termines.length}</span>
                    )}
                  </span>
                  <span className="cr-entry-desc">
                    Consulter, télécharger ou reprendre un rapport produit.
                  </span>
                </span>
              </button>

              {brouillons.length > 0 && (
                <button type="button" className="cr-entry cr-entry--draft"
                  onClick={() => naviguer('/portail/compte-rendu/nouveau')}>
                  <span className="cr-entry-mark" aria-hidden="true">⟳</span>
                  <span className="cr-entry-body">
                    <span className="cr-entry-title">
                      Reprendre
                      <span className="cr-entry-count">{brouillons.length}</span>
                    </span>
                    <span className="cr-entry-desc">
                      {brouillons[0].session || 'Compte rendu'} — saisie en cours.
                    </span>
                  </span>
                </button>
              )}
            </div>
          </div>
        </section>
      </main>
      <Footer />
    </>
  )
}

