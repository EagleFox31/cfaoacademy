/**
 * Choix des parties du rapport.
 *
 * Le caractere obligatoire de chaque partie vient de l'analyse des 14
 * comptes rendus existants : une partie presente dans plus de 90 % des
 * rapports est imposee, les autres sont proposees. Le taux de presence
 * est affiche — c'est un argument, pas un decret, et un formateur qui
 * sait pourquoi une partie est recommandee decide mieux.
 *
 * Les parties automatiques (couverture, cloture) sont cochees et figees :
 * elles se composent depuis la fiche session, sans rien a saisir.
 */
export default function CrParties({ brouillon, maj, parties }) {
  const choisies = brouillon.parties || []

  function basculer(p) {
    if (p.obligatoire || p.auto) return
    maj({
      parties: choisies.includes(p.id)
        ? choisies.filter(x => x !== p.id)
        : [...choisies, p.id],
    })
  }

  const optionnelles = parties.filter(p => !p.obligatoire && !p.auto)
  const retenues = optionnelles.filter(p => choisies.includes(p.id)).length

  return (
    <div className="cr-panel">
      <div className="cr-panel-head">
        <h2 className="cr-panel-title">Que doit contenir le rapport ?</h2>
        <p className="cr-panel-hint">
          Les parties essentielles sont déjà retenues. Les autres sont
          facultatives — décochez ce que vous n’avez pas à documenter.
        </p>
      </div>

      <div className="cr-note cr-note--info">
        <span className="cr-note-icon" aria-hidden="true">●</span>
        <span>
          <strong>{choisies.length} parties</strong> retenues, dont {retenues} sur {optionnelles.length} facultatives.
          Le pourcentage indique la fréquence de chaque partie dans les comptes
          rendus existants.
        </span>
      </div>

      <div className="cr-parts">
        {parties.map(p => {
          const on = choisies.includes(p.id)
          const fige = p.obligatoire || p.auto
          const classes = ['cr-part']
          if (on) classes.push('cr-part--on')
          if (fige) classes.push('cr-part--fige')

          return (
            <label key={p.id} className={classes.join(' ')}>
              <input
                type="checkbox"
                checked={on}
                onChange={() => basculer(p)}
                disabled={fige}
                style={{ position: 'absolute', opacity: 0, pointerEvents: 'none' }}
              />
              <span className="cr-part-check" aria-hidden="true">{on ? '✓' : ''}</span>
              <span className="cr-part-body">
                <span className="cr-part-title">
                  {p.titre}
                  {p.obligatoire && <span className="cr-badge cr-badge--muted">Essentiel</span>}
                  {p.auto && <span className="cr-badge cr-badge--info">Automatique</span>}
                  <span style={{
                    fontFamily: "'JetBrains Mono', ui-monospace, monospace",
                    fontSize: 10.5, color: 'var(--muted-2)', fontWeight: 400,
                  }}>
                    {p.presence} % des rapports
                  </span>
                </span>
                <span className="cr-part-desc">{p.aide || p.resume}</span>
              </span>
            </label>
          )
        })}
      </div>
    </div>
  )
}
