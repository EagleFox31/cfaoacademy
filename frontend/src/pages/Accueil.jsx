import { useState, useEffect, useRef, useMemo } from 'react'
import { useLocation, useSearchParams } from 'react-router-dom'
import useSiteEffects from '../hooks/useSiteEffects.js'
import useAuth from '../hooks/useAuth.js'
import usePortalBackground from '../hooks/usePortalBackground.js'
import useLocale from '../hooks/useLocale.js'
import { NEWS_TAB_KEYS, CARRO_TAB_KEYS } from '../i18n/home.js'
import { SESSION_TAB_KEYS } from '../i18n/sessions.js'
import { sectionTitle } from '../utils/sectionTitle.jsx'
import Nav from '../components/Nav.jsx'
import Footer from '../components/Footer.jsx'
import HomeHero from '../components/HomeHero.jsx'
import LogoMarquee from '../components/LogoMarquee.jsx'
import KpiBand from '../components/KpiBand.jsx'
import PreviewSection from '../components/PreviewSection.jsx'
import PublicCard from '../components/PublicCard.jsx'
import BrandOfferGrid from '../components/BrandOfferGrid.jsx'
import ProcessSavHomeGrid from '../components/ProcessSavHomeGrid.jsx'
import CardRail from '../components/CardRail.jsx'
import CatalogTrainingCard from '../components/CatalogTrainingCard.jsx'
import SessionCard from '../components/SessionCard.jsx'
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
import AssistanceHomeSection from '../components/AssistanceHomeSection.jsx'
import { ARTICLES } from '../data/articles/index.js'
import ArticleCard from '../components/ArticleCard.jsx'
import {
  mergeSessionsReturn,
  scheduleSessionsScroll,
} from '../utils/sessionsReturn.js'
import { HOME_BACKDROP_SECTION_IDS } from '../data/homeSectionBg.js'
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
  const { user } = useAuth()
  usePortalBackground(user, { requireUser: true })
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
  const [sessionTab, setSessionTab] = useState(
    () => initialRestore?.tab ?? BU[0].short,
  )
  const [sessionBrand, setSessionBrand] = useState(
    () => initialRestore?.brand ?? 'all',
  )

  const handleSessionTabChange = (tabId) => {
    setSessionTab(tabId)
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

  const sessionsForTab = (active) =>
    UPCOMING.filter((s) => s.bu === BU.find((b) => b.short === active)?.id)

  useEffect(() => {
    if (!hash) return
    const id = hash.replace('#', '')
    const scrollToTarget = () => {
      const el = document.getElementById(id)
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }
    }
    const rafId = requestAnimationFrame(scrollToTarget)
    const timerId = setTimeout(scrollToTarget, 160)
    return () => {
      cancelAnimationFrame(rafId)
      clearTimeout(timerId)
    }
  }, [hash])

  const { heroVisible } = useHomeSectionFocus(HOME_BACKDROP_SECTION_IDS)
  const homePageRef = useRef(null)
  useHomeNewsBgReveal(homePageRef, user ? false : heroVisible)

  useEffect(() => {
    if (user) {
      document.documentElement.classList.remove('home-scroll-snap')
      return undefined
    }
    document.documentElement.classList.add('home-scroll-snap')
    return () => document.documentElement.classList.remove('home-scroll-snap')
  }, [user])

  return (
    <>
      <div className="cursor-glow" id="cursor-glow" />
      <div ref={homePageRef} className={`home-page${user ? ' home-page--logged' : ''}${!user && heroVisible ? ' is-hero-phase' : ''}`}>
      {!user && (
        <HomeBackdrop heroPhase={heroVisible} />
      )}
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
      >
        {(active) => {
          const items = active === 'all' ? ARTICLES : ARTICLES.filter((a) => a.category === active)
          return (
            <CardRail
              className="card-rail--news"
              ariaLabel={homeT.newsIx ? `${homeT.newsIx}` : 'Actualités'}
              arrowLabelPrev={commonT.prev ?? 'Précédent'}
              arrowLabelNext={commonT.next ?? 'Suivant'}
            >
              {items.map((article) => (
                <ArticleCard key={article.slug} article={article} />
              ))}
            </CardRail>
          )
        }}
      </PreviewSection>

      {/* ── 03 · PUBLICS ── */}
      <PreviewSection
        id="publics"
        ix={homeT.publicsIx}
        title={sectionTitle(homeT.publicsTitleBefore, homeT.publicsTitleEm, homeT.publicsTitleAfter)}
        headClass="pv-head--compact-line"
      >
        <CardRail
          ariaLabel={homeT.publicsIx ?? 'Publics'}
          arrowLabelPrev={commonT.prev ?? 'Précédent'}
          arrowLabelNext={commonT.next ?? 'Suivant'}
        >
          {PUBLICS.map((p, i) => (
            <PublicCard key={p.name + i} public={p} />
          ))}
        </CardRail>
      </PreviewSection>

      {/* ── 04 · FORMATIONS MOTORS ── */}
      <PreviewSection
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
                <CatalogTrainingCard key={f.code} folder="carrosserie" training={f} />
              ))}
            </CardRail>
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
      >
        {(active) => {
          const filtered = sessionsForTab(active)
          const sessionsReturn = {
            tab: active,
            expanded: false,
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

          return (
            <CardRail
              className="card-rail--sessions"
              ariaLabel={homeT.sessionsIx ?? 'Sessions 2026'}
              arrowLabelPrev={commonT.prev ?? 'Précédent'}
              arrowLabelNext={commonT.next ?? 'Suivant'}
            >
              {filtered.map((s) => (
                <SessionCard key={s.uid} session={s} sessionsReturn={sessionsReturn} />
              ))}
            </CardRail>
          )
        }}
      </PreviewSection>
      </>
      )}

      {/* ── 07 · L'ACADEMY ── */}
      <AcademyHomeSection />

      {/* ── ASSISTANCE TECHNIQUE ── */}
      <AssistanceHomeSection />

      {/* ── 08 · TÉMOIGNAGES ── */}
      <PreviewSection
        id="temoignages"
        ix={homeT.testimonialsIx}
        title={sectionTitle(homeT.testimonialsTitleBefore, homeT.testimonialsTitleEm, homeT.testimonialsTitleAfter)}
        headClass="pv-head--compact-line"
        bgWord="terrain"
        bgWordSide="left"      >
        <TestimonialShowcase items={TESTIMONIALS} />
      </PreviewSection>

      <FlagMarquee />

      <CtaBanner id="cta-contact" />
      <LogoMarquee />
      <Footer />
      </div>
    </>
  )
}
