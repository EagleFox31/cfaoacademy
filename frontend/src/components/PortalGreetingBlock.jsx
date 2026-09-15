import { Fragment, useEffect, useState } from 'react'
import useLocale from '../hooks/useLocale'
import AnimatedCount from './AnimatedCount.jsx'
import PortalFilialeFlag from './PortalFilialeFlag.jsx'
import { localizedCountryName } from '../utils/localizeGeo.js'
import { countryCodeFromName } from '../utils/countryFlag.js'
import { resolvePortalOrientKey } from '../utils/portalOrient.js'
import {
  resolveProfileBuShortLabel,
  resolveProfileFilialeLabel,
  resolveProfilePays,
} from '../utils/profileOrg.js'

function splitWords(text) {
  return String(text ?? '').trim().split(/\s+/).filter(Boolean)
}

function DpsHeroStatsLine({ t, technicianCount, brandCount, startWi }) {
  const techs = Number.isFinite(technicianCount) && technicianCount > 0 ? technicianCount : null
  const brands = Number.isFinite(brandCount) && brandCount > 0 ? brandCount : null
  const techLabel = techs === 1
    ? t.dps_hero_greeting_stats_technician_one
    : t.dps_hero_greeting_stats_technicians
  const brandLabel = brands === 1
    ? t.dps_hero_greeting_stats_brand_one
    : t.dps_hero_greeting_stats_brands

  let wi = startWi

  return (
    <p className="portal-header-dps-stats portal-greeting-cascade">
      <span className="portal-word" style={{ '--wi': wi++ }}>{t.dps_hero_greeting_stats_before}</span>{' '}
      <span className="portal-word portal-header-dps-stat" style={{ '--wi': wi++ }}>
        {techs != null ? <AnimatedCount value={techs} /> : '—'}
      </span>{' '}
      <span className="portal-word" style={{ '--wi': wi++ }}>{techLabel}</span>{' '}
      <span className="portal-word portal-header-dps-stat" style={{ '--wi': wi++ }}>
        {brands != null ? <AnimatedCount value={brands} /> : '—'}
      </span>{' '}
      <span className="portal-word" style={{ '--wi': wi++ }}>{brandLabel}</span>
    </p>
  )
}

function KiHeroStatsLine({ t, technicianCount, startWi, loading = false }) {
  const techs = Number.isFinite(technicianCount) && technicianCount > 0 ? technicianCount : null
  let wi = startWi

  /* Perimetre MEDACAP en cours de chargement : squelette, jamais une phrase trouee. */
  if (loading) {
    return (
      <p className="portal-header-dps-stats portal-greeting-cascade">
        <span className="portal-word" style={{ '--wi': wi++ }}>{t.ki_hero_greeting_stats_before}</span>{' '}
        <span
          className="portal-word portal-header-dps-stat-skeleton"
          style={{ '--wi': wi++ }}
          role="status"
          aria-label={t.data_skeleton_aria}
        />
      </p>
    )
  }

  /* Comptage indisponible (MEDACAP injoignable) : phrase complete, sans nombre. */
  if (techs == null) {
    return (
      <p className="portal-header-dps-stats portal-greeting-cascade">
        {splitWords(t.ki_hero_greeting_stats_nocount).map((w, idx) => (
          <Fragment key={`kn-${idx}`}>
            <span className="portal-word" style={{ '--wi': wi + idx }}>{w}</span>{' '}
          </Fragment>
        ))}
      </p>
    )
  }

  const techLabel = techs === 1
    ? t.ki_hero_greeting_stats_technician_one
    : t.ki_hero_greeting_stats_technicians

  return (
    <p className="portal-header-dps-stats portal-greeting-cascade">
      <span className="portal-word" style={{ '--wi': wi++ }}>{t.ki_hero_greeting_stats_before}</span>{' '}
      <span className="portal-word portal-header-dps-stat" style={{ '--wi': wi++ }}>
        <AnimatedCount value={techs} />
      </span>{' '}
      <span className="portal-word" style={{ '--wi': wi++ }}>{techLabel}</span>
    </p>
  )
}

/** Salutation + phrase d'orientation du portail (selon le rôle actif). */
export default function PortalGreetingBlock({
  greetingKey,
  firstName,
  user,
  primaryRole,
  hideOrient = false,
  dpsHero,
  kiHero,
}) {
  const { t, locale } = useLocale('portal')
  const orientKey = resolvePortalOrientKey(primaryRole)
  const orientText = !hideOrient && t[orientKey]
  const filialeLabel = user ? resolveProfileFilialeLabel(user) : null

  const greetingWords = splitWords(greetingKey)
  let wi = 0
  const showPill = Boolean(filialeLabel && user && !dpsHero && !kiHero)

  const pays = user ? resolveProfilePays(user) : null
  const countryLabel = pays
    ? localizedCountryName(pays, locale, countryCodeFromName(pays))
    : null
  const buLabel = user ? resolveProfileBuShortLabel(user, locale) : null
  const filialeSuffix = dpsHero && countryLabel && buLabel
    ? t.dps_hero_greeting_filiale
      .replace('{bu}', buLabel)
      .replace('{country}', countryLabel)
    : kiHero && countryLabel && buLabel
      ? t[kiHero.kind === 'pic' ? 'pic_hero_greeting_filiale' : 'ki_hero_greeting_filiale']
        .replace('{bu}', buLabel)
        .replace('{country}', countryLabel)
      : null
  const filialeSuffixWords = filialeSuffix ? splitWords(filialeSuffix) : []
  const [refreshSoonVisible, setRefreshSoonVisible] = useState(false)

  useEffect(() => {
    if (!refreshSoonVisible) return undefined
    const id = window.setTimeout(() => setRefreshSoonVisible(false), 4000)
    return () => window.clearTimeout(id)
  }, [refreshSoonVisible])

  return (
    <div className="portal-header-greeting-block">
      <h1 className="page-header-title portal-header-greeting portal-greeting-cascade">
        {greetingWords.map((w, idx) => {
          const isLast = idx === greetingWords.length - 1
          const node = (
            <Fragment key={`g-${idx}`}>
              <span className="portal-word" style={{ '--wi': wi }}>
                {isLast && !dpsHero && !kiHero ? `${w},` : w}
              </span>{' '}
            </Fragment>
          )
          wi += 1
          return node
        })}
        <span className="portal-word portal-header-firstname" style={{ '--wi': wi++ }}>
          {firstName}
        </span>
        {dpsHero || kiHero ? (
          <>
            <span className="portal-word" style={{ '--wi': wi++ }}>,</span>{' '}
            {filialeSuffixWords.map((w, idx) => (
              <Fragment key={`f-${idx}`}>
                <span className="portal-word" style={{ '--wi': wi++ }}>{w}</span>{' '}
              </Fragment>
            ))}
          </>
        ) : (
          <>
            <span className="portal-word" style={{ '--wi': wi++ }}>!</span>
            {showPill && (
              <span
                className="portal-header-greeting-org portal-word"
                style={{ '--wi': wi++ }}
              >
                <PortalFilialeFlag user={user} locale={locale} pill />
              </span>
            )}
          </>
        )}
      </h1>
      {dpsHero && (
        <div className="portal-header-dps-stats-row">
          <DpsHeroStatsLine
            t={t}
            technicianCount={dpsHero.technicianCount}
            brandCount={dpsHero.brandCount}
            startWi={wi}
          />
          <div className="portal-header-dps-actions">
            <button
              type="button"
              className="btn portal-header-dps-refresh"
              onClick={() => setRefreshSoonVisible(true)}
            >
              <svg
                className="portal-header-dps-refresh-icon"
                width="15"
                height="15"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden
              >
                <path d="M21 12a9 9 0 1 1-2.64-6.36" />
                <polyline points="21 3 21 9 15 9" />
              </svg>
              {t.dps_hero_refresh_btn}
            </button>
          </div>
          {refreshSoonVisible && (
            <p className="portal-header-dps-soon-note" role="status">
              {t.dps_hero_refresh_soon}
            </p>
          )}
        </div>
      )}
      {kiHero && (
        <div className="portal-header-dps-stats-row">
          <KiHeroStatsLine
            t={t}
            technicianCount={kiHero.technicianCount}
            loading={kiHero.loading}
            startWi={wi}
          />
        </div>
      )}
      {orientText && (
        <p className="portal-header-orient portal-greeting-cascade">
          {splitWords(orientText).map((w, idx) => (
            <Fragment key={`o-${idx}`}>
              <span className="portal-word" style={{ '--wi': wi + idx }}>{w}</span>{' '}
            </Fragment>
          ))}
        </p>
      )}
    </div>
  )
}
