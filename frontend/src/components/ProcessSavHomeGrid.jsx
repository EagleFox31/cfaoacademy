import PvCardGrid from './PvCardGrid.jsx'
import CatalogTrainingCard from './CatalogTrainingCard.jsx'

const SHOW_ALL_UP_TO = 12
const PREVIEW_LIMIT = 8

function homePreviewLimit(count) {
  return count > SHOW_ALL_UP_TO ? PREVIEW_LIMIT : null
}

/** Grille formations process SAV sur l'accueil — même pattern que carrosserie. */
export default function ProcessSavHomeGrid({ items, folder }) {
  if (!items?.length) {
    return <div className="empty-section">—</div>
  }

  return (
    <PvCardGrid limit={homePreviewLimit(items.length)}>
      {items.map((training) => (
        <CatalogTrainingCard key={training.code} folder={folder} training={training} />
      ))}
    </PvCardGrid>
  )
}
