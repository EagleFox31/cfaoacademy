/**
 * Vues du module « Clé de répartition ». Chaque vue = un tableau type tableur
 * (DataSheet) + le strict nécessaire autour : chiffres clés, bandeau, boutons Excel.
 */
import { useEffect, useMemo, useState } from 'react'
import DataSheet from '../../../components/sheet/DataSheet'
import { coverageTone } from '../../../components/sheet/sheetMath'
import { planningApi } from '../../../lib/planningApi'

const sumOf = (rows, fn) => rows.reduce((s, r) => s + (Number(fn(r)) || 0), 0)
const ratio = (num, den) => (den ? num / den : null)
const deltaTone = v => (v < 0 ? 'neg' : v > 0 ? 'pos' : null)
const serverLang = locale => (locale === 'en' ? 'en' : 'fr')

export const errText = (t, err) => (err?.code && t[`err_${err.code}`]) || err?.message || t.err_generic

export function Banner({ tone = 'info', children }) {
  return <p className={`ck-banner ck-banner--${tone}`} role={tone === 'warn' ? 'alert' : 'status'}>{children}</p>
}

function Kpis({ items }) {
  return (
    <dl className="ck-kpis">
      {items.map(k => (
        <div className="ck-kpi" key={k.label}>
          <dt>{k.label}</dt>
          <dd>{k.value}</dd>
        </div>
      ))}
    </dl>
  )
}

/** Bouton de téléchargement Excel : désactivé pendant l'envoi, erreur affichée sur place. */
function XlsxButton({ label, t, run }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const click = async () => {
    setBusy(true); setErr(null)
    try { await run() } catch (e) { setErr(errText(t, e)) } finally { setBusy(false) }
  }
  return (
    <>
      <button type="button" className="sheet-btn ck-xlsx" onClick={click} disabled={busy}>
        {busy ? t.downloading : label}
      </button>
      {err && <span className="ck-inline-err">{err}</span>}
    </>
  )
}

export function Segmented({ value, options, onChange, label }) {
  return (
    <div className="ck-seg" role="radiogroup" aria-label={label}>
      {options.map(o => (
        <button key={o.value} type="button" role="radio" aria-checked={value === o.value}
          className={value === o.value ? 'is-on' : ''} onClick={() => onChange(o.value)}>
          {o.label}
        </button>
      ))}
    </div>
  )
}

/* ─────────────────────────── Tableau (tous pays × marques) ─────────────────────────── */

export function TableView({ t, locale, fmt, ckey, mode, global, openCountry, simple = false }) {
  const [metric, setMetric] = useState('seats')
  const rows = global.rows

  const columns = useMemo(() => {
    const brands = global.brands.filter(b => {
      const tot = global.brand_totals[b.code] || {}
      return (tot.seats || 0) > 0 || (tot.needs || 0) > 0
    })
    const metricLabel = { seats: t.col_seats, needs: t.col_needs, coverage: t.col_coverage }[metric]
    const brandCols = brands.map(b => ({
      id: `b_${b.code}`, header: b.label, group: metricLabel, width: 92,
      type: metric === 'coverage' ? 'percent' : 'int',
      value: r => {
        const cell = r.cells?.[b.code]
        if (!cell) return null
        return cell[metric] ?? null
      },
      total: metric === 'coverage'
        ? rs => ratio(sumOf(rs, r => r.cells?.[b.code]?.seats), sumOf(rs, r => r.cells?.[b.code]?.needs))
        : 'sum',
      tone: metric === 'coverage' ? v => coverageTone(v) : undefined,
    }))
    return [
      { id: 'country', header: t.col_country, type: 'text', width: 170, value: r => r.label },
      { id: 'enrolled', header: t.col_enrolled, type: 'text', width: 70, hidden: true,
        value: r => (r.enrolled ? t.yes : t.no) },
      { id: 'technicians', header: t.col_technicians, type: 'int', total: 'sum', value: r => r.technicians },
      { id: 'needs', header: t.col_needs, type: 'int', total: 'sum', value: r => r.needs },
      { id: 'seats', header: t.col_seats, type: 'int', total: 'sum', value: r => r.seats },
      { id: 'coverage', header: t.col_coverage, type: 'percent', width: 110, bar: true,
        value: r => r.coverage, tone: v => coverageTone(v),
        total: rs => ratio(sumOf(rs, r => r.seats), sumOf(rs, r => r.needs)) },
      { id: 'share', header: t.col_share, type: 'percent', total: 'sum', value: r => r.share },
      { id: 'key_cost', header: t.col_key_cost, type: 'money', width: 130, total: 'sum', value: r => r.key_cost },
      { id: 'trainee_lodging', header: t.col_trainee_lodging, type: 'money', width: 130, total: 'sum',
        value: r => r.trainee_lodging },
      { id: 'trainer_lodging', header: t.col_trainer_lodging, type: 'money', width: 130, total: 'sum',
        value: r => r.trainer_lodging },
      { id: 'total', header: t.col_total, type: 'money', width: 140, total: 'sum', value: r => r.total },
      ...brandCols,
    ]
  }, [global, metric, t])

  const totalNeeds = sumOf(rows, r => r.needs)
  const totalSeats = sumOf(rows, r => r.seats)
  const needsMissing = global.needs_source === 'none' || (global.warnings || []).length > 0

  // Lecteur pressé : rien qui ne porte une valeur. Une colonne, un indicateur ou
  // un choix sans donnée disparaît au lieu d'afficher « — » ou un champ vide.
  const shownColumns = useMemo(() => (simple
    ? columns.filter(c => c.id === 'country' || rows.some(r => c.value(r) != null && c.value(r) !== ''))
    : columns), [simple, columns, rows])
  const kpis = [
    { label: t.kpi_budget, value: global.budget ? fmt(global.budget, 'money') : null },
    { label: t.kpi_seats, value: fmt(global.total_seats, 'int') },
    // « Tous pôles » : un coût horaire par pôle, aucun n'a de sens pour l'ensemble.
    ...(global.pole === 'ALL' ? [] : [
      { label: t.kpi_hour, value: global.hourly_cost ? fmt(global.hourly_cost, 'money') : null },
    ]),
    { label: t.kpi_coverage, value: totalNeeds ? fmt(ratio(totalSeats, totalNeeds), 'percent') : null },
    { label: t.kpi_countries, value: fmt(rows.length, 'int') },
  ].map(k => ({ ...k, value: k.value || (simple ? null : '—') }))
    .filter(k => k.value != null)
  const metricOptions = [
    { value: 'seats', label: t.col_seats },
    ...(simple && needsMissing ? [] : [
      { value: 'needs', label: t.col_needs },
      { value: 'coverage', label: t.col_coverage },
    ]),
  ]

  return (
    <section className="ck-view" aria-labelledby="ck-view-title">
      <Kpis items={kpis} />
      {needsMissing && !simple && <Banner tone="warn">{t.needs_missing}</Banner>}
      {metricOptions.length > 1 && (
        <div className="ck-viewbar">
          <span className="ck-viewbar-label">{t.brand_metric}</span>
          <Segmented value={metric} onChange={setMetric} label={t.brand_metric} options={metricOptions} />
        </div>
      )}
      <DataSheet
        id="ck-global" columns={shownColumns} rows={rows} rowKey={r => r.country} frozen={1} simple={simple}
        exportName={`cle-${ckey.year}-${ckey.pole}-${mode.toLowerCase()}`}
        onRowOpen={r => openCountry(r.country)} openHint={t.open_hint}
        actions={global.partial ? null : (
          <>
            <XlsxButton t={t} label={t.xlsx_table}
              run={() => planningApi.downloadGlobal(ckey, mode, serverLang(locale))} />
            <XlsxButton t={t} label={t.xlsx_all}
              run={() => planningApi.downloadAll(ckey, mode, serverLang(locale))} />
          </>
        )}
      />
    </section>
  )
}

/* ─────────────────────────── Pays (fiche) ─────────────────────────── */

export function CountryView({ t, locale, fmt, ckey, mode, global, code, setCode }) {
  const [state, setState] = useState({ loading: true })
  const countries = global.rows
  const current = code || countries[0]?.country

  useEffect(() => {
    if (!current) { setState({ loading: false, data: null }); return undefined }
    let alive = true
    setState(s => ({ ...s, loading: true, error: null }))
    const load = ckey.pole === 'ALL'
      ? planningApi.yearCountry(ckey.year, current, mode)
      : planningApi.country(ckey.id, current, mode)
    load
      .then(data => alive && setState({ loading: false, data }))
      .catch(error => alive && setState({ loading: false, error }))
    return () => { alive = false }
  }, [ckey.id, ckey.pole, ckey.year, current, mode])

  const columns = useMemo(() => [
    { id: 'brand', header: t.col_brand, type: 'text', width: 110, value: s => s.brand },
    { id: 'code', header: t.col_code, type: 'text', width: 110, value: s => s.code },
    { id: 'title', header: t.col_title, type: 'text', width: 260, value: s => s.title },
    { id: 'start', header: t.col_start, type: 'date', width: 100, value: s => s.start_date },
    { id: 'end', header: t.col_end, type: 'date', width: 100, value: s => s.end_date },
    { id: 'trainers', header: t.col_trainers, type: 'text', width: 160,
      value: s => (Array.isArray(s.trainers) ? s.trainers.join(', ') : s.trainers) },
    { id: 'location', header: t.col_location, type: 'text', width: 120, value: s => s.location },
    { id: 'host', header: t.col_host, type: 'text', width: 110, value: s => s.host },
    { id: 'seats', header: t.col_seats, type: 'int', total: 'sum', value: s => s.seats },
  ], [t])

  const data = state.data
  const foot = data?.footer
  return (
    <section className="ck-view">
      <div className="ck-viewbar">
        <label className="ck-field ck-field--inline">
          <span>{t.pick_country}</span>
          <select value={current || ''} onChange={e => setCode(e.target.value)}>
            {countries.map(c => <option key={c.country} value={c.country}>{c.label}</option>)}
          </select>
        </label>
        {data && (
          <XlsxButton t={t} label={t.xlsx_country}
            run={() => planningApi.downloadCountry(ckey, current, mode, serverLang(locale))} />
        )}
      </div>
      {state.loading && <p className="ck-muted">{t.loading}</p>}
      {state.error && <Banner tone="warn">{errText(t, state.error)}</Banner>}
      {foot && (
        <Kpis items={[
          { label: t.col_total, value: fmt(foot.total, 'money') },
          { label: t.col_key_cost, value: fmt(foot.key_cost, 'money') },
          { label: t.col_trainee_lodging, value: fmt(foot.trainee_lodging, 'money') },
          { label: t.col_trainer_lodging, value: fmt(foot.trainer_lodging, 'money') },
          { label: t.col_seats, value: fmt(foot.seats, 'int') },
          { label: t.col_share, value: fmt(foot.share, 'percent') },
          { label: t.col_coverage, value: foot.coverage == null ? '—' : fmt(foot.coverage, 'percent') },
        ]} />
      )}
      {data && (
        <DataSheet id="ck-country" columns={columns} rows={data.sessions} frozen={2}
          rowKey={(s, i) => `${s.code}-${s.start_date}-${i}`}
          exportName={`cle-${ckey.year}-${current}`} emptyText={t.no_sessions} />
      )}
    </section>
  )
}

/* ─────────────────────────── Prévu / Réalisé ─────────────────────────── */

const MATCH_CHIP = {
  MATCHED: 'done', SHORTFALL: 'progress', EXTRA: 'open', PLANNED_ONLY: 'todo', ACTUAL_ONLY: 'open',
}

export function CompareView({ t, ckey }) {
  const [tab, setTab] = useState('country')
  const [state, setState] = useState({ loading: true })

  useEffect(() => {
    let alive = true
    setState({ loading: true })
    Promise.all([planningApi.compare(ckey.id), planningApi.match(ckey.id)])
      .then(([compare, match]) => alive && setState({ loading: false, compare, match }))
      .catch(error => alive && setState({ loading: false, error }))
    return () => { alive = false }
  }, [ckey.id])

  const countryCols = useMemo(() => [
    { id: 'country', header: t.col_country, type: 'text', width: 170, value: r => r.label },
    { id: 'ps', header: t.col_planned_seats, group: t.col_seats, type: 'int', total: 'sum', value: r => r.planned_seats },
    { id: 'as', header: t.col_actual_seats, group: t.col_seats, type: 'int', total: 'sum', value: r => r.actual_seats },
    { id: 'ds', header: t.col_delta_seats, group: t.col_seats, type: 'int', total: 'sum',
      value: r => r.delta_seats, tone: deltaTone },
    { id: 'psh', header: t.col_planned_share, group: t.col_share, type: 'percent', value: r => r.planned_share },
    { id: 'ash', header: t.col_actual_share, group: t.col_share, type: 'percent', value: r => r.actual_share },
    { id: 'pt', header: t.col_planned_total, group: t.col_total, type: 'money', width: 140, total: 'sum',
      value: r => r.planned_total },
    { id: 'at', header: t.col_actual_total, group: t.col_total, type: 'money', width: 140, total: 'sum',
      value: r => r.actual_total },
    { id: 'dt', header: t.col_delta_total, group: t.col_total, type: 'money', width: 140, total: 'sum',
      value: r => r.delta_total, tone: deltaTone },
  ], [t])

  const sessionCols = useMemo(() => [
    { id: 'brand', header: t.col_brand, type: 'text', width: 110, value: g => g.brand },
    { id: 'code', header: t.col_code, type: 'text', width: 120, value: g => g.code },
    { id: 'host', header: t.col_host, type: 'text', width: 140, value: g => g.host_label || g.host },
    { id: 'planned', header: t.col_planned, type: 'int', total: 'sum', value: g => g.planned },
    { id: 'actual', header: t.col_actual, type: 'int', total: 'sum', value: g => g.actual },
    { id: 'status', header: t.col_status, type: 'text', width: 160,
      value: g => t[`match_${g.status}`] || g.status,
      render: (v, g) => <span className={`portal-status-chip ${MATCH_CHIP[g.status] || 'todo'}`}>{v}</span> },
  ], [t])

  if (state.loading) return <p className="ck-muted">{t.loading}</p>
  if (state.error) return <Banner tone="warn">{errText(t, state.error)}</Banner>

  const { compare, match } = state
  const actualEmpty = compare.lines.every(l => !l.actual_seats)
  return (
    <section className="ck-view">
      {actualEmpty && <Banner tone="warn">{t.actual_empty}</Banner>}
      <ul className="ck-chips" aria-label={t.col_status}>
        {Object.entries(compare.match || {}).map(([status, n]) => (
          <li key={status}>
            <span className={`portal-status-chip ${MATCH_CHIP[status] || 'todo'}`}>{t[`match_${status}`] || status}</span>
            <strong>{n}</strong>
          </li>
        ))}
      </ul>
      <div className="ck-viewbar">
        <Segmented value={tab} onChange={setTab} label={t.nav_compare} options={[
          { value: 'country', label: t.by_country },
          { value: 'session', label: t.by_session },
        ]} />
      </div>
      {tab === 'country'
        ? <DataSheet id="ck-compare" columns={countryCols} rows={compare.lines} rowKey={r => r.country}
            exportName={`cle-${ckey.year}-prevu-realise`} />
        : <DataSheet id="ck-match" columns={sessionCols} rows={match.groups} frozen={2}
            rowKey={(g, i) => `${g.code}-${g.host}-${i}`} exportName={`cle-${ckey.year}-sessions`} />}
    </section>
  )
}

/* ─────────────────────────── Thèmes oubliés ─────────────────────────── */

export function ThemesView({ t, ckey }) {
  const [state, setState] = useState({ loading: true })
  useEffect(() => {
    let alive = true
    setState({ loading: true })
    planningApi.unchosen(ckey.id)
      .then(data => alive && setState({ loading: false, data }))
      .catch(error => alive && setState({ loading: false, error }))
    return () => { alive = false }
  }, [ckey.id])

  const columns = useMemo(() => [
    { id: 'brand', header: t.col_brand, type: 'text', width: 120, value: m => m.brand },
    { id: 'tier', header: t.col_tier, type: 'text', width: 100,
      value: m => t[`tier_${m.tier}`] || m.tier,
      render: (v, m) => (
        <span className={`portal-status-chip portal-tier-${String(m.tier || '').toLowerCase()}`}>{v}</span>
      ) },
    { id: 'code', header: t.col_code, type: 'text', width: 120, value: m => m.code },
    { id: 'title', header: t.col_title, type: 'text', width: 340, value: m => m.title },
    { id: 'pole', header: t.col_pole, type: 'text', width: 100, hidden: true,
      value: m => t[`pole_${m.pole}`] || m.pole },
  ], [t])

  if (state.loading) return <p className="ck-muted">{t.loading}</p>
  if (state.error) return <Banner tone="warn">{errText(t, state.error)}</Banner>
  const { data } = state
  return (
    <section className="ck-view">
      <p className="ck-lead">{t.themes_lead}</p>
      {!data.available
        ? <Banner tone="warn">{t.themes_unavailable}</Banner>
        : <DataSheet id="ck-themes" columns={columns} rows={data.modules} frozen={1}
            rowKey={m => `${m.brand}-${m.code}`} emptyText={t.themes_none}
            exportName={`themes-oublies-${ckey.year}`} />}
    </section>
  )
}
