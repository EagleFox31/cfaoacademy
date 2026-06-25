import { useMemo, useState } from 'react'
import SitePageLayout from '../components/SitePageLayout.jsx'
import PageHeader from '../components/PageHeader.jsx'
import LogoMarquee from '../components/LogoMarquee.jsx'
import PreviewSection from '../components/PreviewSection.jsx'
import PvCard from '../components/PvCard.jsx'
import CardCarousel from '../components/CardCarousel.jsx'
import CtaBanner from '../components/CtaBanner.jsx'
import FormateurDisplay from '../components/FormateurDisplay.jsx'
import { STATS } from '../data/index.js'
import CATALOG from '../data/training-catalog.json'
import { BRAND_FOLDER, fichePath, formationFicheRoute } from '../utils/formationFiche.js'
import { resolveBrandFormateurDisplay } from '../utils/catalogFormateur.js'
import { flattenProcessBrands, resolveProcessSavCardBadge, resolveProcessSavCardImage } from '../utils/processSavCatalog.js'
import useLocale from '../hooks/useLocale.js'
import {
  CARRO_TAB_KEYS,
  LEVEL_TAB_KEYS,
  PROCESS_PUBLIC_FILTERS,
} from '../i18n/home.js'
import {
  localizedCardBrandBadge,
  localizedCatalogTrainingFields,
} from '../utils/localizeCard.js'

// ── Logos ──────────────────────────────────────────────────────────────────
const BRAND_LOGO = {
  'TOYOTA':           '/assets/logos/toyota.png',
  'SUZUKI':           '/assets/logos/suzuki.png',
  'BYD':              '/assets/logos/byd.png',
  'MERCEDES':         '/assets/logos/mercedes.png',
  'MITSUBISHI':       '/assets/logos/mitsubishi.png',
  'OMODA & JAECCO':   '/assets/logos/omoda.png',
  'STELLANTIS':       '/assets/logos/stellantis.png',
  'JCB':              '/assets/logos/jcb.png',
  'LOVOL':            '/assets/logos/lovol.png',
  'TOYOTA FORKLIFT':  '/assets/logos/toyota-forklift.png',
  'FUSO':             '/assets/logos/fuso.png',
  'HINO':             '/assets/logos/hino.png',
  'KING LONG':        '/assets/logos/kinglong.png',
  'RENAULT TRUCKS':   '/assets/logos/renault-trucks.png',
  'SHACMAN':          '/assets/logos/shacman.png',
  'SINOTRUK':         '/assets/logos/sinotruk.png',
  'BT':               '/assets/logos/bt.png',
}

// ── Groupes de marques ─────────────────────────────────────────────────────
const MOTORS_BRANDS    = ['TOYOTA', 'SUZUKI', 'BYD', 'MERCEDES', 'MITSUBISHI', 'STELLANTIS', 'OMODA & JAECCO']
const EQUIPMENT_BRANDS = ['BT', 'LOVOL', 'FUSO', 'HINO', 'JCB', 'KING LONG', 'RENAULT TRUCKS', 'SHACMAN', 'SINOTRUK', 'TOYOTA FORKLIFT']

function makeBrandTabs(brands) {
  return brands
    .filter(b => CATALOG[b])
    .map(b => ({
      id: b,
      label: b,
      count: CATALOG[b].reduce((s, g) =>
        s + g.trainings.filter(t => !t.type.toLowerCase().includes('process')).length, 0),
    }))
}

const LEVEL_LABEL = { JUNIOR: 'Junior', SENIOR: 'Senior', EXPERT: 'Expert' }

function BrandCatalogContent({ active, levelFilter: showLevelFilter }) {
  const [level, setLevel] = useState('TOUS')
  const { locale, t: cardsT } = useLocale('cards')
  const { t: homeT } = useLocale('home')

  const levelGroups = CATALOG[active] ?? []
  const techGroups  = levelGroups.filter(g =>
    g.trainings.some(t => !t.type.toLowerCase().includes('process'))
  )
  const availableLevels = techGroups.map(g => g.level)

  const formations = techGroups.flatMap(g =>
    g.trainings
      .filter(t => !t.type.toLowerCase().includes('process'))
      .filter(() => level === 'TOUS' || g.level === level)
      .map(t => ({ ...t, level: g.level }))
  )

  if (!formations.length && level === 'TOUS') return (
    <div className="empty-section">Aucune formation disponible pour cette sélection.</div>
  )

  const folder = BRAND_FOLDER[active]
  const logo   = BRAND_LOGO[active]
  const brandFormateurDisplay = resolveBrandFormateurDisplay(active)

  return (
    <>
      {showLevelFilter && availableLevels.length > 1 && (
        <div className="pv-level-pills">
          <button
            className={`pv-level-pill${level === 'TOUS' ? ' active' : ''}`}
            onClick={() => setLevel('TOUS')}
          >{homeT.levelFilterAll}</button>
          {availableLevels.map(l => (
            <button
              key={l}
              className={`pv-level-pill${level === l ? ' active' : ''}`}
              onClick={() => setLevel(l)}
            >
              {homeT[LEVEL_TAB_KEYS[l]] ?? LEVEL_LABEL[l] ?? l}
            </button>
          ))}
        </div>
      )}
      {formations.length === 0 ? (
        <div className="empty-section">Aucune formation pour ce niveau.</div>
      ) : (
        <CardCarousel>
          {formations.map((f) => {
            const copy = localizedCatalogTrainingFields(f, locale, { level: f.level })
            return (
            <PvCard
              key={f.code}
              to={formationFicheRoute(f.code)}
              variant="doc"
              img={fichePath(folder, f.code)}
              logo={logo}
              kicker={copy.kicker}
              title={copy.title}
              meta={(
                <div className="pv-card-meta--session">
                  <span>{copy.meta}</span>
                  {brandFormateurDisplay && (
                    <FormateurDisplay
                      display={brandFormateurDisplay}
                      variant="card"
                      className="pv-card-meta-formateur"
                    />
                  )}
                </div>
              )}
              cta={cardsT.sessionFiche}
              secondCta="Voir son planning"
              secondCtaTo="/sessions"
              hoverHint={cardsT.sessionFicheHint}
              corner
            />
            )
          })}
        </CardCarousel>
      )}
    </>
  )
}

// ── Process sections ───────────────────────────────────────────────────────
function flattenProcessBrandsWithLogos(sectionObj) {
  return flattenProcessBrands(sectionObj)
}

const processSavTabDefs = [
  { id: 'sav', labelKey: 'savTabSav', count: flattenProcessBrands(CATALOG.PROCESS_SAV_PARTS_MOTORS.PROCESS_SAV).length },
  { id: 'parts', labelKey: 'savTabParts', count: flattenProcessBrands(CATALOG.PROCESS_SAV_PARTS_MOTORS.PROCESS_PARTS).length },
]

const processEqTabDefs = [
  { id: 'sav', labelKey: 'savTabSav', count: CATALOG.PROCESS_SAV_PARTS_EQUIPMENT.PROCESS_SAV.TOUTES_MARQUES_EQUIPMENT.length },
  { id: 'parts', labelKey: 'savTabParts', count: CATALOG.PROCESS_SAV_PARTS_EQUIPMENT.PROCESS_PARTS.TOUTES_MARQUES_EQUIPMENT.length },
]

// ── Process content with public pills ─────────────────────────────────────

function matchesPublic(pub, cat) {
  if (!pub) return false
  const p = pub.toLowerCase()
  if (cat === 'Manager')      return p.includes('manager')
  if (cat === 'Front Office') return p.includes('front')
  if (cat === 'Back Office')  return p.includes('back')
  return false
}

function ProcessCatalogContent({ items, folder }) {
  const [pub, setPub] = useState('TOUS')
  const { locale, t: cardsT } = useLocale('cards')
  const { t: homeT } = useLocale('home')

  const visible = pub === 'TOUS'
    ? items
    : items.filter(f => matchesPublic(f.public, pub))

  return (
    <>
      <div className="pv-level-pills">
        <button
          className={`pv-level-pill${pub === 'TOUS' ? ' active' : ''}`}
          onClick={() => setPub('TOUS')}
        >{homeT.processFilterAll}</button>
        {PROCESS_PUBLIC_FILTERS.map(({ id, key }) => (
          <button
            key={id}
            className={`pv-level-pill${pub === id ? ' active' : ''}`}
            onClick={() => setPub(id)}
          >{homeT[key]}</button>
        ))}
      </div>
      {visible.length === 0 ? (
        <div className="empty-section">Aucune formation pour ce public.</div>
      ) : (
        <CardCarousel>
          {visible.map((f) => {
            const copy = localizedCatalogTrainingFields(f, locale)
            const rawBadge = resolveProcessSavCardBadge({ folder, training: f })
            const badgeSource = f.catalogBrand?.replace(/_/g, ' ') ?? 'TOUTES MARQUES'
            const badgeCtx = folder?.includes('equipment')
              ? { tagClass: 'parts-eq', bu: 'Parts & Process Equipment' }
              : { tagClass: 'parts-motors', bu: 'Parts & Process Motors' }
            const { logo, label: brandLabel } = rawBadge.logo
              ? rawBadge
              : localizedCardBrandBadge(badgeSource, badgeCtx, locale)
            const cardImg = resolveProcessSavCardImage(folder)
            return (
            <PvCard
              key={f.code}
              to={formationFicheRoute(f.code)}
              variant={cardImg ? undefined : 'doc'}
              img={cardImg ?? fichePath(folder, f.code)}
              logo={logo}
              brandLabel={brandLabel}
              kicker={copy.kicker}
              title={copy.title}
              meta={copy.meta}
              cta={cardsT.sessionFiche}
              secondCta="Voir son planning"
              secondCtaTo="/sessions"
              hoverHint={cardsT.sessionFicheHint}
              corner
            />
            )
          })}
        </CardCarousel>
      )}
    </>
  )
}

function CarrosserieCatalogCarousel({ group }) {
  const { locale, t: cardsT } = useLocale('cards')
  const { label: brandLabel } = localizedCardBrandBadge(
    'CARROSSERIE',
    { tagClass: 'carrosserie', bu: 'Carrosserie' },
    locale,
  )

  return (
    <CardCarousel>
      {group?.trainings.map((f) => {
        const copy = localizedCatalogTrainingFields(f, locale)
        return (
          <PvCard
            key={f.code}
            to={formationFicheRoute(f.code)}
            variant="doc"
            img={fichePath('carrosserie', f.code)}
            brandLabel={brandLabel}
            kicker={copy.kicker}
            title={copy.title}
            meta={copy.meta}
            cta={cardsT.sessionFiche}
            secondCta="Voir son planning"
            secondCtaTo="/sessions"
            hoverHint={cardsT.sessionFicheHint}
            corner
          />
        )
      })}
    </CardCarousel>
  )
}

function CertificationsCarousel({ items, folder, brand }) {
  const { locale, t: cardsT } = useLocale('cards')
  const logo = BRAND_LOGO[brand]

  return (
    <CardCarousel>
      {items.map((f) => {
        const copy = localizedCatalogTrainingFields(f, locale, { level: f.level })
        return (
          <PvCard
            key={f.code}
            to={formationFicheRoute(f.code)}
            variant="doc"
            img={fichePath(folder, f.code)}
            logo={logo}
            kicker={f.level}
            title={copy.title}
            meta={copy.meta}
            cta={cardsT.sessionFiche}
            secondCta="Voir son planning"
            secondCtaTo="/sessions"
            hoverHint={cardsT.sessionFicheHint}
            corner
          />
        )
      })}
    </CardCarousel>
  )
}

// ── Carrosserie tabs ───────────────────────────────────────────────────────
const carrosserieTabDefs = CATALOG.CARROSSERIE.map((g) => ({
  id: g.level,
  labelKey: CARRO_TAB_KEYS[g.level],
  count: g.trainings.length,
}))

// ── Certifications ─────────────────────────────────────────────────────────
const CERTIFICATIONS = Object.entries(CATALOG)
  .filter(([key]) => !['PROCESS_SAV_PARTS_MOTORS', 'PROCESS_SAV_PARTS_EQUIPMENT', 'CARROSSERIE'].includes(key))
  .flatMap(([brand, levels]) =>
    Array.isArray(levels)
      ? levels.flatMap(g =>
          g.trainings
            .filter(t => t.name.toLowerCase().includes('certif'))
            .map(t => ({ ...t, level: g.level, brand }))
        )
      : []
  )

const certBrandTabs = [...new Set(CERTIFICATIONS.map(c => c.brand))].map(brand => ({
  id: brand,
  label: brand,
  count: CERTIFICATIONS.filter(c => c.brand === brand).length,
}))

// ── Page ────────────────────────────────────────────────────────────────────
export default function Formations() {
  const { t: homeT } = useLocale('home')
  const processSavTabs = useMemo(
    () => processSavTabDefs.map((t) => ({ id: t.id, label: homeT[t.labelKey], count: t.count })),
    [homeT],
  )
  const processEqTabs = useMemo(
    () => processEqTabDefs.map((t) => ({ id: t.id, label: homeT[t.labelKey], count: t.count })),
    [homeT],
  )
  const carrosserieTabs = useMemo(
    () => carrosserieTabDefs.map((t) => ({
      id: t.id,
      label: homeT[t.labelKey] ?? t.id,
      count: t.count,
    })),
    [homeT],
  )

  return (
    <SitePageLayout showCursorGlow>

      <PageHeader
        eyebrow="Catalogue 2026"
        title={<>{STATS.sessions} sessions, 5 Business Units.</>}
        sub="Cliquez sur une formation pour ouvrir sa fiche descriptive."
      />

      {/* ── 01 · TECHNIQUE MOTORS ── */}
      <PreviewSection
        ix="Technique Motors"
        title={<>Catalogue <em>Technique Motors</em>.</>}
        tabs={makeBrandTabs(MOTORS_BRANDS)}
        bgWord="motors"
        bgWordSide="right"
      >
        {(active) => <BrandCatalogContent key={active} active={active} levelFilter />}
      </PreviewSection>

      {/* ── 02 · TECHNIQUE EQUIPMENT ── */}
      <PreviewSection
        ix="Technique Equipment"
        title={<>Catalogue <em>Technique Equipment</em>.</>}
        tabs={makeBrandTabs(EQUIPMENT_BRANDS)}
        bgWord="equipment"
        bgWordSide="left"
      >
        {(active) => <BrandCatalogContent key={active} active={active} levelFilter />}
      </PreviewSection>

      {/* ── 03 · PROCESS & PARTS MOTORS ── */}
      <PreviewSection
        ix="Process & Parts Motors"
        title={<>Catalogue <em>Process & Parts Motors</em>.</>}
        tabs={processSavTabs}
        bgWord="process"
        bgWordSide="right"
      >
        {(active) => {
          const section = active === 'sav'
            ? CATALOG.PROCESS_SAV_PARTS_MOTORS.PROCESS_SAV
            : CATALOG.PROCESS_SAV_PARTS_MOTORS.PROCESS_PARTS
          const folder = active === 'sav'
            ? 'process_sav_parts_motors/process_sav'
            : 'process_sav_parts_motors/process_parts'
          return <ProcessCatalogContent key={active} items={flattenProcessBrandsWithLogos(section)} folder={folder} />
        }}
      </PreviewSection>

      {/* ── 04 · PROCESS & PARTS EQUIPMENT ── */}
      <PreviewSection
        ix="Process & Parts Equipment"
        title={<>Catalogue <em>Process & Parts Equipment</em>.</>}
        tabs={processEqTabs}
        bgWord="parts"
        bgWordSide="left"
      >
        {(active) => {
          const items = (active === 'sav'
            ? CATALOG.PROCESS_SAV_PARTS_EQUIPMENT.PROCESS_SAV.TOUTES_MARQUES_EQUIPMENT
            : CATALOG.PROCESS_SAV_PARTS_EQUIPMENT.PROCESS_PARTS.TOUTES_MARQUES_EQUIPMENT
          ).map((t) => ({ ...t, catalogBrand: 'TOUTES_MARQUES_EQUIPMENT' }))
          const folder = active === 'sav'
            ? 'process_sav_parts_equipment/process_sav'
            : 'process_sav_parts_equipment/process_parts'
          return <ProcessCatalogContent key={active} items={items} folder={folder} />
        }}
      </PreviewSection>

      {/* ── 05 · CARROSSERIE ── */}
      <PreviewSection
        ix="Carrosserie"
        title={<>Catalogue <em>Carrosserie</em>.</>}
        tabs={carrosserieTabs}
        bgWord="carrosserie"
        bgWordSide="right"
      >
        {(active) => {
          const group = CATALOG.CARROSSERIE.find(g => g.level === active)
          return <CarrosserieCatalogCarousel key={active} group={group} />
        }}
      </PreviewSection>

      {/* ── 06 · CERTIFICATIONS ── */}
      <PreviewSection
        ix="Certifications officielles"
        title={<>Formations <em>certifiantes</em>.</>}
        tabs={certBrandTabs}
        bgWord="certified"
        bgWordSide="left"
      >
        {(active) => {
          const items = CERTIFICATIONS.filter(c => c.brand === active)
          const folder = BRAND_FOLDER[active]
          return <CertificationsCarousel key={active} items={items} folder={folder} brand={active} />
        }}
      </PreviewSection>

      <CtaBanner />
      <LogoMarquee />
    </SitePageLayout>
  )
}
