import CardRail from './CardRail.jsx'
import CatalogTrainingCard from './CatalogTrainingCard.jsx'
import useLocale from '../hooks/useLocale.js'

/** Grille formations process SAV sur l'accueil — rail horizontal. */
export default function ProcessSavHomeGrid({ items, folder }) {
  const { t: commonT } = useLocale('common')

  if (!items?.length) {
    return <div className="empty-section">—</div>
  }

  return (
    <CardRail
      ariaLabel="Formations SAV"
      arrowLabelPrev={commonT.prev ?? 'Précédent'}
      arrowLabelNext={commonT.next ?? 'Suivant'}
    >
      {items.map((training) => (
        <CatalogTrainingCard key={training.code} folder={folder} training={training} />
      ))}
    </CardRail>
  )
}
