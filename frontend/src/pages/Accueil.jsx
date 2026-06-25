import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import useSiteEffects from '../hooks/useSiteEffects.js'
import useLocale from '../hooks/useLocale.js'
import { NEWS_TAB_KEYS, CARRO_TAB_KEYS } from '../i18n/home.js'
import { SESSION_TAB_KEYS } from '../i18n/sessions.js'
import { sectionTitle } from '../utils/sectionTitle.jsx'
import Nav from '../components/Nav.jsx'
import Footer from '../components/Footer.jsx'
import HomeHero from '../components/HomeHero.jsx'
import BackToTopFab from '../components/BackToTopFab.jsx'
import LogoMarquee from '../components/LogoMarquee.jsx'
import KpiBand from '../components/KpiBand.jsx'
import PreviewSection from '../components/PreviewSection.jsx'
import PublicCard from '../components/PublicCard.jsx'
import BrandOfferGrid from '../components/BrandOfferGrid.jsx'
import ProcessSavHomeGrid from '../components/ProcessSavHomeGrid.jsx'
import PvCardGrid from '../components/PvCardGrid.jsx'
import CatalogTrainingCard from '../components/CatalogTrainingCard.jsx'
import SessionCard from '../components/SessionCard.jsx'
import SessionsExpandedView from '../components/SessionsExpandedView.jsx'
import CtaBanner from '../components/CtaBanner.jsx'
import FlagMarquee from '../components/FlagMarquee.jsx'
import {
  BU, PUBLICS, BRANDS,
  SESSIONS, NEWS_CATS,
  HOME_SESSIONS_SECTION_VISIBLE,
} from '../data/index.js'
import TestimonialShowcase from '../components/TestimonialShowcase.jsx'
import { TESTIMONIALS } from '../data/testimonials.js'
import AcademyHomeSection from '../components/AcademyHomeSection.jsx'
import { ARTICLES } from '../data/articles/index.js'
import ArticleCard from '../components/ArticleCard.jsx'
import {
  mergeSessionsReturn,
  scheduleSessionsScroll,
} from '../utils/sessionsReturn.js'
import { HOME_SECTION_BG, HOME_SECTION_BG_POSITION, HOME_BACKDROP_SECTION_IDS } from '../data/homeSectionBg.js'
import { getMotorsSectionHoverBg } from '../data/motorsSectionHoverBg.js'
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
import useHomeSectionFocus from '../hooks/useHomeSectionFocus.js'
import useHomeNewsBgReveal from '../hooks/useHomeNewsBgReveal.js'
import HomeBackdrop from '../components/HomeBackdrop.jsx'

function isValidSessionTab(short) {
  return BU.some((b) => b.short === short)
}

function bootstrapSessionsRestore(location, searchParams) {
  const merged = mergeSessionsReturn(location, searchParams)
  if (!merged?.sectionId && !merged?.tab) return null
  if (merged.tab && !isValidSessionTab(merged.tab)) return merged.sectionId ? merged : null
  return merged
}

// Grille accueil : tout afficher jusqu’à 12 cartes ; au-delà, 8 visibles + « Voir tout »
const HOME_GRID_SHOW_ALL_UP_TO = 12
const HOME_GRID_PREVIEW_LIMIT = 8

function homeGridPreviewLimit(count) {
  return count > HOME_GRID_SHOW_ALL_UP_TO ? HOME_GRID_PREVIEW_LIMIT : null
}
const MOTORS_BRANDS = BRANDS.filter(b => b.bu === 'motors' && b.name !== 'Citroën')
const EQUIPMENT_BRANDS = BRANDS.filter(b => b.bu === 'equipment')

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

const newsTabsFromCopy = (homeT, articles) =>
  NEWS_CATS.map((c) => ({
    id: c.id,
    label: homeT[NEWS_TAB_KEYS[c.id]] ?? c.label,
    count: c.id === 'all' ? articles.length : articles.filter((a) => a.category === c.id).length,
  }))

const TODAY = new Date(); TODAY.setHours(0, 0, 0, 0)
const UPCOMING = SESSIONS
  .filter(s => new Date(s.date) >= TODAY)
  .sort((a, b) => new Date(a.date) - new Date(b.date))

const sessionTabsFromCopy = (sessionsT, upcoming) =>
  BU.map((b) => ({
    id: b.short,
    label: sessionsT[SESSION_TAB_KEYS[b.short]] ?? b.short,
    count: upcoming.filter((s) => s.bu === b.id).length,
  }))

export default function Accueil() {
  useSiteEffects()
  const { locale, t: homeT } = useLocale('home')
  const { t: commonT } = useLocale('common')
  const { t: cardsT } = useLocale('cards')
  const { t: sessionsT } = useLocale('sessions')
  const newsTabs = useMemo(() => newsTabsFromCopy(homeT, ARTICLES), [homeT])
  const sessionTabs = useMemo(() => sessionTabsFromCopy(sessionsT, UPCOMING), [sessionsT])
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
  const location = useLocation()
  const { hash } = location
  const [searchParams] = useSearchParams()
  const restoreBoot = useRef(undefined)
  if (restoreBoot.current === undefined) {
    const boot = bootstrapSessionsRestore(location, searchParams)
    restoreBoot.current = boot ?? false
  }
  const initialRestore = restoreBoot.current === false ? null : restoreBoot.current

  const [newsTab, setNewsTab] = useState('all')
  const [newsExpanded, setNewsExpanded] = useState(false)
  const [sessionTab, setSessionTab] = useState(
    () => initialRestore?.tab ?? BU[0].short,
  )
  const [sessionsExpanded, setSessionsExpanded] = useState(
    () => Boolean(initialRestore?.expanded),
  )
  const [sessionBrand, setSessionBrand] = useState(
    () => initialRestore?.brand ?? 'all',
  )

  useEffect(() => {
    setNewsExpanded(false)
  }, [newsTab])

  const handleSessionTabChange = (tabId) => {
    setSessionTab(tabId)
    setSessionsExpanded(false)
    setSessionBrand('all')
  }

  useEffect(() => {
    if (!initialRestore) return undefined
    return scheduleSessionsScroll(initialRestore)
  }, [initialRestore])

  /* Retour fiche → restaurer section accueil + onglet sessions */
  useEffect(() => {
    const merged = mergeSessionsReturn(location, searchParams)
    if (!merged?.sectionId && !merged?.tab) return undefined

    if (merged.tab && isValidSessionTab(merged.tab)) {
      setSessionTab(merged.tab)
      setSessionsExpanded(Boolean(merged.expanded))
      setSessionBrand(merged.brand ?? 'all')
    }

    const sectionId = merged.sectionId ?? (merged.tab ? 'sessions' : null)

    const applyScroll = () => {
      if (merged.scrollY > 0) {
        window.scrollTo({ top: merged.scrollY, left: 0, behavior: 'auto' })
      } else if (sectionId) {
        document.getElementById(sectionId)?.scrollIntoView({ behavior: 'auto', block: 'start' })
      }
    }

    const frame = requestAnimationFrame(() => {
      requestAnimationFrame(applyScroll)
    })
    const timers = [80, 200, 450].map((ms) => window.setTimeout(applyScroll, ms))

    return () => {
      cancelAnimationFrame(frame)
      timers.forEach((id) => window.clearTimeout(id))
    }
  }, [location.key, location.pathname, location.search, location.state, searchParams])

  const newsItemsForTab = newsTab === 'all'
    ? ARTICLES
    : ARTICLES.filter((a) => a.category === newsTab)
  const newsVoir = newsItemsForTab.length > HOME_GRID_SHOW_ALL_UP_TO
    ? {
        label: newsExpanded ? commonT.seeLess : commonT.seeMore,
        expanded: newsExpanded,
        onClick: () => setNewsExpanded((v) => !v),
      }
    : undefined

  const sessionsForTab = (active) =>
    UPCOMING.filter((s) => s.bu === BU.find((b) => b.short === active)?.id)

  const sessionsVoir = (active) => {
    const count = sessionsForTab(active).length
    return count > HOME_GRID_SHOW_ALL_UP_TO
      ? {
          label: sessionsExpanded ? commonT.seeLess : commonT.seeMore,
          expanded: sessionsExpanded,
          onClick: () => setSessionsExpanded((v) => !v),
        }
      : undefined
  }

  useEffect(() => {
    if (!hash) return
    const id = hash.replace('#', '')
    requestAnimationFrame(() => {
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
  }, [hash])

  const { activeId: activeSectionId, heroVisible } = useHomeSectionFocus(HOME_BACKDROP_SECTION_IDS)
  const homePageRef = useRef(null)
  useHomeNewsBgReveal(homePageRef, heroVisible)
  const backdropSectionId = heroVisible
    ? null
    : (activeSectionId ?? HOME_BACKDROP_SECTION_IDS[0])

  const [motorsHoverBg, setMotorsHoverBg] = useState(null)
  const handleMotorsBrandHover = useCallback((brand) => {
    setMotorsHoverBg(getMotorsSectionHoverBg(brand.name))
  }, [])
  const handleMotorsBrandHoverEnd = useCallback(() => {
    setMotorsHoverBg(null)
  }, [])
  const sectionHoverImages = useMemo(
    () => (motorsHoverBg ? { offres: motorsHoverBg } : {}),
    [motorsHoverBg],
  )

  useEffect(() => {
    document.documentElement.classList.add('home-scroll-snap')
    return () => document.documentElement.classList.remove('home-scroll-snap')
  }, [])

  return (
    <>
      <div className="cursor-glow" id="cursor-glow" />
      <div ref={homePageRef} className={`home-page${heroVisible ? ' is-hero-phase' : ''}`}>
      <HomeBackdrop
        activeId={backdropSectionId}
        heroPhase={heroVisible}
        sectionHoverImages={sectionHoverImages}
      />
      <Nav />
      <HomeHero />

      {/* ── 02 · ACTUALITÉS ── */}
      <PreviewSection
        id="actualites"
        ix={homeT.newsIx}
        title={sectionTitle(homeT.newsTitleBefore, homeT.newsTitleEm, homeT.newsTitleAfter)}
        headClass="pv-head--compact-line"
        activeTab={newsTab}
        onTabChange={setNewsTab}
        tabs={newsTabs}
        bgWord="news"
        bgWordSide="left"
        sectionBg={HOME_SECTION_BG.actualites}
        voir={newsVoir}
      >
        {(active) => {
          const items = active === 'all' ? ARTICLES : ARTICLES.filter((a) => a.category === active)

          if (newsExpanded) {
            return (
              <div className="article-grid news-grid-expanded">
                {items.map((article) => (
                  <ArticleCard key={article.slug} article={article} />
                ))}
              </div>
            )
          }

          return (
            <PvCardGrid limit={homeGridPreviewLimit(items.length)} className="pv-card-grid--news">
              {items.map((article) => (
                <ArticleCard key={article.slug} article={article} />
              ))}
            </PvCardGrid>
          )
        }}
      </PreviewSection>

      {/* ── 03 · PUBLICS ── */}
      <PreviewSection
        id="publics"
        ix={homeT.publicsIx}
        title={sectionTitle(homeT.publicsTitleBefore, homeT.publicsTitleEm, homeT.publicsTitleAfter)}
        headClass="pv-head--compact-line"
        sectionBg={HOME_SECTION_BG.publics}
      >
        <PvCardGrid>
          {PUBLICS.map((p, i) => (
            <PublicCard key={p.name + i} public={p} />
          ))}
        </PvCardGrid>
      </PreviewSection>

      {/* ── 04 · FORMATIONS MOTORS ── */}
      <PreviewSection
        id="offres"
        ix={homeT.motorsIx}
        title={sectionTitle(homeT.motorsTitleBefore, homeT.motorsTitleEm, homeT.motorsTitleAfter)}
        headClass="pv-head--compact-line"
        bgWord="motors"
        bgWordSide="right"
        sectionBg={HOME_SECTION_BG.motors}
      >
        <BrandOfferGrid
          brands={MOTORS_BRANDS}
          onBrandHover={handleMotorsBrandHover}
          onBrandHoverEnd={handleMotorsBrandHoverEnd}
        />
      </PreviewSection>

      {/* ── 05 · FORMATIONS EQUIPMENT ── */}
      <PreviewSection
        id="formations-equipment"
        ix={homeT.equipmentIx}
        title={sectionTitle(homeT.equipmentTitleBefore, homeT.equipmentTitleEm, homeT.equipmentTitleAfter)}
        headClass="pv-head--compact-line"
        bgWord="equipment"
        bgWordSide="left"
        sectionBg={HOME_SECTION_BG.equipment}
      >
        <BrandOfferGrid brands={EQUIPMENT_BRANDS} showAll />
      </PreviewSection>

      {/* ── 06 · FORMATIONS CARROSSERIE ── */}
      <PreviewSection
        id="formations-carrosserie"
        ix={homeT.carrosserieIx}
        title={sectionTitle(homeT.carrosserieTitleBefore, homeT.carrosserieTitleEm, homeT.carrosserieTitleAfter)}
        headClass="pv-head--compact-line"
        bgWord="carrosserie"
        bgWordSide="left"
        sectionBg={HOME_SECTION_BG.carrosserie}
        tabs={carrosserieTabsLocalized}
      >
        {(active) => {
          const group = CATALOG.CARROSSERIE.find((g) => g.level === active)
          return (
            <PvCardGrid>
              {group?.trainings.map((f) => (
                <CatalogTrainingCard key={f.code} folder="carrosserie" training={f} />
              ))}
            </PvCardGrid>
          )
        }}
      </PreviewSection>

      {/* ── 07 · ORGANISATION SAV MOTORS ── */}
      <PreviewSection
        id="formations-sav-motors"
        ix={homeT.savMotorsIx}
        title={sectionTitle(homeT.savMotorsTitleBefore, homeT.savMotorsTitleEm, homeT.savMotorsTitleAfter)}
        headClass="pv-head--compact-line"
        bgWord="sav"
        bgWordSide="right"
        sectionBg={HOME_SECTION_BG.savMotors}
        sectionBgPosition={HOME_SECTION_BG_POSITION.savMotors}
        tabs={motorsSavTabsLocalized}
        voir={{
          href: getOfferCataloguePdf('savMotors', locale),
          label: cardsT.openCatalogue,
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
        id="formations-sav-equipment"
        ix={homeT.savEquipmentIx}
        title={sectionTitle(homeT.savEquipmentTitleBefore, homeT.savEquipmentTitleEm, homeT.savEquipmentTitleAfter)}
        headClass="pv-head--compact-line"
        bgWord="sav"
        bgWordSide="right"
        sectionBg={HOME_SECTION_BG.savEquipment}
        tabs={equipmentSavTabsLocalized}
        voir={{
          href: getOfferCataloguePdf('savEquipment', locale),
          label: cardsT.openCatalogue,
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


{HOME_SESSIONS_SECTION_VISIBLE && (
      <>
{/* ── 09 · SESSIONS ── */}
      <PreviewSection
        id="sessions"
        ix={homeT.sessionsIx}
        title={sectionTitle(homeT.sessionsTitleBefore, homeT.sessionsTitleEm, homeT.sessionsTitleAfter)}
        headClass="pv-head--compact-line"
        activeTab={sessionTab}
        onTabChange={handleSessionTabChange}
        tabs={sessionTabs}
        bgWord="2026"
        bgWordSide="right"
        sectionBg={HOME_SECTION_BG.sessions}
        voir={sessionsVoir(sessionTab)}
      >
        {(active) => {
          const filtered = sessionsForTab(active)
          const sessionsReturn = {
            tab: active,
            expanded: sessionsExpanded,
            brand: sessionBrand,
            sectionId: 'sessions',
          }
          if (!filtered.length) {
            return (
              <div className="empty-section">
                {homeT.sessionsEmpty}
              </div>
            )
          }

          if (sessionsExpanded) {
            return (
              <SessionsExpandedView
                sessions={filtered}
                filterKey={active}
                brand={sessionBrand}
                onBrandChange={setSessionBrand}
                sessionsReturn={sessionsReturn}
              />
            )
          }

          return (
            <PvCardGrid limit={homeGridPreviewLimit(filtered.length)} className="pv-card-grid--sessions">
              {filtered.map((s) => (
                <SessionCard key={s.uid} session={s} sessionsReturn={sessionsReturn} />
              ))}
            </PvCardGrid>
          )
        }}
      </PreviewSection>
      </>
      )}

      {/* ── 07 · L'ACADEMY ── */}
      <AcademyHomeSection />

      <FlagMarquee />

      {/* ── 08 · TÉMOIGNAGES ── */}
      <PreviewSection
        id="temoignages"
        ix={homeT.testimonialsIx}
        title={sectionTitle(homeT.testimonialsTitleBefore, homeT.testimonialsTitleEm, homeT.testimonialsTitleAfter)}
        headClass="pv-head--compact-line"
        bgWord="terrain"
        bgWordSide="left"
        sectionBg={HOME_SECTION_BG.testimonials}
      >
        <TestimonialShowcase items={TESTIMONIALS} />
      </PreviewSection>

      <CtaBanner
        id="cta-contact"
        sectionBg={HOME_SECTION_BG.cta}
        sectionBgPosition={HOME_SECTION_BG_POSITION.cta}
      />
      <LogoMarquee />
      <Footer />
      <BackToTopFab />
      </div>
    </>
  )
}
