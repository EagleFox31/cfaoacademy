import PvCard from './PvCard.jsx'
import FormateurDisplay from './FormateurDisplay.jsx'
import { fichePath, formationFicheRoute } from '../utils/formationFiche.js'
import { resolveCatalogFormateurDisplay } from '../utils/catalogFormateur.js'
import { resolveProcessSavCardBadge, resolveProcessSavCardImage, isProcessSavFolder } from '../utils/processSavCatalog.js'
import { CARROSSERIE_CARD_IMG } from '../data/homeSectionBg.js'
import useLocale from '../hooks/useLocale.js'
import {
  localizedCardBrandBadge,
  localizedCatalogTrainingFields,
} from '../utils/localizeCard.js'

/** Carte offre catalogue — page détail fiche + formateur métier (marque / process). */
export default function CatalogTrainingCard({ folder, training }) {
  const { locale, t: cardsT } = useLocale('cards')
  const copy = localizedCatalogTrainingFields(training, locale)
  const isCarrosserie = folder === 'carrosserie'
  const isProcessSav = isProcessSavFolder(folder)
  const processCardImg = isProcessSav ? resolveProcessSavCardImage(folder) : null
  const formateurDisplay = resolveCatalogFormateurDisplay({ folder, training })

  const processCtx = folder?.includes('equipment')
    ? { tagClass: 'parts-eq', bu: 'Parts & Process Equipment' }
    : { tagClass: 'parts-motors', bu: 'Parts & Process Motors' }
  const badgeSource = isCarrosserie
    ? 'CARROSSERIE'
    : isProcessSav
      ? (training.catalogBrand?.replace(/_/g, ' ') ?? 'TOUTES MARQUES')
      : null
  const badgeCtx = isCarrosserie
    ? { tagClass: 'carrosserie', bu: 'Carrosserie' }
    : processCtx
  const rawBadge = badgeSource
    ? (isProcessSav ? resolveProcessSavCardBadge({ folder, training }) : {})
    : {}
  const { logo, label: brandLabel } = badgeSource && !rawBadge.logo
    ? localizedCardBrandBadge(badgeSource, badgeCtx, locale)
    : rawBadge

  return (
    <PvCard
      to={formationFicheRoute(training.code)}
      variant={isCarrosserie || processCardImg ? undefined : 'doc'}
      corner
      logo={logo}
      brandLabel={brandLabel}
      img={
        isCarrosserie
          ? CARROSSERIE_CARD_IMG
          : processCardImg ?? fichePath(folder, training.code)
      }
      kicker={copy.kicker}
      title={copy.title}
      meta={(
        <div className="pv-card-meta--session">
          <span>{copy.meta}</span>
          {formateurDisplay && (
            <FormateurDisplay
              display={formateurDisplay}
              variant="card"
              className="pv-card-meta-formateur"
            />
          )}
        </div>
      )}
      cta={cardsT.sessionFiche}
      hoverHint={cardsT.sessionFicheHint}
    />
  )
}
