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

const ICONE = {
  width: 20, height: 20, viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 1.8, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
}

/** Pied de carte des portails : l'œil à gauche pour voir, le crayon à droite pour modifier. */
function ActionsPortail({ voir, modifier }) {
  return (
    <>
      <span className="pv-card-action" title={voir} aria-label={voir}>
        <svg {...ICONE}>
          <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7-10-7-10-7Z" />
          <circle cx="12" cy="12" r="3" />
        </svg>
      </span>
      <span className="pv-card-action pv-card-action--soon" title={modifier} aria-label={modifier}>
        <svg {...ICONE}>
          <path d="M17 3a2.85 2.85 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
          <path d="m15 5 4 4" />
        </svg>
      </span>
    </>
  )
}

/**
 * `portal` : dans un portail, le lien « Voir la fiche » laisse la place à deux
 * icônes (voir, modifier).
 */
export default function CatalogTrainingCard({ folder, training, portal = false }) {

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
      actions={portal ? <ActionsPortail voir={cardsT.sessionFicheHint} modifier={cardsT.sessionEditSoon} /> : undefined}

      hoverHint={cardsT.sessionFicheHint}

    />

  )

}

