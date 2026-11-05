import { useEffect, useMemo, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'

import { useCampaign } from '../App'
import BrandLogo from '../components/BrandLogo'
import {
  IconBodywork,
  IconBook,
  IconCar,
  IconInfo,
  IconTag,
  IconUsers,
  IconWrench,
} from '../components/icons'
import LandingSkeleton from '../components/LandingSkeleton'
import SubmitPanel from '../components/SubmitPanel'
import { AsyncBoundary, Banner, Counter, Empty } from '../components/ui'
import { useFormatters, useLocale } from '../i18n'
import { api } from '../lib/api'
import { countryFlag } from '../lib/assets'
import { readSession } from '../lib/auth'
import { rememberHomeScroll, restoreHomeScroll } from '../lib/homeScroll'
import { useAsync } from '../lib/hooks'

/**
 * Écran d'entrée du parcours filiale : consignes, compteurs, BU et marques.
 *
 * La disposition reprend celle d'Academix, que les filiales utilisent déjà :
 * accueil, « A lire », trois compteurs, puis les marques par BU. Réapprendre un
 * écran connu coûte plus cher que tout gain esthétique.
 *
 * Les compteurs et les marques viennent du **même appel** que la liste : annoncer
 * « 42 thèmes » puis n'en servir que douze une fois la marque ouverte serait pire
 * que ne rien annoncer. Le périmètre Cerbos décide de ce que l'appelant voit.
 */
export default function Poles() {
  const { t } = useLocale()
  const location = useLocation()
  const { campaign, submission, sections = [], reload } = useCampaign()
  const [loading, setLoading] = useState(() => Boolean(location.state?.fromBrand))

  useEffect(() => {
    if (!location.state?.fromBrand) return
    let active = true
    const minDelay = new Promise((resolve) => setTimeout(resolve, 450))
    Promise.all([reload(), minDelay]).finally(() => {
      if (active) {
        setLoading(false)
        window.history.replaceState({}, document.title)
      }
    })
    return () => {
      active = false
    }
  }, [location.state, reload])

  if (loading) {
    return <LandingSkeleton />
  }

  if (!campaign) return <Empty>{t('poles.empty')}</Empty>

  const closed = campaign.status !== 'OPEN'

  return (
    <div className="stack">
      <Hero campaign={campaign} submission={submission} />

      <Instructions campaign={campaign} />

      {closed && <Banner tone="warn">{t('campaign.closed')}</Banner>}

      <StatusNote campaign={campaign} submission={submission} />

      {sections.length === 0 ? (
        <Empty>{t('poles.empty')}</Empty>
      ) : (
        <PolesList sections={sections} locked={closed} submission={submission} onSent={reload} />
      )}
    </div>
  )
}

/**
 * Liste des BU une fois le catalogue chargé — c'est à ce moment que la hauteur
 * de page permet de restaurer le scroll (retour depuis une fiche marque).
 */
function PolesList({ sections, locked, submission, onSent }) {
  useEffect(() => restoreHomeScroll({ clear: true }), [sections])
  const [activeCategory, setActiveCategory] = useState('ALL')
  const { t } = useLocale()

  const categoryStats = useMemo(() => {
    const map = {
      ALL: {
        brands: 0,
        places: 0,
      },
    }
    sections.forEach((sec) => {
      const allBrands = sec.poles.flatMap((p) => p.brands)
      const countBrands = allBrands.filter((b) => !b.is_transverse).length || allBrands.length
      const countPlaces = allBrands.reduce((sum, b) => sum + (b.headcount || 0), 0)
      map[sec.section] = {
        brands: countBrands,
        places: countPlaces,
      }
      map.ALL.places += countPlaces
    })
    map.ALL.brands = Object.keys(map)
      .filter((k) => k !== 'ALL')
      .reduce((sum, k) => sum + map[k].brands, 0)
    return map
  }, [sections])

  const filteredSections = useMemo(() => {
    if (activeCategory === 'ALL') return sections
    return sections.filter((sec) => sec.section === activeCategory)
  }, [sections, activeCategory])

  return (
    <div className="stack">
      <Counters sections={sections} />

      {/* Barre de sélection de catégorie / pilules horizontales */}
      <div className="category-bar-wrap">
        <div className="category-bar" role="tablist" aria-label={t('nav.brands')}>
          <button
            type="button"
            role="tab"
            aria-selected={activeCategory === 'ALL'}
            className={`category-chip ${activeCategory === 'ALL' ? 'is-active' : ''}`}
            onClick={() => setActiveCategory('ALL')}
          >
            <span className="category-chip__icon"><IconTag /></span>
            <span className="category-chip__label">{t('category.all')}</span>
            <span className="category-chip__count">({categoryStats.ALL?.brands ?? 0})</span>
            {(categoryStats.ALL?.places ?? 0) > 0 && (
              <span className="category-chip__dot" title={t('dashboard.kpiPlaces')} />
            )}
          </button>

          {sections.map((section) => {
            const Icon = SECTION_ICON[section.section] ?? IconTag
            const stats = categoryStats[section.section] ?? { brands: 0, places: 0 }
            const isSelected = activeCategory === section.section
            return (
              <button
                key={section.section}
                type="button"
                role="tab"
                aria-selected={isSelected}
                className={`category-chip ${isSelected ? 'is-active' : ''}`}
                onClick={() => setActiveCategory(section.section)}
              >
                <span className="category-chip__icon"><Icon /></span>
                <span className="category-chip__label">{t(`category.${section.section}`)}</span>
                <span className="category-chip__count">({stats.brands})</span>
                {stats.places > 0 && (
                  <span className="category-chip__dot" title={t('dashboard.kpiPlaces')} />
                )}
              </button>
            )
          })}
        </div>
      </div>

      <div id="marques-section" className="stack">
        {filteredSections.map((section) => (
          <Section key={section.section} section={section} locked={locked} />
        ))}
      </div>

      <SubmitPanel submission={submission} onSent={onSent} />
    </div>
  )
}

/** Accueil : l'année vient de la campagne, pas de l'horloge du navigateur. */
function Hero({ campaign, submission }) {
  const { t } = useLocale()
  const claims = readSession()?.claims ?? {}
  const name = claims.given_name || claims.name || claims.preferred_username || ''

  return (
    <div className="hero-card">
      <h1 className="hero-card__title">
        {t('dashboard.title')} <span className="hero-card__year">{campaign.year}</span>
      </h1>
      <div className="hero-card__meta">
        <span className="muted">{t('dashboard.welcome', { name })}</span>
        <OrgUnitBadge submission={submission} />
      </div>
    </div>
  )
}

/**
 * Le pays de la filiale, en drapeau seul.
 *
 * L'agence n'apporte rien ici : celui qui saisit sait où il travaille. Le pays
 * reste utile parce qu'il détermine la langue et le centre de rattachement.
 * `alt` porte son nom — un drapeau sans texte est muet pour un lecteur d'écran.
 */
function OrgUnitBadge({ submission }) {
  const flag = countryFlag(submission?.country)
  if (!flag) return null
  return (
    <img src={flag} alt={submission.country} title={submission.country} className="org-flag" />
  )
}

/**
 * Consignes et échéance.
 *
 * L'échéance sort de `closes_at` et non d'une date écrite en dur : une date figée
 * dans le code survit à la campagne qu'elle annonce, et une filiale qui lit une
 * échéance périmée appelle le support.
 */
function Instructions({ campaign }) {
  const { t } = useLocale()
  const { date } = useFormatters()

  return (
    <div className="card">
      <div className="card__body stack">
        <h2 className="section-title">
          <IconInfo />
          {t('dashboard.instructionsTitle')}
        </h2>

        <div className="instructions">
          <p>{t('dashboard.instructions1')}</p>
          <p>{t('dashboard.instructions2')}</p>
          <p>{t('dashboard.instructions3')}</p>
        </div>

        <div className="notice">
          {campaign.closes_at && (
            <p>
              {t('dashboard.deadlineBefore')}{' '}
              <strong className="accent">{date(campaign.closes_at)}</strong>.{' '}
              {t('dashboard.deadlineAfter')}
            </p>
          )}
          <p>{t('dashboard.contact', { phone: t('dashboard.phone') })}</p>
        </div>
      </div>
    </div>
  )
}

/**
 * Les trois compteurs de la campagne.
 *
 * Calculés sur la charge utile déjà reçue, pas via un appel dédié : deux sources
 * pour le même chiffre finissent toujours par diverger à l'écran.
 */
function Counters({ sections }) {
  const { t } = useLocale()
  const { number } = useFormatters()

  const totals = useMemo(() => {
    const entries = sections.flatMap((section) => section.poles).flatMap((pole) => pole.brands)
    // Une marque figure dans les deux sections : la dédoublonner, sinon TOYOTA
    // choisie en technique et en process compterait pour deux marques.
    const chosen = new Set(
      entries.filter((b) => b.headcount > 0 && !b.is_transverse).map((b) => b.code),
    )
    return {
      brands: chosen.size,
      places: entries.reduce((sum, brand) => sum + (brand.headcount || 0), 0),
      themes: entries.reduce((sum, brand) => sum + (brand.trainings_selected || 0), 0),
    }
  }, [sections])

  return (
    <div className="counter-grid">
      <Counter
        tone="navy"
        icon={<IconTag />}
        label={t('dashboard.kpiBrands')}
        shortLabel={t('dashboard.kpiBrandsShort')}
        value={number(totals.brands)}
      />
      <Counter
        tone="red"
        icon={<IconUsers />}
        label={t('dashboard.kpiPlaces')}
        shortLabel={t('dashboard.kpiPlacesShort')}
        value={number(totals.places)}
      />
      <Counter
        tone="ok"
        icon={<IconBook />}
        label={t('dashboard.kpiThemes')}
        shortLabel={t('dashboard.kpiThemesShort')}
        value={number(totals.themes)}
      />
    </div>
  )
}

/** Rappel d'état — sans lui, une filiale sans accusé croit sa saisie perdue. */
function StatusNote({ campaign, submission }) {
  const { t } = useLocale()
  const { dateTime } = useFormatters()
  if (!submission || submission.status === 'DRAFT') return null

  const isSubmitted = submission.status === 'SUBMITTED'
  const tone =
    submission.status === 'VALIDATED' || isSubmitted ? 'ok' : submission.status === 'REOPENED' ? 'crit' : 'info'
  const headline =
    submission.status === 'VALIDATED'
      ? t('tracking.validated', { date: dateTime(submission.validated_at) })
      : submission.status === 'REOPENED'
        ? t('tracking.reopened')
        : t('tracking.inReview', { year: campaign?.year ?? '2027' })
  const hint =
    submission.status === 'VALIDATED'
      ? t('tracking.validatedHint')
      : submission.status === 'REOPENED'
        ? t('tracking.reopenedHint')
        : null

  return (
    <Banner tone={tone} title={headline}>
      {hint}
      {submission.status === 'REOPENED' && submission.reopen_reason && (
        <p style={{ margin: '10px 0 0' }}>
          <strong>{t('tracking.reason')} </strong>
          {submission.reopen_reason}
        </p>
      )}
    </Banner>
  )
}

const SECTION_ICON = {
  TECHNIQUE: IconCar,
  CARROSSERIE: IconBodywork,
  PROCESS: IconWrench,
}

/**
 * Une rubrique du catalogue, précédée de sa carte de titre.
 *
 * Les BU d'une rubrique tiennent sur une même ligne. La carrosserie est seule
 * dans la sienne : elle s'étale alors sur toute la largeur (voir `.pole-grid`),
 * une demi-carte laisserait un vide sans raison.
 */
function Section({ section, locked }) {
  const { t } = useLocale()
  const Icon = SECTION_ICON[section.section] ?? IconTag

  return (
    <div className="stack">
      <div className="card">
        <div className="card__body">
          <h2 className="section-title">
            <Icon />
            {t(`section.${section.section}`)}
          </h2>
          <p className="muted" style={{ margin: '6px 0 0' }}>
            {t(`section.${section.section}Hint`)}
          </p>
        </div>
      </div>

      <div className="pole-grid">
        {section.poles.map((pole) => (
          <PoleCard key={pole.pole} pole={pole} section={section.section} locked={locked} />
        ))}
      </div>
    </div>
  )
}

function PoleCard({ pole, section, locked }) {
  const { t } = useLocale()

  // L'entrée transverse n'est pas une marque : la compter annonçait « 1 marque »
  // sur la carrosserie, qui justement n'en décline aucune et couvre tous les
  // véhicules. Une BU sans marque propre le dit, elle ne compte pas son repli.
  const brands = pole.brands.filter((brand) => !brand.is_transverse).length
  const scope = brands
    ? t(brands === 1 ? 'poles.brandCountOne' : 'poles.brandCount', { count: brands })
    : t('poles.transverse')

  return (
    <div className="card">
      <div className="card__head">
        <h2 className="pole-title">
          <span className={`pole-icon pole-icon--${pole.pole.toLowerCase()}`}>
            <PoleIcon pole={pole.pole} />
          </span>
          {pole.pole_label}
          <span className="pole-title__count">({scope})</span>
        </h2>
      </div>
      <div className="card__body">
        <ul className="brand-list">
          {pole.brands.map((brand) => (
            <li key={`${pole.pole}-${brand.code}`}>
              <BrandItem brand={brand} pole={pole.pole} section={section} locked={locked} />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}

/**
 * Une marque de la liste.
 *
 * Sans catalogue livré, la marque reste affichée mais n'est pas un lien : la
 * filiale voit que le groupe la forme et que le catalogue arrive, sans tomber sur
 * une grille vide. Un `<span>` plutôt qu'un lien désactivé — un lien qui ne mène
 * nulle part reste focalisable au clavier et annoncé comme cliquable.
 */
function BrandItem({ brand, pole, section, locked }) {
  const { t } = useLocale()
  const headcount = brand.headcount || 0
  const isPopulated = headcount > 0

  const identity = (
    <>
      <BrandLogo code={brand.code} label={brand.label} transverse={brand.is_transverse} />
      <span className="brand-item__name">
        {brand.is_transverse ? t('poles.transverse') : brand.label}
        <span className="brand-item__count">
          {brand.pending
            ? t('poles.pendingCatalog')
            : `(${t(brand.trainings === 1 ? 'poles.theme' : 'poles.themes', {
                count: brand.trainings,
              })})`}
        </span>
      </span>
    </>
  )

  if (brand.pending) {
    return (
      <span className="brand-item brand-item--pending" title={t('poles.pendingCatalogHint')}>
        {identity}
      </span>
    )
  }

  return (
    <Link
      className={`brand-item ${isPopulated ? 'brand-item--populated' : ''}`}
      data-populated={isPopulated ? 'true' : undefined}
      to={`/marque/${encodeURIComponent(brand.code)}?pole=${pole}&section=${section}`}
      aria-disabled={locked || undefined}
      onClick={() => rememberHomeScroll()}
    >
      {identity}
      <span
        className={`brand-item__people ${isPopulated ? 'brand-item__people--populated' : ''}`}
        data-positive={isPopulated ? 'true' : undefined}
        title={t('dashboard.kpiPlaces')}
      >
        <IconUsers />
        {headcount}
      </span>
    </Link>
  )
}

/** Chaque BU porte son icône : on repère le bon pôle sans lire le titre. */
function PoleIcon({ pole }) {
  const common = {
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: 1.75,
    strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
  }
  if (pole === 'EQUIPMENT') {
    return (
      <svg {...common}>
        <path d="M3 17V9h7l3 4h5a3 3 0 0 1 3 3v1" />
        <circle cx="7" cy="18" r="2" />
        <circle cx="17" cy="18" r="2" />
        <path d="M9 18h6M3 9V7h5" />
      </svg>
    )
  }
  if (pole === 'CARROSSERIE') {
    return (
      <svg {...common}>
        <path d="M3 11h4l2-4h6l2 4h4v6h-2a2 2 0 0 1-4 0H9a2 2 0 0 1-4 0H3z" />
        <path d="M7 11h10" />
      </svg>
    )
  }
  if (pole === 'MOBILITY') {
    return (
      <svg {...common}>
        <path d="M4 16v-4l2-5h12l2 5v4" />
        <path d="M4 16h16v2h-3v-2M7 18v-2H4z" />
        <circle cx="7.5" cy="13.5" r="1" />
        <circle cx="16.5" cy="13.5" r="1" />
      </svg>
    )
  }
  return (
    <svg {...common}>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  )
}

