/**
 * Vues du module « Clé de répartition ». Chaque vue = un tableau type tableur
 * (DataSheet) + le strict nécessaire autour : chiffres clés, bandeau, boutons Excel.
 */
import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSettle } from '../../../components/sheet/useSettle'
import DataSheet from '../../../components/sheet/DataSheet'
import { coverageTone } from '../../../components/sheet/sheetMath'
import { planningApi } from '../../../lib/planningApi'
import { flagUrlForIso } from '../../../utils/countryFlag'
import { resolveCardBrandBadge } from '../../../utils/cardBrandBadge'

const brandLogo = b => resolveCardBrandBadge(b.label || b.code).logo
  || resolveCardBrandBadge(b.code).logo || undefined

/** Filiale : drapeau local (aucun CDN) puis libellé ; sans drapeau, le code pays. */
function CountryName({ code, label }) {
  const [broken, setBroken] = useState(false)
  const flag = broken ? null : flagUrlForIso(code)
  return (
    <span className="ck-country">
      {flag
        ? <img className="ck-flag" src={flag} alt="" aria-hidden="true" onError={() => setBroken(true)} />
        : <span className="ck-flag-code" aria-hidden="true">{String(code || '').toUpperCase()}</span>}
      <span className="ck-country-label">{label}</span>
    </span>
  )
}

const countryColumn = t => ({
  id: 'country', header: t.col_country, type: 'text', width: 190, value: r => r.label,
  render: (v, r) => <CountryName code={r.country} label={v} />,
})

const sumOf = (rows, fn) => rows.reduce((s, r) => s + (Number(fn(r)) || 0), 0)
const ratio = (num, den) => (den ? num / den : null)
const deltaTone = v => (v < 0 ? 'neg' : v > 0 ? 'pos' : null)
const serverLang = locale => (locale === 'en' ? 'en' : 'fr')

export const errText = (t, err) => (err?.code && t[`err_${err.code}`]) || err?.message || t.err_generic

/**
 * Squelette de chargement à la forme du tableur (chiffres clés en option, barre d'outils,
 * en-tête bleu nuit, lignes) : la page ne saute plus quand les données arrivent.
 * Réutilise le shimmer `.skel` de motion.css.
 */
export function SheetSkeleton({ label, kpis = false, rows = 8 }) {
  return (
    <div className="ck-skel" role="status" aria-busy="true" aria-label={label}>
      {kpis && (
        <div className="ck-skel-kpis">
          {[0, 1, 2, 3].map(i => (
            <div key={i} className="ck-skel-kpi">
              <span className="skel skel--text" style={{ width: '55%' }} />
              <span className="skel skel--title" style={{ width: '70%' }} />
            </div>
          ))}
        </div>
      )}
      <div className="ck-skel-sheet">
        <div className="ck-skel-toolbar">
          <span className="skel ck-skel-search" />
          <span className="skel skel--pill" /><span className="skel skel--pill" />
        </div>
        <div className="ck-skel-head" />
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="ck-skel-row">
            <span className="skel skel--text" style={{ width: `${22 + ((i * 7) % 12)}%` }} />
            <span className="skel skel--text skel--dim" style={{ width: '14%' }} />
            <span className="skel skel--text skel--dim" style={{ width: '12%' }} />
            <span className="skel skel--text skel--dim" style={{ width: '16%' }} />
          </div>
        ))}
      </div>
      <span className="ck-sr">{label}</span>
    </div>
  )
}

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

/** Pictogramme classeur (vert tableur), inline : aucun fichier ni CDN. */
function SpreadsheetIcon() {
  return (
    <svg className="ck-xlsx-icon" viewBox="0 0 24 24" width="18" height="18" aria-hidden="true" focusable="false">
      <rect x="7" y="3" width="14" height="18" rx="2.5" fill="#21a366" />
      <path d="M14 3h4.5A2.5 2.5 0 0 1 21 5.5V8h-7z" fill="#33c481" />
      <path d="M14 16h7v2.5a2.5 2.5 0 0 1-2.5 2.5H14z" fill="#185c37" />
      <rect x="2.5" y="6.5" width="11" height="11" rx="2" fill="#107c41" />
      <path d="M5.4 9.2h1.7L8 11l.9-1.8h1.7l-1.7 2.8 1.8 2.8H9l-1-1.9-1 1.9H5.3l1.8-2.8z" fill="#fff" />
    </svg>
  )
}

/** Bouton d'export Excel : désactivé pendant l'envoi, erreur affichée sur place. */
function XlsxButton({ label, text, t, run }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const click = async () => {
    setBusy(true); setErr(null)
    try { await run() } catch (e) { setErr(errText(t, e)) } finally { setBusy(false) }
  }
  return (
    <>
      <button type="button" className="sheet-btn ck-xlsx" onClick={click} disabled={busy} title={label}
        aria-label={busy ? t.downloading : label}>
        <SpreadsheetIcon />
        <span>{busy ? t.downloading : (text ?? t.export)}</span>
      </button>
      {err && <span className="ck-inline-err">{err}</span>}
    </>
  )
}

const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/**
 * Choix de la filiale : bouton (drapeau, nom, chevron) qui ouvre une liste avec recherche
 * au clavier (combobox ARIA : flèches, Entrée, Échap).
 */
function CountryCombo({ t, countries, value, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const boxRef = useRef(null)
  const inputRef = useRef(null)
  const listId = useId()
  const matches = useMemo(() => {
    const q = fold(query.trim())
    return q ? countries.filter(c => fold(c.label).includes(q) || fold(c.country).startsWith(q)) : countries
  }, [countries, query])
  const current = countries.find(c => c.country === value)

  useEffect(() => {
    if (!open) return undefined
    setQuery('')
    setActive(Math.max(0, countries.findIndex(c => c.country === value)))
    inputRef.current?.focus()
    const away = e => { if (!boxRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open, countries, value])
  useEffect(() => { setActive(0) }, [query])
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [open, active, listId])

  const pick = c => { onChange(c.country); setOpen(false) }
  const onKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, matches.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') { e.preventDefault(); if (matches[active]) pick(matches[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); setOpen(false) }
  }
  return (
    <div className="ck-combo" ref={boxRef}>
      <button type="button" className="ck-combo-btn" aria-haspopup="listbox" aria-expanded={open}
        aria-label={`${t.pick_country} : ${current?.label ?? ''}`} onClick={() => setOpen(o => !o)}>
        {current && <CountryName code={current.country} label={current.label} />}
        <svg className="ck-combo-chev" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="ck-combo-panel">
          <input ref={inputRef} type="text" className="ck-combo-input" role="combobox"
            aria-expanded="true" aria-controls={listId} aria-autocomplete="list"
            aria-activedescendant={matches[active] ? `${listId}-${active}` : undefined}
            placeholder={t.country_search} aria-label={t.country_search}
            value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKey} />
          <ul id={listId} role="listbox" className="ck-combo-list" aria-label={t.pick_country}>
            {matches.map((c, i) => (
              <li key={c.country} id={`${listId}-${i}`} role="option" aria-selected={c.country === value}
                className={`ck-combo-opt${i === active ? ' is-active' : ''}${c.country === value ? ' is-on' : ''}`}
                onMouseEnter={() => setActive(i)} onMouseDown={e => { e.preventDefault(); pick(c) }}>
                <CountryName code={c.country} label={c.label} />
                {c.country === value && (
                  <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" className="ck-combo-check">
                    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </li>
            ))}
            {matches.length === 0 && <li className="ck-combo-empty">{t.country_none}</li>}
          </ul>
        </div>
      )}
    </div>
  )
}

/** Filiale ouverte par défaut : le Cameroun (siège de l'Academy), sinon la première. */
const DEFAULT_COUNTRY = new Set(['CM', 'CMR', 'cm', 'cmr'])

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
  const rows = global.rows
  const needsMissing = global.needs_source === 'none' || (global.warnings || []).length > 0
  const hideNeeds = simple && needsMissing

  const columns = useMemo(() => {
    const brands = global.brands.filter(b => {
      const tot = global.brand_totals[b.code] || {}
      return (tot.seats || 0) > 0 || (tot.needs || 0) > 0 || (tot.technicians || 0) > 0
    })
    // Largeurs calées sur le libellé complet, flèche de tri comprise.
    const brandCols = brands.flatMap(b => {
      const sub = (field, header, width) => ({
        id: `b_${b.code}_${field}`, header, group: b.label, groupIcon: brandLogo(b), width, type: 'int',
        value: r => r.cells?.[b.code]?.[field] ?? null, total: 'sum', keepEmpty: field === 'technicians',
      })
      return [
        ...(hideNeeds ? [] : [sub('needs', t.col_needs, 96)]),
        sub('technicians', t.col_contractual, 124),
        sub('seats', t.col_allocated, 104),
      ]
    })
    // Même ordre que l'onglet « TOUS LES PAYS » du classeur : pays et techniciens, marques
    // (besoin, contractuel, attribué), totaux de places, part de la clé, puis l'argent en dernier.
    return [
      countryColumn(t),
      { id: 'enrolled', header: t.col_enrolled, type: 'text', width: 70, hidden: true,
        value: r => (r.enrolled ? t.yes : t.no) },
      { id: 'technicians', header: t.col_contractual, group: t.group_all_brands, type: 'int', total: 'sum',
        keepEmpty: true, width: 148, value: r => r.technicians },
      ...brandCols,
      ...[
        { id: 'needs', header: t.col_needs, type: 'int', total: 'sum', value: r => r.needs },
        { id: 'seats', header: t.col_seats, type: 'int', total: 'sum', value: r => r.seats },
        { id: 'coverage', header: t.col_coverage, type: 'percent', width: 128, bar: true,
          value: r => r.coverage, tone: v => coverageTone(v),
          total: rs => ratio(sumOf(rs, r => r.seats), sumOf(rs, r => r.needs)) },
        { id: 'share', header: t.col_share, type: 'percent', total: 'sum', value: r => r.share },
        { id: 'key_cost', header: t.col_key_cost, type: 'money', width: 130, total: 'sum', value: r => r.key_cost },
        { id: 'trainee_lodging', header: t.col_trainee_lodging, type: 'money', width: 180, total: 'sum',
          value: r => r.trainee_lodging },
        { id: 'trainer_lodging', header: t.col_trainer_lodging, type: 'money', width: 180, total: 'sum',
          value: r => r.trainer_lodging },
        { id: 'total', header: t.col_total, type: 'money', width: 140, total: 'sum', value: r => r.total },
      ].map(c => ({ ...c, group: t.group_totals })),
    ]
  }, [global, hideNeeds, t])

  const totalNeeds = sumOf(rows, r => r.needs)
  const totalSeats = sumOf(rows, r => r.seats)

  // Lecteur pressé : rien qui ne porte une valeur. Une colonne, un indicateur ou
  // un choix sans donnée disparaît au lieu d'afficher « — » ou un champ vide.
  // Exception (keepEmpty) : l'effectif contractuel, attendu même s'il n'est pas encore connu.
  const shownColumns = useMemo(() => (simple
    ? columns.filter(c => c.keepEmpty || c.id === 'country' || rows.some(r => c.value(r) != null && c.value(r) !== ''))
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

  return (
    <section className="ck-view" aria-labelledby="ck-view-title">
      <Kpis items={kpis} />
      {needsMissing && !simple && <Banner tone="warn">{t.needs_missing}</Banner>}
      <DataSheet
        id="ck-global" columns={shownColumns} rows={rows} rowKey={r => r.country} frozen={1} simple={simple}
        exportName={`cle-${ckey.year}-${ckey.pole}-${mode.toLowerCase()}`}
        onRowOpen={r => openCountry(r.country)} openHint={t.open_hint}
        // Besoins ou places : ce qui a été saisi. L'effectif contractuel est un référentiel, il ne compte pas.
        rowClass={r => ((r.needs || 0) > 0 || (r.seats || 0) > 0 ? 'is-filled' : '')}
        actions={global.partial ? null : (
          <>
            <XlsxButton t={t} label={t.xlsx_table} text={t.xlsx_table}
              run={() => planningApi.downloadGlobal(ckey, mode, serverLang(locale))} />
            <XlsxButton t={t} label={t.xlsx_all} text={t.xlsx_all}
              run={() => planningApi.downloadAll(ckey, mode, serverLang(locale))} />
          </>
        )}
      />
    </section>
  )
}

/* ─────────────────────────── Pays (fiche) ─────────────────────────── */

export function CountryView({ t, locale, fmt, ckey, mode, global, code, setCode, slots }) {
  const [state, setState] = useState({ loading: true })
  const countries = global.rows
  const current = code || (countries.find(c => DEFAULT_COUNTRY.has(c.country)) ?? countries[0])?.country

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

  const [filters, setFilters] = useState({ brand: '', month: '', location: '' })
  useEffect(() => { setFilters({ brand: '', month: '', location: '' }) }, [current])
  // Filtres locaux (sans appel serveur) : un bref squelette sur le corps du tableau signale
  // le changement, la barre de filtres reste en place (le focus ne saute pas).
  const filtering = useSettle([filters])

  const columns = useMemo(() => [
    { id: 'brand', header: t.col_brand, type: 'text', width: 110, value: s => s.brand },
    { id: 'code', header: t.col_code, type: 'text', width: 110, value: s => s.code },
    { id: 'title', header: t.col_title, type: 'text', width: 260, value: s => s.title },
    { id: 'start', header: t.col_start, type: 'date', width: 100, value: s => s.start_date },
    { id: 'end', header: t.col_end, type: 'date', width: 100, value: s => s.end_date },
    { id: 'trainers', header: t.col_trainers, type: 'text', width: 160,
      value: s => (Array.isArray(s.trainers) ? s.trainers.join(', ') : s.trainers) },
    { id: 'location', header: t.col_location, type: 'text', width: 120, value: s => s.location },
    { id: 'seats', header: t.col_seats, type: 'int', total: 'sum', value: s => s.seats },
    { id: 'trainee_lodging', header: t.col_trainee_lodging, type: 'money', width: 180, total: 'sum',
      value: s => s.trainee_lodging },
    { id: 'trainer_lodging', header: t.col_trainer_lodging, type: 'money', width: 180, total: 'sum',
      value: s => s.trainer_lodging },
  ], [t])

  const data = state.data
  const foot = data?.footer
  const sessions = useMemo(() => data?.sessions ?? [], [data])
  const options = useMemo(() => {
    const uniq = fn => [...new Set(sessions.map(fn).filter(Boolean))].sort()
    return { brand: uniq(s => s.brand), month: uniq(s => s.start_date?.slice(0, 7)), location: uniq(s => s.location) }
  }, [sessions])
  const shown = useMemo(() => sessions.filter(s =>
    (!filters.brand || s.brand === filters.brand)
    && (!filters.month || s.start_date?.slice(0, 7) === filters.month)
    && (!filters.location || s.location === filters.location)), [sessions, filters])
  const filtered = Boolean(filters.brand || filters.month || filters.location)
  const monthLabel = ym => {
    const [y, m] = ym.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  }
  // Filtre compact : le libellé est porté par l'option « tous » (Marque : toutes…).
  const filter = (k, label, fmtOpt = v => v) => (
    <label className={`ck-pill-select${filters[k] ? ' is-on' : ''}`} key={k}>
      <span className="ck-sr">{label}</span>
      <select value={filters[k]} onChange={e => setFilters(f => ({ ...f, [k]: e.target.value }))}>
        <option value="">{label} · {t.filter_all}</option>
        {options[k].map(v => <option key={v} value={v}>{fmtOpt(v)}</option>)}
      </select>
    </label>
  )
  // Une seule ligne : la filiale se choisit à droite du titre, l'export rejoint les outils
  // de l'en-tête (slots de la page) ; les filtres vivent dans la barre du tableau.
  const combo = <CountryCombo t={t} countries={countries} value={current} onChange={setCode} />
  const exportBtn = data && (
    <XlsxButton t={t} label={t.xlsx_country}
      run={() => planningApi.downloadCountry(ckey, current, mode, serverLang(locale))} />
  )
  const filterBar = sessions.length > 0 && (
    <>
      {filter('brand', t.filter_brand)}
      {filter('month', t.filter_month, monthLabel)}
      {filter('location', t.filter_location)}
    </>
  )
  // Pendant un chargement, le squelette REMPLACE l'ancien contenu (jamais les deux à la fois).
  const ready = !state.loading
  return (
    <section className="ck-view" aria-busy={state.loading || undefined}>
      {slots?.title ? createPortal(combo, slots.title) : combo}
      {ready && exportBtn && (slots?.tools ? createPortal(exportBtn, slots.tools) : exportBtn)}
      {state.loading && <SheetSkeleton label={t.loading} kpis />}
      {state.error && <Banner tone="warn">{errText(t, state.error)}</Banner>}
      {ready && foot && (
        // Ordre du classeur : coût clé, hébergements techniciens puis formateurs, total.
        <Kpis items={[
          { label: t.col_key_cost, value: fmt(foot.key_cost, 'money') },
          { label: t.col_trainee_lodging, value: fmt(foot.trainee_lodging, 'money') },
          { label: t.col_trainer_lodging, value: fmt(foot.trainer_lodging, 'money') },
          { label: t.col_total, value: fmt(foot.total, 'money') },
          { label: t.col_seats, value: fmt(foot.seats, 'int') },
          { label: t.col_share, value: fmt(foot.share, 'percent') },
          { label: t.col_coverage, value: foot.coverage == null ? '—' : fmt(foot.coverage, 'percent') },
        ]} />
      )}
      {ready && filtered && <Banner tone="info">{t.filter_note}</Banner>}
      {ready && data && (
        <div className={filtering ? 'ck-sheet-busy' : undefined} aria-busy={filtering || undefined}>
          <DataSheet id="ck-country" columns={columns} rows={shown} frozen={2}
            rowKey={(s, i) => `${s.code}-${s.start_date}-${i}`}
            exportName={`cle-${ckey.year}-${current}`} emptyText={t.no_sessions} actions={filterBar || null} />
        </div>
      )}
    </section>
  )
}

/* ─────────────────────────── ABC (Attribué / Besoin / Contractuel) ─────────────────────────── */

const ABC_BASES = ['a', 'b', 'c']

/**
 * Les trois bases de répartition du classeur : A = places attribuées, B = besoin
 * de la filiale, C = techniciens du contrat. Pour la base choisie : part et montant
 * par filiale, quantité par marque. « Réalisé » = l'ancien écran Prévu / Réalisé.
 */
export function AbcView({ t, fmt, scope, ckey }) {
  const [base, setBase] = useState('a')
  const settling = useSettle([base]) // bascule A / B / C locale : bref squelette
  const [state, setState] = useState({ loading: true })
  const all = scope.pole === 'ALL'

  useEffect(() => {
    let alive = true
    setState({ loading: true })
    const load = all ? planningApi.yearAbc(scope.year) : planningApi.abc(scope.id)
    load
      .then(data => alive && setState({ loading: false, data }))
      .catch(error => alive && setState({ loading: false, error }))
    return () => { alive = false }
  }, [all, scope.id, scope.year])
  // « Réalisé » n'existe que par clé : en « Tous pôles », on revient sur A.
  useEffect(() => { if (all && base === 'actual') setBase('a') }, [all, base])

  const data = state.data
  const columns = useMemo(() => {
    if (!data) return []
    const brands = data.brands.filter(b => data.rows.some(r => r.cells?.[b.code]?.[base]))
    return [
      countryColumn(t),
      ...ABC_BASES.map(x => ({
        id: x, header: t[`col_${x}`], type: 'int', total: 'sum', value: r => r[x],
      })),
      { id: 'a_b', header: t.col_a_b, type: 'percent', width: 90, value: r => r.a_b,
        total: rs => ratio(sumOf(rs, r => r.a), sumOf(rs, r => r.b)), tone: v => coverageTone(v) },
      { id: 'a_c', header: t.col_a_c, type: 'percent', width: 90, value: r => r.a_c,
        total: rs => ratio(sumOf(rs, r => r.a), sumOf(rs, r => r.c)), tone: v => coverageTone(v) },
      { id: 'share', header: t.col_share, group: t[`abc_${base}`], type: 'percent', total: 'sum',
        value: r => r[`share_${base}`] },
      { id: 'amount', header: t.col_amount, group: t[`abc_${base}`], type: 'money', width: 140,
        total: 'sum', value: r => r[`amount_${base}`] },
      ...brands.map(b => ({
        id: `b_${b.code}`, header: b.label, icon: brandLogo(b), group: t[`abc_${base}`], width: 104,
        type: 'int', total: 'sum', value: r => r.cells?.[b.code]?.[base] ?? null,
      })),
    ]
  }, [data, base, t])

  const options = [
    ...ABC_BASES.map(x => ({ value: x, label: t[`abc_${x}`] })),
    ...(all ? [] : [{ value: 'actual', label: t.abc_actual }]),
  ]
  const bar = (
    <div className="ck-viewbar">
      <span className="ck-viewbar-label">{t.abc_base}</span>
      <Segmented value={base} onChange={setBase} label={t.nav_abc} options={options} />
    </div>
  )
  if (settling) return <section className="ck-view">{bar}<SheetSkeleton label={t.loading} /></section>
  if (base === 'actual') return <section className="ck-view">{bar}<CompareView t={t} ckey={ckey} /></section>
  if (state.loading) return <section className="ck-view">{bar}<SheetSkeleton label={t.loading} /></section>
  if (state.error) return <Banner tone="warn">{errText(t, state.error)}</Banner>

  const needsMissing = data.needs_source === 'none' || (data.warnings || []).length > 0
  return (
    <section className="ck-view">
      <p className="ck-lead">{t.abc_lead}</p>
      <Kpis items={[
        { label: t.kpi_budget, value: data.budget ? fmt(data.budget, 'money') : '—' },
        ...ABC_BASES.map(x => ({ label: t[`abc_${x}`], value: fmt(data.totals[x], 'int') })),
      ]} />
      {needsMissing && <Banner tone="warn">{t.needs_missing}</Banner>}
      {bar}
      <DataSheet id="ck-abc" columns={columns} rows={data.rows} rowKey={r => r.country} frozen={1}
        exportName={`cle-${data.year}-${data.pole}-abc-${base}`} />
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
    countryColumn(t),
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

  if (state.loading) return <SheetSkeleton label={t.loading} />
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
        <Segmented value={tab} onChange={setTab} label={t.abc_actual} options={[
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

/* ─────────────────────────── Formations non choisies ─────────────────────────── */

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

  if (state.loading) return <SheetSkeleton label={t.loading} />
  if (state.error) return <Banner tone="warn">{errText(t, state.error)}</Banner>
  const { data } = state
  return (
    <section className="ck-view">
      <p className="ck-lead">{t.themes_lead}</p>
      {!data.available
        ? <Banner tone="warn">{t.themes_unavailable}</Banner>
        : <DataSheet id="ck-themes" columns={columns} rows={data.modules} frozen={1}
            rowKey={m => `${m.brand}-${m.code}`} emptyText={t.themes_none}
            exportName={`formations-non-choisies-${ckey.year}`} />}
    </section>
  )
}
