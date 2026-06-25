import { useMemo } from 'react'
import ChipFilterBar from './ChipFilterBar.jsx'
import SessionsMonthGrid from './SessionsMonthGrid.jsx'
import useLocale from '../hooks/useLocale.js'

function uniqueBrands(sessions) {
  const counts = new Map()
  for (const s of sessions) {
    const name = s.marque?.trim()
    if (!name) continue
    counts.set(name, (counts.get(name) ?? 0) + 1)
  }
  return [...counts.entries()].sort(([a], [b]) => a.localeCompare(b, 'fr'))
}

export default function SessionsExpandedView({
  sessions,
  filterKey,
  brand,
  onBrandChange,
  sessionsReturn,
}) {
  const { t: commonT } = useLocale('common')
  const { t: homeT } = useLocale('home')
  const brands = useMemo(() => uniqueBrands(sessions), [sessions])

  const filtered = useMemo(
    () => (brand === 'all' ? sessions : sessions.filter((s) => s.marque === brand)),
    [sessions, brand],
  )

  const returnWithBrand = sessionsReturn
    ? { ...sessionsReturn, brand }
    : undefined

  const showBrandFilter = brands.length > 1

  return (
    <div className="sessions-expanded">
      {showBrandFilter && (
        <ChipFilterBar
          label={commonT.brandLabel}
          ariaLabel={commonT.brandFilterAria}
          value={brand}
          onChange={onBrandChange}
          options={[
            { id: 'all', label: commonT.allBrands },
            ...brands.map(([name]) => ({ id: name, label: name })),
          ]}
        />
      )}

      {filtered.length === 0 ? (
        <div className="empty-section">
          {homeT.sessionsEmptyBrand}
        </div>
      ) : (
        <SessionsMonthGrid sessions={filtered} sessionsReturn={returnWithBrand} />
      )}
    </div>
  )
}
