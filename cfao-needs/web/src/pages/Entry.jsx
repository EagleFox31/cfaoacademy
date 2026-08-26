import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'

import { useCampaign } from '../App'
import { AsyncBoundary, Banner, Empty, PageHead, SaveIndicator } from '../components/ui'
import { useLocale } from '../i18n'
import { api } from '../lib/api'
import { useAsync, useDebouncedSave } from '../lib/hooks'

const QUARTERS = ['q1', 'q2', 'q3', 'q4']
const PLACES = ['CFR', 'FILIALE']

/**
 * Grille de saisie — le cœur du parcours filiale.
 *
 * Maille 2027 : une formation × quatre trimestres × (effectif + lieu). Academix
 * ne demandait qu'un trimestre et un effectif ; le fichier de travail 2027 demande
 * les quatre, chacun avec son lieu souhaité.
 *
 * Le brouillon part au serveur (débounce 800 ms) : changer de poste ne perd rien.
 */
export default function Entry() {
  const { t } = useLocale()
  const { campaign, submission } = useCampaign()

  const state = useAsync(async () => {
    if (!campaign || !submission) return { catalog: [], lines: [] }
    const [catalog, lines] = await Promise.all([
      api.catalog(campaign.id),
      api.lines(submission.id),
    ])
    return { catalog: catalog?.results ?? catalog ?? [], lines: lines?.results ?? lines ?? [] }
  }, [campaign?.id, submission?.id])

  if (!campaign || !submission) return <Empty>{t('app.loading')}</Empty>

  return (
    <AsyncBoundary state={state}>
      {(data) => <Grid campaign={campaign} submission={submission} {...data} />}
    </AsyncBoundary>
  )
}

function Grid({ campaign, submission, catalog, lines }) {
  const { t } = useLocale()
  const locked = submission.status === 'SUBMITTED' || submission.status === 'VALIDATED'

  const [values, setValues] = useState(() => {
    const map = {}
    lines.forEach((line) => {
      map[line.catalog_line_id] = {
        q1: line.q1, q2: line.q2, q3: line.q3, q4: line.q4,
        place_q1: line.place_q1, place_q2: line.place_q2,
        place_q3: line.place_q3, place_q4: line.place_q4,
      }
    })
    return map
  })

  const { queue, state: saveState } = useDebouncedSave((rows) =>
    api.writeLines(submission.id, rows),
  )

  const [search, setSearch] = useState('')
  const [family, setFamily] = useState('')
  const [brand, setBrand] = useState('')
  const [tier, setTier] = useState('')
  const [filledOnly, setFilledOnly] = useState(false)

  const families = useMemo(
    () => [...new Map(catalog.map((l) => [l.family_key, l.family_label])).entries()],
    [catalog],
  )
  const brands = useMemo(
    () =>
      [...new Set(catalog.map((l) => l.brand_label).filter(Boolean))].sort((a, b) =>
        a.localeCompare(b),
      ),
    [catalog],
  )
  const tiers = useMemo(
    () => [...new Set(catalog.map((l) => l.tier).filter(Boolean))],
    [catalog],
  )

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase()
    return catalog.filter((line) => {
      if (family && line.family_key !== family) return false
      if (brand && line.brand_label !== brand) return false
      if (tier && line.tier !== tier) return false
      if (filledOnly && totalOf(values[line.id]) === 0) return false
      if (!needle) return true
      return (
        line.code.toLowerCase().includes(needle) ||
        line.title.toLowerCase().includes(needle) ||
        (line.brand_label || '').toLowerCase().includes(needle)
      )
    })
  }, [catalog, search, family, brand, tier, filledOnly, values])

  function update(line, patch) {
    const current = values[line.id] ?? blank()
    const next = { ...current, ...patch }
    setValues((prev) => ({ ...prev, [line.id]: next }))
    queue({ catalog_line: line.id, ...next })
  }

  const total = useMemo(
    () => Object.values(values).reduce((sum, row) => sum + totalOf(row), 0),
    [values],
  )

  return (
    <>
      <PageHead eyebrow={t('campaign.title', { year: campaign.year })} title={t('grid.title')} subtitle={t('grid.subtitle')}>
        <SaveIndicator state={saveState} />
        <Link to="/recapitulatif" className="btn btn--primary">
          {t('grid.next')}
        </Link>
      </PageHead>

      {locked && <Banner tone="info">{t('grid.locked')}</Banner>}

      <div className="filters">
        <input
          type="search"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder={t('app.search')}
          aria-label={t('app.search')}
        />
        <select value={family} onChange={(event) => setFamily(event.target.value)} aria-label={t('grid.allFamilies')}>
          <option value="">{t('grid.allFamilies')}</option>
          {families.map(([key, label]) => (
            <option key={key} value={key}>
              {label}
            </option>
          ))}
        </select>
        <select value={brand} onChange={(event) => setBrand(event.target.value)} aria-label={t('grid.allBrands')}>
          <option value="">{t('grid.allBrands')}</option>
          {brands.map((name) => (
            <option key={name} value={name}>
              {name}
            </option>
          ))}
        </select>
        {tiers.length > 0 && (
          <select value={tier} onChange={(event) => setTier(event.target.value)} aria-label={t('grid.allTiers')}>
            <option value="">{t('grid.allTiers')}</option>
            {tiers.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </select>
        )}
        <label className="row" style={{ gap: 6, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={filledOnly}
            onChange={(event) => setFilledOnly(event.target.checked)}
          />
          {t('grid.filledOnly')}
        </label>
        <span className="spacer" />
        <strong className="num">{total}</strong>
        <span className="muted">{t('recap.totalHeadcount')}</span>
      </div>

      {rows.length === 0 ? (
        <Empty>{t('grid.noResult')}</Empty>
      ) : (
        <div className="table-wrap">
          <table className="grid-table">
            <thead>
              <tr>
                <th rowSpan={2}>{t('grid.colTraining')}</th>
                <th rowSpan={2}>{t('grid.colBrand')}</th>
                <th colSpan={4} className="num">
                  {t('grid.colHeadcount')}
                </th>
                <th colSpan={4} className="num">
                  {t('grid.colPlace')}
                </th>
              </tr>
              <tr>
                {QUARTERS.map((q) => (
                  <th key={`h-${q}`} className="num">
                    {t(`quarter.${q}`)}
                  </th>
                ))}
                {QUARTERS.map((q) => (
                  <th key={`p-${q}`} className="num">
                    {t(`quarter.${q}`)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows.map((line) => {
                const row = values[line.id] ?? blank()
                const filled = totalOf(row) > 0
                const disabled = locked || line.family_status !== 'READY'
                return (
                  <tr key={line.id} data-filled={filled} data-locked={disabled}>
                    <td className="cell-title">
                      <div className="cell-code">{line.code}</div>
                      <div>{line.title}</div>
                      {line.family_status !== 'READY' && (
                        <div className="muted" style={{ fontSize: 11.5 }}>
                          {t('grid.pendingRow')}
                        </div>
                      )}
                    </td>
                    <td>
                      {line.brand_label || <span className="muted">{t('grid.crossBrand')}</span>}
                    </td>
                    {QUARTERS.map((q) => (
                      <td key={`${line.id}-${q}`} style={{ textAlign: 'center' }}>
                        <input
                          className="qty"
                          type="number"
                          min="0"
                          inputMode="numeric"
                          disabled={disabled}
                          data-positive={row[q] > 0}
                          value={row[q] || ''}
                          aria-label={`${line.code} ${t(`quarter.${q}`)}`}
                          onChange={(event) =>
                            update(line, { [q]: clamp(event.target.value) })
                          }
                        />
                      </td>
                    ))}
                    {QUARTERS.map((q) => (
                      <td key={`${line.id}-p-${q}`}>
                        <select
                          className="place"
                          disabled={disabled || !row[q]}
                          value={row[`place_${q}`]}
                          aria-label={`${line.code} ${t('grid.colPlace')} ${t(`quarter.${q}`)}`}
                          onChange={(event) =>
                            update(line, { [`place_${q}`]: event.target.value })
                          }
                        >
                          {PLACES.map((place) => (
                            <option key={place} value={place}>
                              {t(`grid.place${place}`)}
                            </option>
                          ))}
                        </select>
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  )
}

function blank() {
  return {
    q1: 0, q2: 0, q3: 0, q4: 0,
    place_q1: 'CFR', place_q2: 'CFR', place_q3: 'CFR', place_q4: 'CFR',
  }
}

function totalOf(row) {
  if (!row) return 0
  return QUARTERS.reduce((sum, q) => sum + (Number(row[q]) || 0), 0)
}

function clamp(value) {
  const parsed = Number.parseInt(value, 10)
  if (Number.isNaN(parsed) || parsed < 0) return 0
  return Math.min(parsed, 9999)
}
