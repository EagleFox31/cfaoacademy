import { useMemo } from 'react'
import useLocale from '../hooks/useLocale.js'
import { CARRO_TAB_KEYS } from '../i18n/home.js'
import { sectionTitle } from '../utils/sectionTitle.jsx'
import PreviewSection from './PreviewSection.jsx'
import BrandOfferGrid from './BrandOfferGrid.jsx'
import ProcessSavHomeGrid from './ProcessSavHomeGrid.jsx'
import CardRail from './CardRail.jsx'
import CatalogTrainingCard from './CatalogTrainingCard.jsx'
import { MOTORS_BRANDS, EQUIPMENT_BRANDS } from '../data/index.js'
import CATALOG from '../data/training-catalog.json'
import {
  EQUIPMENT_SAV_FOLDER,
  MOTORS_SAV_FOLDER,
  equipmentSavTabCounts,
  getEquipmentSavTrainings,
  getMotorsSavTrainings,
  motorsSavTabCounts,
} from '../utils/processSavCatalog.js'
import { getOfferCataloguePdf } from '../utils/offerCatalogues.js'

const carrosserieTabDefs = CATALOG.CARROSSERIE.map((g) => ({
  id: g.level,
  labelKey: CARRO_TAB_KEYS[g.level],
  count: g.trainings.length,
}))

const motorsSavCounts = motorsSavTabCounts()
const motorsSavTabs = [
  { id: 'sav', labelKey: 'savTabSav', count: motorsSavCounts.sav },
  { id: 'parts', labelKey: 'savTabParts', count: motorsSavCounts.parts },
]

const equipmentSavCounts = equipmentSavTabCounts()
const equipmentSavTabs = [
  { id: 'sav', labelKey: 'savTabSav', count: equipmentSavCounts.sav },
  { id: 'parts', labelKey: 'savTabParts', count: equipmentSavCounts.parts },
]

/**
 * Les offres de formations, telles que la page d'accueil les présente :
 * véhicules légers, engins et poids lourds, carrosserie, organisation SAV
 * Motors puis Equipment. Une seule définition, reprise par l'accueil et par
 * les portails. `backdrop={false}` retire le fond photo de l'accueil, pour une
 * page qui a déjà le sien.
 */
export default function HomeOfferSections({ backdrop = true }) {
  const { locale, t: homeT } = useLocale('home')
  const { t: commonT } = useLocale('common')
  const { t: cardsT } = useLocale('cards')
  const motorsSavTabsLocalized = useMemo(
    () => motorsSavTabs.map((t) => ({ id: t.id, label: homeT[t.labelKey], count: t.count })),
    [homeT],
  )
  const equipmentSavTabsLocalized = useMemo(
    () => equipmentSavTabs.map((t) => ({ id: t.id, label: homeT[t.labelKey], count: t.count })),
    [homeT],
  )
  const carrosserieTabsLocalized = useMemo(
    () => carrosserieTabDefs.map((t) => ({
      id: t.id,
      label: homeT[t.labelKey] ?? t.id,
      count: t.count,
    })),
    [homeT],
  )

  return (
    <>
      {/* ── 04 · FORMATIONS MOTORS ── */}
      <PreviewSection
        noBackdrop={!backdrop}
        id="offres"
        ix={homeT.motorsIx}
        title={sectionTitle(homeT.motorsTitleBefore, homeT.motorsTitleEm, homeT.motorsTitleAfter)}
        headClass="pv-head--compact-line"
        bgWord="motors"
        bgWordSide="right"      >
        <BrandOfferGrid
          brands={MOTORS_BRANDS}
        />
      </PreviewSection>

      {/* ── 05 · FORMATIONS EQUIPMENT ── */}
      <PreviewSection
        noBackdrop={!backdrop}
        id="formations-equipment"
        ix={homeT.equipmentIx}
        title={sectionTitle(homeT.equipmentTitleBefore, homeT.equipmentTitleEm, homeT.equipmentTitleAfter)}
        headClass="pv-head--compact-line"
        bgWord="equipment"
        bgWordSide="left"      >
        <BrandOfferGrid brands={EQUIPMENT_BRANDS} showAll />
      </PreviewSection>

      {/* ── 06 · FORMATIONS CARROSSERIE ── */}
      <PreviewSection
        noBackdrop={!backdrop}
        id="formations-carrosserie"
        ix={homeT.carrosserieIx}
        title={sectionTitle(homeT.carrosserieTitleBefore, homeT.carrosserieTitleEm, homeT.carrosserieTitleAfter)}
        headClass="pv-head--compact-line"
        bgWord="carrosserie"
        bgWordSide="left"
        tabs={carrosserieTabsLocalized}
        voir={{
          href: getOfferCataloguePdf('carrosserie', locale),
          label: cardsT.openCatalogue,
          filled: true,
        }}
      >
        {(active) => {
          const group = CATALOG.CARROSSERIE.find((g) => g.level === active)
          return (
            <CardRail
              ariaLabel={homeT.carrosserieIx ?? 'Formations carrosserie'}
              arrowLabelPrev={commonT.prev ?? 'Précédent'}
              arrowLabelNext={commonT.next ?? 'Suivant'}
            >
              {group?.trainings.map((f) => (
                <CatalogTrainingCard portal={!backdrop} key={f.code} folder="carrosserie" training={f} />
              ))}
            </CardRail>
          )
        }}
      </PreviewSection>

      {/* ── 07 · ORGANISATION SAV MOTORS ── */}
      <PreviewSection
        noBackdrop={!backdrop}
        id="formations-sav-motors"
        ix={homeT.savMotorsIx}
        title={sectionTitle(homeT.savMotorsTitleBefore, homeT.savMotorsTitleEm, homeT.savMotorsTitleAfter)}
        headClass="pv-head--compact-line"
        bgWord="sav"
        bgWordSide="right"        tabs={motorsSavTabsLocalized}
        voir={{
          href: getOfferCataloguePdf('savMotors', locale),
          label: cardsT.openCatalogue,
          filled: true,
        }}
      >
        {(active) => (
          <ProcessSavHomeGrid
            key={active}
            items={getMotorsSavTrainings(active)}
            folder={MOTORS_SAV_FOLDER[active]}
          />
        )}
      </PreviewSection>

      {/* ── 08 · ORGANISATION SAV EQUIPMENT ── */}
      <PreviewSection
        noBackdrop={!backdrop}
        id="formations-sav-equipment"
        ix={homeT.savEquipmentIx}
        title={sectionTitle(homeT.savEquipmentTitleBefore, homeT.savEquipmentTitleEm, homeT.savEquipmentTitleAfter)}
        headClass="pv-head--compact-line"
        bgWord="sav"
        bgWordSide="right"        tabs={equipmentSavTabsLocalized}
        voir={{
          href: getOfferCataloguePdf('savEquipment', locale),
          label: cardsT.openCatalogue,
          filled: true,
        }}
      >
        {(active) => (
          <ProcessSavHomeGrid
            key={active}
            items={getEquipmentSavTrainings(active)}
            folder={EQUIPMENT_SAV_FOLDER[active]}
          />
        )}
      </PreviewSection>
    </>
  )
}
