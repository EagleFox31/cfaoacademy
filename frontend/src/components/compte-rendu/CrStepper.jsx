/**
 * Le fil de progression de l'assistant.
 *
 * Il sert autant a situer qu'a naviguer : chaque etape deja atteinte est
 * cliquable, pour revenir corriger une note sans perdre le reste. Les
 * etapes a venir restent inertes tant qu'aucune session n'est choisie —
 * il n'y a rien a y saisir.
 *
 * L'etat de chaque etape se lit a la pastille : pleine si l'etape est
 * complete, pointillee si elle est entamee, vide sinon. C'est le seul
 * retour dont un formateur presse a besoin pour voir ce qui manque.
 */
export default function CrStepper({ etapes, courante, etats, onAller, verrouAu }) {
  return (
    <nav className="cr-steps" aria-label="Étapes du compte rendu">
      {etapes.map((e, i) => {
        const etat = etats[e.cle] || 'vide'
        const actif = i === courante
        // Une etape depassee sans avoir ete remplie reste franchie : le
        // trait doit relier tout le chemin parcouru, sinon une etape
        // sautee donne l'impression que l'assistant a perdu le fil.
        const depassee = i < courante
        const fait = depassee && etat === 'complet'
        const partiel = depassee && etat !== 'complet'
        const bloque = i > verrouAu - 1 && i > courante

        const classes = ['cr-step']
        if (actif) classes.push('cr-step--current')
        if (fait) classes.push('cr-step--done')
        if (partiel) classes.push('cr-step--partiel')
        if (depassee) classes.push('cr-step--passee')

        return (
          <button
            key={e.cle}
            type="button"
            className={classes.join(' ')}
            onClick={() => onAller(i)}
            disabled={bloque}
            aria-current={actif ? 'step' : undefined}
            title={bloque ? 'Choisissez d’abord une session' : e.titre}
          >
            <span className="cr-step-dot" aria-hidden="true">
              {fait ? '✓' : partiel ? '·' : i + 1}
            </span>
            <span className="cr-step-label">{e.titre}</span>
          </button>
        )
      })}
    </nav>
  )
}
