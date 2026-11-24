/**
 * Calendrier annuel de formation : la grille Excel « Plannings formateurs » relue telle
 * quelle, mêmes couleurs, même disposition (un bloc par mois, Marques · Formateurs · 1 à 31,
 * code de session sur une ligne, intitulé plus clair dessous) pour ne pas perdre ses habitués.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { getCopy } from '../../../i18n/index.js'
import { planningApi } from '../../../lib/planningApi'
import { resolveCardBrandBadge } from '../../../utils/cardBrandBadge'
import { Banner, BrandMark, CountryName, FilterBar, Kpis, SheetSkeleton, TrainerAvatar } from './costKeyViews'
import { FacetFilter, applyFacets, buildFacets, byOrder } from './FacetFilter'
import '../../../styles/training-calendar.css'

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)
const MONTHS = Array.from({ length: 12 }, (_, i) => i)
// Ordre de la légende de la grille Excel.
export const LEGEND = ['academy', 'subsidiary', 'support', 'trainers', 'client', 'leave', 'holiday']
const TAILS = { 'FORMATIONS REPORTEES': 'cal_postponed', 'FORMATIONS ANNULEES': 'cal_cancelled' }
const WIDE = new Set(['FORMATIONS CONSTRUCTEUR', ...Object.keys(TAILS)])

const fill = (texte, valeurs) =>
  Object.entries(valeurs).reduce((s, [k, v]) => s.replaceAll(`{${k}}`, v), texte ?? '')
const iso = (year, month, day) =>
  `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`

/** Marques écrites d'un bloc (« SUZUKI BYD OMODA & JAECOO ») : un logo par marque reconnue. */
export function brandParts(raw = '') {
  const words = raw.split(/\s+/).filter(Boolean)
  const parts = []
  const logo = (i, n) => resolveCardBrandBadge(words.slice(i, i + n).join(' ')).logo
  for (let i = 0; i < words.length;) {
    // Le résolveur retombe sur le premier mot : un nom à plusieurs mots ne compte que s'il a son propre logo.
    const len = [3, 2, 1].find(n => i + n <= words.length && logo(i, n) && (n === 1 || logo(i, n) !== logo(i, 1)))
    if (!len && words[i] === '&' && parts[parts.length - 1]?.brand) {
      i += 1
      continue
    }
    if (len) {
      parts.push({ brand: words.slice(i, i + len).join(' ') })
      i += len
    } else {
      const last = parts[parts.length - 1]
      if (last?.text) last.text += ` ${words[i]}`
      else parts.push({ text: words[i] })
      i += 1
    }
  }
  return parts
}

// Couleurs qui sont des formations (support, congés et fériés n'en sont pas).
const TRAINING = new Set(['academy', 'subsidiary', 'trainers', 'client'])
// Même règle que le planning (`trainer_load.MIN_GAP_DAYS`) : 2 semaines entre deux formations.
const MIN_GAP_DAYS = 14
const DAY_MS = 86_400_000
const toDate = value => new Date(`${value}T00:00:00Z`)
export const bandKey = b => `${b.line}|${b.start}|${b.text}`
// La grille ne donne souvent que le prénom : le planning renvoie le nom complet du référentiel.
export const trainerName = line => line?.trainer_name || line?.trainer || ''

function workingDays(start, end, holidays) {
  let n = 0
  for (let d = toDate(start); d <= toDate(end); d = new Date(d.getTime() + DAY_MS)) {
    const wd = d.getUTCDay()
    if (wd !== 0 && wd !== 6 && !holidays.has(d.toISOString().slice(0, 10))) n += 1
  }
  return n
}

/**
 * Vrai quand `start` suit `end` sans aucun jour ouvré entre les deux (week-end, fériés) :
 * c'est la même formation qui continue (une formation de deux semaines, par exemple).
 * Même règle que le planning (`trainer_load.back_to_back`).
 */
export function backToBack(end, start, holidays) {
  if (start <= end) return false
  const iso = ms => new Date(ms).toISOString().slice(0, 10)
  return workingDays(iso(toDate(end).getTime() + DAY_MS), iso(toDate(start).getTime() - DAY_MS), holidays) === 0
}

/**
 * Chiffres de la grille d'un pôle sur l'année : formations (hors reportées et annulées),
 * jours ouvrés hors fériés, lieu, formateurs à moins de 2 semaines entre deux formations
 * (les deux semaines se comptent après la fin d'une formation, semaines enchaînées comprises),
 * formateur le plus chargé et formateurs sans formation. Un formateur présent sur
 * plusieurs lignes (plusieurs marques) compte pour une personne.
 */
export function calendarKpis({ lines, bands, holidays }) {
  const off = new Set(holidays)
  const lineOf = new Map(lines.map(l => [l.key, l]))
  const byTrainer = new Map()
  lines.forEach(l => {
    if (l.trainer && !TAILS[l.section]) byTrainer.set(trainerName(l), { days: 0, bands: [] })
  })
  const where = { academy: 0, subsidiary: 0, other: 0 }
  let sessions = 0
  let days = 0
  bands.forEach(b => {
    const line = lineOf.get(b.line)
    if (!TRAINING.has(b.kind) || !line || TAILS[line.section]) return
    const n = workingDays(b.start, b.end, off)
    sessions += 1
    days += n
    where[b.kind in where ? b.kind : 'other'] += n
    const who = byTrainer.get(trainerName(line))
    if (who) {
      who.days += n
      who.bands.push(b)
    }
  })
  const closeBands = new Set()
  let closeTrainers = 0
  let busiest = null
  let idle = 0
  byTrainer.forEach((who, name) => {
    if (!who.bands.length) idle += 1
    if (who.days && (!busiest || who.days > busiest.days)) busiest = { name, days: who.days }
    const sorted = [...who.bands].sort((a, b) => a.start.localeCompare(b.start))
    let close = false
    let last = null // bande qui termine la formation en cours
    sorted.forEach(next => {
      if (last && !backToBack(last.end, next.start, off)
        && (toDate(next.start) - toDate(last.end)) / DAY_MS < MIN_GAP_DAYS) {
        closeBands.add(bandKey(last))
        closeBands.add(bandKey(next))
        close = true
      }
      if (!last || next.end >= last.end) last = next
    })
    if (close) closeTrainers += 1
  })
  return { sessions, days, where, closeTrainers, closeBands, busiest, idle }
}

/** Bandes d'une ligne sur un mois, réparties en couloirs quand deux se chevauchent. */
export function lanes(bands) {
  const out = []
  ;[...bands].sort((a, b) => a.from - b.from).forEach(band => {
    const lane = out.find(l => l[l.length - 1].to < band.from)
    if (lane) lane.push(band)
    else out.push([band])
  })
  return out.length ? out : [[]]
}

function useCalendar(year, pole) {
  const [state, setState] = useState({ loading: true })
  useEffect(() => {
    if (!year || !pole) return undefined
    let alive = true
    setState({ loading: true })
    planningApi.calendar(year, pole)
      .then(data => alive && setState({ loading: false, data }))
      .catch(error => alive && setState({ loading: false, error }))
    return () => { alive = false }
  }, [year, pole])
  return state
}

/** Libellé d'une ligne : marques + formateur, ou une seule case sur deux colonnes (bas de bloc). */
export function lineLabel(line, t) {
  if (TAILS[line.section]) return { wide: true, tail: true, text: t[TAILS[line.section]] }
  if (WIDE.has(line.section) && !line.trainer) return { wide: true, text: line.brands }
  return { brands: line.brands, trainer: trainerName(line) || (!line.section ? t.cal_line_manufacturer : '') }
}

function Brands({ raw }) {
  return (
    <span className="tc-brands">
      {brandParts(raw).map((p, i) => (p.brand
        ? <span key={i} className="tc-brand"><BrandMark brand={p.brand} /></span>
        : <span key={i}>{p.text}</span>))}
    </span>
  )
}

/** Une rangée de jours : bandes fusionnées sur leurs jours, cases vides colorées sinon. */
function DayRow({ lane, dayClass, part, t, fmtDay, closeBands }) {
  const cells = []
  for (let d = 1; d <= 31;) {
    const band = lane.find(b => b.from === d)
    if (band) {
      const span = band.to - band.from + 1
      const text = part === 'code' ? band.text : band.title
      const close = closeBands.has(bandKey(band))
      const tip = [band.text, band.title, fill(t.cal_band_dates, { start: fmtDay(band.start), end: fmtDay(band.end) }),
        close && t.cal_kpi_close_note].filter(Boolean).join('\n')
      cells.push(
        <td key={d} colSpan={span} title={tip}
          className={`tc-band tc-${band.kind}${part === 'title' ? ' is-title' : ''}${close ? ' is-close' : ''}`}>
          {text}
        </td>,
      )
      d += span
    } else {
      cells.push(<td key={d} className={dayClass(d)} />)
      d += 1
    }
  }
  return cells
}

/** Lignes d'un mois : toutes sans filtre (comme l'Excel), seulement celles qui ont une bande sinon. */
export function monthRows(lines, bandsByLine, month, filtered) {
  return lines.map(line => {
    const mine = (bandsByLine.get(line.key) ?? []).filter(b => b.month === month)
    return { line, mine }
  }).filter(r => !filtered || r.mine.length).map(r => ({ line: r.line, lanes: lanes(r.mine) }))
}

function MonthBlock({ year, month, rows, holidays, t, locale, fmtDay, today, closeBands }) {
  const last = new Date(year, month + 1, 0).getDate()
  const dayClass = d => {
    if (d > last) return 'tc-day is-out'
    if (holidays.has(iso(year, month, d))) return 'tc-day is-holiday'
    const wd = new Date(year, month, d).getDay()
    return wd === 0 || wd === 6 ? 'tc-day is-weekend' : 'tc-day'
  }
  const total = rows.reduce((n, r) => n + r.lanes.length * 2, 0)
  const name = new Date(year, month, 1).toLocaleDateString(locale, { month: 'long' })
  const out = []
  rows.forEach(({ line, lanes: ls }, li) => {
    const label = lineLabel(line, t)
    ls.forEach((lane, k) => {
      ['code', 'title'].forEach(part => {
        const first = k === 0 && part === 'code'
        out.push(
          <tr key={`${line.key}-${k}-${part}`} className={`tc-row is-${part}${first && li ? ' is-line-start' : ''}`}>
            {li === 0 && first && (
              <th scope="rowgroup" rowSpan={total} className="tc-month" id={`tc-m-${month}`}>
                <span>{name.toUpperCase()}</span>
              </th>
            )}
            {first && (label.wide
              ? (
                <th scope="row" colSpan={2} rowSpan={ls.length * 2} className={`tc-label is-wide${label.tail ? ' is-tail' : ''}`}>
                  {label.text}
                </th>
              )
              : (
                <>
                  <th scope="row" rowSpan={ls.length * 2} className="tc-label tc-brands-cell"><Brands raw={label.brands} /></th>
                  <th scope="row" rowSpan={ls.length * 2} className="tc-label tc-trainer-cell">
                    {line.trainer && <TrainerAvatar name={trainerName(line)} />}
                    <span>{label.trainer}</span>
                  </th>
                </>
              ))}
            <DayRow lane={lane} part={part} t={t} fmtDay={fmtDay} closeBands={closeBands}
              dayClass={d => `${dayClass(d)}${today === iso(year, month, d) ? ' is-today' : ''}`} />
          </tr>,
        )
      })
    })
  })
  return <tbody className="tc-month-block">{out}</tbody>
}

const NO_FILTERS = {}
const KINDS = LEGEND.filter(k => k !== 'holiday')

/**
 * Filtres du calendrier, dans l'ordre du Devis : filiale, marque, formateur, type, puis mois.
 * Ils portent sur les bandes ; une bande sans filiale lue (Douala, congés) sort dès qu'on en choisit une.
 */
export function calendarFacetDefs({ t, locale, year, lines, bands }) {
  const lineOf = new Map(lines.map(l => [l.key, l]))
  const labels = new Map(bands.filter(b => b.country).map(b => [b.country, b.country_label]))
  const months = Array.from({ length: 12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`)
  const monthText = month => ym => new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)) - 1, 1)
    .toLocaleDateString(locale, { month })
  return [
    { id: 'country', label: t.filter_country, get: b => b.country,
      text: v => labels.get(v) ?? v, render: v => <CountryName code={v} label={labels.get(v) ?? v} /> },
    { id: 'brand', label: t.filter_brand, render: v => <BrandMark brand={v} />,
      get: b => (b.brand ? [b.brand] : brandParts(lineOf.get(b.line)?.brands).filter(p => p.brand).map(p => p.brand)) },
    { id: 'trainer', label: t.cal_filter_trainer, get: b => trainerName(lineOf.get(b.line)) || null,
      render: v => <span className="tc-filter-trainer"><TrainerAvatar name={v} />{v}</span> },
    { id: 'kind', label: t.cal_filter_kind, get: b => b.kind, values: KINDS, compare: byOrder(KINDS),
      text: v => t[`cal_kind_${v}`] ?? v,
      render: v => <span className="tc-filter-kind"><span className={`tc-swatch tc-${v}`} aria-hidden="true" />{t[`cal_kind_${v}`] ?? v}</span> },
    { id: 'month', label: t.filter_month, get: b => b.start.slice(0, 7), layout: 'months', year: Number(year),
      text: monthText('long'), short: monthText('short'), values: months,
      compare: (x, y) => x.value.localeCompare(y.value) },
  ]
}

export default function CalendarView({ t, locale, year, pole, slots }) {
  const state = useCalendar(year, pole)
  const scroller = useRef(null)
  const [filters, setFilters] = useState(NO_FILTERS)
  const [filtersHost, setFiltersHost] = useState(null)
  useEffect(() => { setFilters(NO_FILTERS) }, [year, pole])
  const fmtDay = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long' })
    return value => f.format(new Date(`${value}T00:00:00`))
  }, [locale])
  const now = new Date()
  const today = iso(now.getFullYear(), now.getMonth(), now.getDate())

  const base = useMemo(() => {
    const data = state.data
    if (!data || data.empty) return null
    const bands = data.bands.map(b => ({
      ...b, month: Number(b.start.slice(5, 7)) - 1, from: Number(b.start.slice(8, 10)), to: Number(b.end.slice(8, 10)),
    }))
    return { lines: data.lines, bands, holidays: data.holidays }
  }, [state.data])
  const defs = useMemo(() => base && calendarFacetDefs({ t, locale, year, lines: base.lines, bands: base.bands }),
    [base, t, locale, year])

  // KPI et grille suivent les mêmes filtres.
  const model = useMemo(() => {
    if (!base) return null
    const filtered = Object.values(filters).some(list => list.length > 0)
    const bands = applyFacets(base.bands, defs, filters)
    const byLine = new Map()
    bands.forEach(b => {
      if (!byLine.has(b.line)) byLine.set(b.line, [])
      byLine.get(b.line).push(b)
    })
    // « Sans formation » ne parle que des formateurs choisis ; par filiale ou marque, il ne veut rien dire.
    const picked = filters.trainer?.length ? new Set(filters.trainer) : null
    const kpiLines = picked ? base.lines.filter(l => picked.has(trainerName(l))) : base.lines
    const kpis = calendarKpis({ lines: kpiLines, bands, holidays: base.holidays })
    if (filters.country?.length || filters.brand?.length) kpis.idle = 0
    return {
      lines: base.lines, byLine, filtered, holidays: new Set(base.holidays), kpis,
      facets: buildFacets(base.bands, defs, filters),
    }
  }, [base, defs, filters])

  // L'année en cours s'ouvre sur le mois en cours, comme on reprend la feuille Excel.
  useEffect(() => {
    if (!base || Number(year) !== now.getFullYear()) return
    goTo(now.getMonth(), 'auto')
  }, [base]) // eslint-disable-line react-hooks/exhaustive-deps

  function goTo(month, behavior = 'smooth') {
    const box = scroller.current
    const target = box?.querySelector(`#tc-m-${month}`)
    const head = box?.querySelector('thead')
    if (box && target) box.scrollTo({ top: target.offsetTop - (head?.offsetHeight ?? 0), behavior })
  }

  if (state.loading) return <SheetSkeleton label={t.loading} />
  if (state.error) return <Banner tone="warn">{state.error.status === 403 ? t.cal_no_access : t.error}</Banner>
  if (!model) return <Banner tone="info">{fill(t.cal_empty, { year, pole: t[`pole_${pole}`] || pole })}</Banner>

  const k = model.kpis
  const num = new Intl.NumberFormat(locale).format
  const blocks = MONTHS.map(m => ({ m, rows: monthRows(model.lines, model.byLine, m, model.filtered) }))
    .filter(b => b.rows.length)
  return (
    <section className="tc" aria-labelledby="tc-title">
      <FilterBar hostRef={setFiltersHost} slots={slots} />
      {filtersHost && createPortal(
        <div className="sheet-toolbar" role="toolbar" aria-label={getCopy('sheet', locale).filters}>
          {model.facets.map(f => (
            <FacetFilter key={f.id} t={t} facet={f} selected={filters[f.id] ?? []}
              onChange={list => setFilters(cur => ({ ...cur, [f.id]: list }))} />
          ))}
        </div>, filtersHost)}
      <Kpis large items={[
        { label: t.cal_kpi_sessions, value: num(k.sessions), note: fill(t.cal_kpi_sessions_note, { days: num(k.days) }) },
        {
          label: t.cal_kpi_where, value: num(k.days),
          split: ['academy', 'subsidiary', 'other'].map(key => ({
            key, tone: `cal-${key}`, label: t[`cal_where_${key}`], value: num(k.where[key]),
          })),
          splitNote: t.cal_where_note,
        },
        { label: t.cal_kpi_close, value: num(k.closeTrainers), note: t.cal_kpi_close_note },
        {
          label: t.cal_kpi_busiest, value: k.busiest?.name ?? '—',
          note: [k.busiest && fill(t.cal_kpi_busiest_note, { days: num(k.busiest.days) }),
            k.idle ? fill(t.cal_kpi_idle, { n: num(k.idle) }) : null].filter(Boolean).join(' · '),
        },
      ]} />
      <div className="tc-bar">
        <ul className="tc-legend" aria-label={t.cal_legend}>
          {LEGEND.map(kind => (
            <li key={kind}><span className={`tc-swatch tc-${kind}`} aria-hidden="true" />{t[`cal_kind_${kind}`]}</li>
          ))}
        </ul>
      </div>
      <div className="tc-scroll" ref={scroller}>
        <table className="tc-grid">
          <caption id="tc-title" className="tc-caption">
            <span className="tc-caption-service">{fill(t.cal_service, { pole: (t[`pole_${pole}`] || pole).toUpperCase(), year })}</span>
            <span className="tc-caption-sub">{t.cal_subtitle}</span>
          </caption>
          <thead>
            <tr>
              <th scope="col" className="tc-h tc-h-month">{t.cal_month}</th>
              <th scope="col" className="tc-h tc-h-brands">{t.cal_brands}</th>
              <th scope="col" className="tc-h tc-h-trainer">{t.cal_trainers}</th>
              {DAYS.map(d => <th key={d} scope="col" className="tc-h tc-h-day">{d}</th>)}
            </tr>
          </thead>
          {blocks.map(({ m, rows }) => (
            <MonthBlock key={m} year={Number(year)} month={m} rows={rows}
              holidays={model.holidays} t={t} locale={locale} fmtDay={fmtDay} today={today} closeBands={k.closeBands} />
          ))}
        </table>
        {!blocks.length && <Banner tone="info">{t.cal_filter_empty}</Banner>}
      </div>
    </section>
  )
}
