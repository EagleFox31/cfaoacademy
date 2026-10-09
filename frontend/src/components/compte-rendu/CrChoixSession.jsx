import { periodeLongue } from '../../utils/compteRendu'

/**
 * Premiere etape : choisir la session a documenter.
 *
 * Les sessions sont triees par urgence, pas par date : celles qui
 * attendent un compte rendu viennent d'abord. Un formateur qui ouvre
 * l'outil vient le plus souvent pour la session qu'il vient de finir.
 *
 * Les sessions a venir sont affichees mais non cliquables : il n'y a
 * rien a raconter d'une formation qui n'a pas eu lieu, et les masquer
 * laisserait croire a un oubli.
 */
const ORDRE = { a_rediger: 0, en_cours: 1, termine: 2, a_venir: 3 }

export default function CrChoixSession({ sessions, statuts, choisi, onChoisir }) {
  const tri = [...sessions].sort(
    (a, b) => (ORDRE[a.statut] ?? 9) - (ORDRE[b.statut] ?? 9)
      || new Date(b.debut) - new Date(a.debut),
  )
  const aRediger = tri.filter(s => s.statut === 'a_rediger').length

  return (
    <div className="cr-panel">
      <div className="cr-panel-head">
        <h2 className="cr-panel-title">Quelle formation voulez-vous documenter ?</h2>
        <p className="cr-panel-hint">
          Choisissez la session dans la liste. Tout ce qui est déjà connu —
          intitulé, dates, lieu, participants — sera repris automatiquement.
        </p>
      </div>

      {aRediger > 0 && (
        <div className="cr-note cr-note--warn">
          <span className="cr-note-icon" aria-hidden="true">●</span>
          <span>
            <strong>{aRediger} session{aRediger > 1 ? 's' : ''}</strong> en attente
            de compte rendu.
          </span>
        </div>
      )}

      <div className="cr-session-grid">
        {tri.map(s => {
          const statut = statuts[s.statut] || { label: 'À venir', tone: 'muted' }
          const futur = s.statut === 'a_venir'
          return (
            <button
              key={s.id}
              type="button"
              className={`cr-session${choisi === s.id ? ' cr-session--active' : ''}`}
              onClick={() => !futur && onChoisir(s)}
              disabled={futur}
              style={futur ? { opacity: .5, cursor: 'not-allowed' } : undefined}
              title={futur ? 'La session n’a pas encore eu lieu' : undefined}
            >
              <div className="cr-session-top">
                <span className="cr-session-code">{s.codeSession}</span>
                <span className={`cr-badge cr-badge--${statut.tone}`}>{statut.label}</span>
              </div>
              <h3 className="cr-session-title">{s.moduleFormation}</h3>
              <div className="cr-session-meta">
                <span>{periodeLongue(s.debut, s.fin)}</span>
                <span>{s.participants.length} participant{s.participants.length > 1 ? 's' : ''}</span>
              </div>
              <div className="cr-session-meta">
                <span>{s.marque}</span>
                <span>{s.lieu}</span>
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
