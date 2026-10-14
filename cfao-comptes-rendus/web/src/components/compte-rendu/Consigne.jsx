/**
 * Ce qu'il faut faire sur l'ecran, et ce qui vient ensuite.
 *
 * Les formateurs ouvrent l'assistant quelques fois par mois : entre deux
 * usages, ils oublient. Chaque ecran porte donc sa consigne en tete, en
 * une phrase qui commence par un verbe, et annonce la suite — plutot
 * qu'un titre suivi d'une explication en petit.
 */
export default function Consigne({ faire, ensuite, children, className = '' }) {
  return (
    <div className={`cr-consigne ${className}`.trim()}>
      <div className="cr-consigne-texte">
        <p className="cr-consigne-faire">{faire}</p>
        {ensuite && <p className="cr-consigne-ensuite">{ensuite}</p>}
      </div>
      {children && <div className="cr-consigne-actions">{children}</div>}
    </div>
  )
}
