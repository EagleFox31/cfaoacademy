import { useMemo, useState } from 'react'
import cartographie from '../data/academy/pays-cartographie.json'
import { countryCodeFromName } from '../utils/countryFlag.js'
import useLocale from '../hooks/useLocale.js'
import { localizeAcademyPillar, localizeCartographieRegions } from '../utils/localizeAcademy.js'

/**
 * Carte d'un pays : drapeau et nom, badge optionnel.
 *
 * Reprise ailleurs (portail RH) avec le code ISO du pays (`code`), quand le
 * nom affiche n'est pas celui de la cartographie, et des chiffres sous le
 * nom (`children`) ; `onClick` la rend cliquable.
 */
export function AcademyCountryChip({
  name, displayName, status = 'covered', statusPotentialLabel,
  code: codeIso, children, onClick,
}) {
  const code = codeIso ?? countryCodeFromName(name)
  const flagUrl = code ? `https://flagcdn.com/w40/${code}.png` : null
  const isPotential = status === 'potential'
  const label = displayName ?? name
  const cliquable = onClick
    ? {
      role: 'button',
      tabIndex: 0,
      style: { cursor: 'pointer' },
      onClick,
      onKeyDown: e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onClick() } },
    }
    : {}

  return (
    <div className={`academy-pays-country${isPotential ? ' academy-pays-country--potential' : ''}`}
      {...cliquable}>
      <div className="academy-pays-country-line">
        {code && flagUrl && (
          <img
            className="academy-pays-country-flag"
            src={flagUrl}
            srcSet={`https://flagcdn.com/w80/${code}.png 2x`}
            alt=""
            width={20}
            height={15}
            loading="lazy"
            decoding="async"
          />
        )}
        <span className="academy-pays-country-name">{label}</span>
      </div>
      {children}
      {isPotential && (
        <span className="academy-pays-country-badge">{statusPotentialLabel}</span>
      )}
    </div>
  )
}

export default function AcademyPaysPanel({ data, onBack }) {
  const { locale, t: uiT } = useLocale('academyUi')
  const { t: regionsT } = useLocale('regions')
  const localizedData = localizeAcademyPillar(data, locale)
  const regions = useMemo(
    () => localizeCartographieRegions(cartographie.regions, locale),
    [locale],
  )
  const [activeId, setActiveId] = useState(regions[0]?.id ?? null)

  const activeRegion = useMemo(
    () => regions.find((r) => r.id === activeId) ?? regions[0],
    [activeId, regions],
  )

  if (!localizedData) return null

  return (
    <article className="academy-pays" aria-labelledby="academy-pays-title">
      {onBack && (
        <button
          type="button"
          className="academy-detail-close"
          onClick={onBack}
          aria-label={uiT.closePanels}
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" aria-hidden="true">
            <path d="M18 6 6 18" />
            <path d="m6 6 12 12" />
          </svg>
        </button>
      )}

      <div className="academy-pays-grid-layout">
        <aside className="academy-pays-regions-card" aria-label={uiT.paysNavAria}>
          <p className="academy-pays-regions-kicker">{regionsT.regionsKicker}</p>
          <nav className="academy-pays-regions-nav">
            {regions.map((region) => (
              <button
                key={region.id}
                type="button"
                className={`academy-pays-region-btn${activeRegion?.id === region.id ? ' is-active' : ''}`}
                aria-current={activeRegion?.id === region.id ? 'true' : undefined}
                onClick={() => setActiveId(region.id)}
              >
                <span className="academy-pays-region-btn-label">{region.shortLabel}</span>
                <span className="academy-pays-region-btn-count">{region.count}</span>
              </button>
            ))}
          </nav>
        </aside>

        <div className="academy-pays-content-card" aria-live="polite">
          <header className="academy-pays-head">
            {localizedData.panelIx && <p className="academy-pays-ix">{localizedData.panelIx}</p>}
            <h3 className="academy-pays-title" id="academy-pays-title">
              {localizedData.panelTitle ?? localizedData.title}
            </h3>
            {localizedData.lead && <p className="academy-pays-lead">{localizedData.lead}</p>}
          </header>

          {activeRegion && (
            <section className="academy-pays-region" aria-labelledby={`academy-pays-region-${activeRegion.id}`}>
              <h4 className="academy-pays-region-label" id={`academy-pays-region-${activeRegion.id}`}>
                {activeRegion.label} · {activeRegion.count}
              </h4>
              <div className="academy-pays-grid" role="list">
                {activeRegion.countries.map((country) => (
                  <AcademyCountryChip
                    key={country.name}
                    name={country.name}
                    displayName={country.displayName}
                    status={country.status}
                    statusPotentialLabel={regionsT.statusPotential}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </div>
    </article>
  )
}
