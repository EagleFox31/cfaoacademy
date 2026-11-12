/**
 * Vues du module « Clé de répartition ». Chaque vue = un tableau type tableur
 * (DataSheet) + le strict nécessaire autour : chiffres clés, bandeau, boutons Excel.
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, Chevron, FacetFilter, NO_VALUE, applyFacets, buildFacets, byOrder, fold } from './FacetFilter'
import { useSettle } from '../../../components/sheet/useSettle'
import DataSheet from '../../../components/sheet/DataSheet'
import { coverageTone } from '../../../components/sheet/sheetMath'
import { planningApi } from '../../../lib/planningApi'
import { flagUrlForIso } from '../../../utils/countryFlag'
import { resolveCardBrandBadge } from '../../../utils/cardBrandBadge'
import { splitTrainers, trainerInitials, trainerPhoto } from '../../../utils/trainerPhoto'

const brandLogo = b => resolveCardBrandBadge(b.label || b.code).logo
  || resolveCardBrandBadge(b.code).logo || undefined

function BrandMark({ brand }) {
  const [casse, setCasse] = useState(false)
  const logo = resolveCardBrandBadge(brand).logo
  if (!logo || casse) return brand
  // Image Stellantis : grandes marges blanches, recadrée pour rester lisible.
  const cls = brand.toUpperCase() === 'STELLANTIS' ? 'sheet-c-logo is-padded' : 'sheet-c-logo'
  return <img className={cls} src={logo} alt={brand} onError={() => setCasse(true)} />
}

function TrainerAvatar({ name }) {
  const [casse, setCasse] = useState(false)
  const photo = trainerPhoto(name)
  if (!photo || casse) return <span className="sheet-c-avatar is-initials" aria-hidden="true">{trainerInitials(name)}</span>
  return <img className="sheet-c-avatar" src={photo} alt="" loading="lazy" onError={() => setCasse(true)} />
}

/** Photo de la page Équipe devant le nom ; le nom reste le texte filtré et exporté. */
function TrainerNames({ value }) {
  const names = splitTrainers(value)
  if (!names.length) return value
  return (
    <span className="sheet-c-trainers">
      <span className="sheet-c-avatars">{names.map(name => <TrainerAvatar key={name} name={name} />)}</span>
      <span className="sheet-c-trainer-names">{value}</span>
    </span>
  )
}

/** Filiale : drapeau local (aucun CDN) puis libellé ; sans drapeau, le code pays. */
function CountryName({ code, label, children }) {
  const [broken, setBroken] = useState(false)
  const flag = broken ? null : flagUrlForIso(code)
  return (
    <span className="ck-country">
      {flag
        ? <img className="ck-flag" src={flag} alt="" aria-hidden="true" onError={() => setBroken(true)} />
        : <span className="ck-flag-code" aria-hidden="true">{String(code || '').toUpperCase()}</span>}
      <span className="ck-country-label">{label}</span>
      {children}
    </span>
  )
}

/** mark(ligne) : contenu facultatif affiché après le nom de la filiale. */
const countryColumn = (t, mark) => ({
  id: 'country', header: t.col_country, type: 'text', width: 190, openOnClick: true, value: r => r.label,
  render: (v, r) => <CountryName code={r.country} label={v}>{mark?.(r)}</CountryName>,
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

const NEEDS_STALE = 'needs_snapshot_stale'

/** Besoins absents (couverture vide), ou présents mais lus dans la copie datée de planning. */
export function needsStatus(data) {
  const warnings = data.warnings || []
  const stale = warnings.find(w => w.code === NEEDS_STALE)
  return {
    missing: data.needs_source === 'none' || warnings.some(w => w.code !== NEEDS_STALE),
    staleAt: stale ? stale.value : null,
  }
}

function NeedsStaleBanner({ t, locale, at }) {
  if (!at) return null
  const date = new Date(at).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' })
  return <Banner>{t.needs_stale.replace('{date}', date)}</Banner>
}

/** Phrase d'une incohérence encore ouverte, avec la personne chargée de la traiter ; null si le type est inconnu. */
export function reviewText(t, locale, i) {
  const template = t[`review_${i.issue}`]
  if (!template) return null
  const day = d => new Date(`${d}T12:00:00`).toLocaleDateString(locale)
  return template.replace('{assignee}', i.assignee).replace('{code}', i.code).replace('{country}', i.country_label)
    .replace('{seats}', i.seats).replace('{end}', day(i.end_date)).replace('{start}', day(i.start_date))
}

const groupReviews = (items, keyOf) => {
  const groups = new Map()
  ;(items || []).forEach(i => groups.set(keyOf(i), [...(groups.get(keyOf(i)) || []), i]))
  return groups
}

/** Marqueur d'incohérence sur une ligne ; avec onOpen, il mène à la première session concernée. */
function ReviewMark({ t, locale, items, onOpen }) {
  const texts = (items || []).map(i => reviewText(t, locale, i)).filter(Boolean)
  if (!texts.length) return null
  const title = texts.join('\n')
  const content = (
    <>
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 3 2 21h20L12 3Z" /><path d="M12 10v5" /><path d="M12 18h.01" />
      </svg>
      {texts.length > 1 && <span aria-hidden="true">{texts.length}</span>}
    </>
  )
  const label = `${t.review_mark.replace('{n}', texts.length)}. ${title}`
  return onOpen
    ? (
      <button type="button" className="ck-review-mark" title={title} aria-label={label}
        onClick={e => { e.stopPropagation(); onOpen(items[0]) }}>
        {content}
      </button>
    )
    : <span className="ck-review-mark" title={title} role="img" aria-label={label}>{content}</span>
}

/** Montant d'une carte KPI, toujours avec sa devise. */
function kpiMoney(value, fmt, t) {
  const text = fmt(value, 'money')
  return text ? <>{text} <small className="ck-kpi-unit">{t.currency}</small></> : '—'
}

/** Où vont les places : le détail de l'indicateur porte les couleurs des cellules et sert de légende. */
const PLACE_KEYS = ['in_subsidiary', 'at_academy', 'postponed']
/** Types de formation toujours proposés dans le filtre Type ; E-learning n'apparaît que s'il existe. */
const DELIVERY_MODES = ['PRESENTIEL', 'DISTANCIEL']
const DELIVERY_ICONS = {
  // Deux personnes : en salle, ensemble.
  PRESENTIEL: <><circle cx="6" cy="5.5" r="2.2" /><circle cx="11" cy="6.5" r="1.8" /><path d="M2 13c0-2.2 1.8-3.8 4-3.8s4 1.6 4 3.8M9.5 10.2c.5-.3 1-.4 1.5-.4 1.7 0 3 1.3 3 3.2" /></>,
  // Écran : à distance, en direct.
  DISTANCIEL: <><rect x="2" y="2.5" width="12" height="8.5" rx="1.2" /><path d="M5.5 14h5M8 11v3" /></>,
  // Écran et lecture : contenu à suivre seul.
  ELEARNING: <><rect x="2" y="2.5" width="12" height="8.5" rx="1.2" /><path d="M6.8 4.9v3.7l3-1.85z" /><path d="M5.5 14h5M8 11v3" /></>,
}
const DeliveryMark = ({ t, mode }) => (
  <span className="ck-delivery">
    {DELIVERY_ICONS[mode] && (
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" fill="none" stroke="currentColor"
        strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">{DELIVERY_ICONS[mode]}</svg>
    )}
    {t[`delivery_${mode}`] ?? mode}
  </span>
)
const JOBS = ['TECHNICIAN', 'SAV', 'BODY', 'PARTS', 'DRIVER', NO_VALUE]
const NO_FILTERS = {}
const placeTone = key => `place-${key}`
const seatSplit = (t, fmt, counts) => ({
  split: PLACE_KEYS.map(key => ({ key, label: t[`col_${key}`], value: fmt(counts[key] ?? 0, 'int') })),
  splitNote: counts.postponed ? t.kpi_postponed_note : null,
})

// Recherche et filtres décident de ce que comptent les indicateurs : ils se placent juste
// au-dessus d'eux. Les outils propres au tableau (colonnes, copie, CSV) restent sur le tableau.
function FilterBar({ hostRef, note, slots }) {
  const bar = inline => (
    <div className={`sheet ck-filterbar${inline ? ' is-inline' : ''}`}>
      <div className="ck-filterbar-host" ref={hostRef} />
      <p className="ck-filterbar-note" role="status">{note || null}</p>
    </div>
  )
  // La page offre une place sur la ligne du titre : filtres et chiffres qu'ils changent restent liés.
  return slots?.filters ? createPortal(bar(true), slots.filters) : bar(false)
}

function Kpis({ items, large = false, paired = false }) {
  return (
    <dl className={`ck-kpis${large ? ' ck-kpis--large' : ''}${paired ? ' ck-kpis--paired' : ''}`}>
      {items.map(k => (
        <div className={`ck-kpi${k.split ? ' ck-kpi--split' : ''}`} key={k.label}>
          <dt>{k.label}</dt>
          <dd>{k.value}</dd>
          {k.note && <dd className="ck-kpi-note">{k.note}</dd>}
          {k.split && (
            <dd className="ck-kpi-split">
              <ul>
                {k.split.map(p => <li className={`ck-split--${p.tone ?? p.key}`} key={p.key}><span>{p.label}</span><b>{p.value}</b></li>)}
              </ul>
              {k.splitNote && <small>{k.splitNote}</small>}
            </dd>
          )}
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

/** Téléchargement d'un export : bouton désactivé pendant l'envoi, erreur affichée sur place. */
function useXlsxDownload(t) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const start = async run => {
    setBusy(true); setErr(null)
    try { await run() } catch (e) { setErr(errText(t, e)) } finally { setBusy(false) }
  }
  return { busy, err, start }
}

/** L'export se range dans l'en-tête de la page, à côté du titre : le tableau n'a plus de barre à lui. */
const inHeader = (slots, node) => (node && slots?.tools ? createPortal(node, slots.tools) : node)

/** Le CSV reprend ce que le tableau affiche : c'est le tableau qui le produit, via exportRef. */
const csvItem = (t, ref) => ({ label: t.export_csv, hint: t.export_csv_hint, run: () => ref.current?.() })

/** Un seul bouton « Exporter » qui ouvre la liste des formats proposés (menu ARIA : flèches, Échap). */
function ExportMenu({ t, items }) {
  const { busy, err, start } = useXlsxDownload(t)
  const [open, setOpen] = useState(false)
  const boxRef = useRef(null)
  const btnRef = useRef(null)

  useEffect(() => {
    if (!open) return undefined
    boxRef.current?.querySelector('[role=menuitem]')?.focus()
    const away = e => { if (!boxRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open])

  const close = () => { setOpen(false); btnRef.current?.focus() }
  const pick = run => { close(); start(run) }
  const onKey = e => {
    const entries = [...boxRef.current.querySelectorAll('[role=menuitem]')]
    const at = entries.indexOf(document.activeElement)
    if (e.key === 'ArrowDown') { e.preventDefault(); entries[(at + 1) % entries.length].focus() }
    else if (e.key === 'ArrowUp') { e.preventDefault(); entries[(at - 1 + entries.length) % entries.length].focus() }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'Tab') setOpen(false)
  }
  return (
    <>
      <div className="ck-combo" ref={boxRef}>
        <button type="button" ref={btnRef} className="sheet-btn ck-xlsx" aria-haspopup="menu" aria-expanded={open}
          disabled={busy} aria-label={busy ? t.downloading : t.xlsx_menu_aria} title={t.xlsx_menu_aria}
          onClick={() => setOpen(o => !o)}>
          <SpreadsheetIcon />
          <span>{busy ? t.downloading : t.export}</span>
          <svg className="ck-combo-chev" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
            <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        {open && (
          <div className="ck-combo-panel ck-xlsx-panel" role="menu" aria-label={t.xlsx_menu_aria} onKeyDown={onKey}>
            {items.map(i => (
              <button key={i.label} type="button" role="menuitem" className="ck-xlsx-item" onClick={() => pick(i.run)}>
                <strong>{i.label}</strong>
                <small>{i.hint}</small>
              </button>
            ))}
          </div>
        )}
      </div>
      {err && <span className="ck-inline-err">{err}</span>}
    </>
  )
}

/**
 * Choix des filiales (combobox avec recherche). Un clic sur un nom ouvre cette filiale seule,
 * modifiable ; sa case (ou Maj+Entrée) en ajoute d'autres, lues ensemble en vue consolidée.
 */
function CountryCombo({ t, countries, selected, onChange }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const boxRef = useRef(null)
  const btnRef = useRef(null)
  const inputRef = useRef(null)
  const listId = useId()
  const matches = useMemo(() => {
    const q = fold(query.trim())
    return q ? countries.filter(c => fold(c.label).includes(q) || fold(c.country).startsWith(q)) : countries
  }, [countries, query])
  const all = countries.find(c => c.country === ALL_COUNTRIES)
  const isOn = c => (c === all ? selected.length === 0 : selected.includes(c.country))

  useEffect(() => {
    if (!open) return undefined
    setQuery('')
    setActive(Math.max(0, countries.findIndex(isOn)))
    inputRef.current?.focus()
    const away = e => { if (!boxRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])
  useEffect(() => { setActive(0) }, [query])
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [open, active, listId])

  const only = c => { onChange(c === all ? [] : [c.country]); setOpen(false); btnRef.current?.focus() }
  const toggle = c => {
    if (!all || c === all) { only(c); return }
    onChange(selected.includes(c.country) ? selected.filter(v => v !== c.country) : [...selected, c.country])
  }
  const onKey = e => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => Math.min(i + 1, matches.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => Math.max(i - 1, 0)) }
    else if (e.key === 'Enter') {
      e.preventDefault()
      if (matches[active]) (e.shiftKey || e.ctrlKey || e.metaKey ? toggle : only)(matches[active])
    } else if (e.key === 'Escape') { e.preventDefault(); setOpen(false); btnRef.current?.focus() }
  }
  const current = selected.length > 1
    ? { country: ALL_COUNTRIES, label: t.countries_n.replace('{n}', selected.length) }
    : (selected.length === 1 ? countries.find(c => c.country === selected[0]) : all)
  return (
    <div className="ck-combo" ref={boxRef}>
      <button type="button" ref={btnRef} className="ck-combo-btn" aria-haspopup="listbox" aria-expanded={open}
        aria-label={`${t.pick_country} : ${current?.label ?? ''}`} onClick={() => setOpen(o => !o)}>
        {current && <CountryName code={current.country} label={current.label} />}
        <Chevron />
      </button>
      {open && (
        <div className="ck-combo-panel">
          <input ref={inputRef} type="text" className="ck-combo-input" role="combobox"
            aria-expanded="true" aria-controls={listId} aria-autocomplete="list"
            aria-activedescendant={matches[active] ? `${listId}-${active}` : undefined}
            placeholder={t.country_search} aria-label={t.country_search}
            value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onKey} />
          <ul id={listId} role="listbox" className="ck-combo-list" aria-label={t.pick_country}
            aria-multiselectable={Boolean(all)}>
            {matches.map((c, i) => (
              <li key={c.country} id={`${listId}-${i}`} role="option" aria-selected={isOn(c)}
                className={`ck-combo-opt${i === active ? ' is-active' : ''}${isOn(c) ? ' is-on' : ''}`}
                onMouseEnter={() => setActive(i)}
                onMouseDown={e => { e.preventDefault(); (e.target.closest('.ck-country-add') ? toggle : only)(c) }}>
                <span className="ck-facet-main">
                  {all && (c === all
                    ? <span className="ck-facet-box is-ghost" aria-hidden="true" />
                    : (
                      <span className="ck-country-add" title={t.country_add}>
                        <span className="ck-facet-box" aria-hidden="true">{isOn(c) && <Check />}</span>
                      </span>
                    ))}
                  <CountryName code={c.country} label={c.label} />
                </span>
                {c === all && isOn(c) && <Check className="ck-combo-check" />}
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

export function TableView({ t, locale, fmt, ckey, mode, global, openCountry, simple = false, canReview = false, slots }) {
  const rows = global.rows
  const [sheetRows, setSheetRows] = useState(null)
  const [filtersHost, setFiltersHost] = useState(null)
  const csvRef = useRef(null)
  const visible = sheetRows ?? rows
  const { missing: needsMissing, staleAt } = needsStatus(global)
  const hideNeeds = simple && needsMissing
  const reviews = useMemo(() => groupReviews(global.review_items, i => i.country), [global.review_items])

  const columns = useMemo(() => {
    const brands = global.brands.filter(b => {
      const tot = global.brand_totals[b.code] || {}
      return (tot.seats || 0) > 0 || (tot.needs || 0) > 0 || (tot.technicians || 0) > 0
    })
    // Largeurs calées sur le libellé complet, flèche de tri comprise.
    const brandCols = brands.flatMap(b => {
      const sub = (field, header, width) => ({
        id: `b_${b.code}_${field}`, header, group: b.label, groupIcon: brandLogo(b), width, type: 'int',
        value: r => r.cells?.[b.code]?.[field] ?? null, total: 'sum', keepEmpty: field !== 'seats',
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
      countryColumn(t, r => (
        <ReviewMark t={t} locale={locale} items={reviews.get(r.country)} onOpen={i => openCountry(i.country, i.code)} />
      )),
      { id: 'enrolled', header: t.col_enrolled, type: 'text', width: 70, hidden: true,
        value: r => (r.enrolled ? t.yes : t.no) },
      { id: 'technicians', header: t.col_contractual, group: t.group_all_brands, type: 'int', total: 'sum',
        keepEmpty: true, width: 148, value: r => r.technicians },
      ...brandCols,
      ...[
        { id: 'needs', header: t.col_needs, type: 'int', total: 'sum', value: r => r.needs },
        { id: 'seats', header: t.col_allocated, type: 'int', total: 'sum', value: r => r.seats },
        ...PLACE_KEYS.map(k => ({
          id: k, header: t[`col_${k}`], type: 'int', total: 'sum', width: 136, value: r => r[k],
          tone: v => (v > 0 ? placeTone(k) : null),
        })),
        { id: 'coverage', header: t.col_coverage, type: 'percent', width: 220, bar: true,
          value: r => r.coverage, tone: v => coverageTone(v),
          total: rs => ratio(sumOf(rs, r => r.seats), sumOf(rs, r => r.needs)) },
        { id: 'share', header: t.col_share, type: 'percent', width: 210, bar: true, total: 'sum', value: r => r.share },
        { id: 'key_cost', header: t.col_key_cost, type: 'money', unit: t.currency, width: 296, total: 'sum', value: r => r.key_cost },
      ].map(c => ({ ...c, group: t.group_totals })),
    ]
  // eslint-disable-next-line react-hooks/exhaustive-deps -- openCountry change à chaque rendu de la page
  }, [global, hideNeeds, t, locale, reviews])

  const totalNeeds = sumOf(visible, r => r.needs)
  const totalSeats = sumOf(visible, r => r.seats)

  // Lecteur pressé : rien qui ne porte une valeur. Une colonne, un indicateur ou
  // un choix sans donnée disparaît au lieu d'afficher « — » ou un champ vide.
  // Exception (keepEmpty) : l'effectif contractuel, attendu même s'il n'est pas encore connu.
  const shownColumns = useMemo(() => (simple
    ? columns.filter(c => c.keepEmpty || c.id === 'country' || rows.some(r => c.value(r) != null && c.value(r) !== ''))
    : columns), [simple, columns, rows])
  const split = seatSplit(t, fmt, Object.fromEntries(PLACE_KEYS.map(k => [k, sumOf(visible, r => r[k])])))
  const toBill = sumOf(visible, r => r.total)
  const lodging = sumOf(visible, r => r.trainee_lodging) + sumOf(visible, r => r.trainer_lodging)
  // Besoins absents ou partiels : on ne peut pas dire qu'une filiale n'a pas répondu.
  const responses = needsMissing ? [] : (global.responses || [])
  const answeredOf = r => `${fmt(r.answered.length, 'int')} / ${fmt(r.known.length, 'int')}`
  const kpis = [
    ...(canReview ? [{ label: t.kpi_review, value: fmt((global.review_items || []).length, 'int') }] : []),
    { label: t.kpi_responses,
      value: responses.length > 1
        ? (
          <span className="ck-kpi-poles">
            {responses.map(r => (
              <span key={r.pole}>
                <small>{t[`pole_${r.pole}`]}</small>
                <span className="ck-kpi-pole-bar" aria-hidden="true">
                  <i style={{ width: `${r.known.length ? (r.answered.length / r.known.length) * 100 : 0}%` }} />
                </span>
                <span className="ck-kpi-pole-n">{answeredOf(r)}</span>
              </span>
            ))}
          </span>
        )
        : responses[0] && answeredOf(responses[0]) },
    totalNeeds
      ? { label: t.kpi_seats_needs, value: `${fmt(totalSeats, 'int')} / ${fmt(totalNeeds, 'int')}`,
        note: t.kpi_rate_note.replace('{rate}', fmt(ratio(totalSeats, totalNeeds), 'percent')), ...split }
      : { label: t.kpi_seats, value: fmt(totalSeats, 'int'), ...split },
    ...(ckey.seats_offered != null
      ? [{ label: t.kpi_unallocated, value: fmt(Math.max(ckey.seats_offered - sumOf(rows, r => r.seats), 0), 'int') }]
      : []),
    { label: t.kpi_to_bill,
      value: toBill ? <>{fmt(toBill, 'compact')} <small className="ck-kpi-unit">{t.currency}</small></> : null,
      note: lodging > 0 ? t.kpi_lodging_note.replace('{amount}', `${fmt(lodging, 'compact')} ${t.currency}`) : null },
  ].map(k => ({ ...k, value: k.value || (simple ? null : '—') }))
    .filter(k => k.value != null)

  const exports = [
    ...(global.partial ? [] : [
      { label: t.xlsx_table, hint: t.xlsx_table_hint, run: () => planningApi.downloadGlobal(ckey, mode, serverLang(locale)) },
      { label: t.xlsx_all, hint: t.xlsx_all_hint, run: () => planningApi.downloadAll(ckey, mode, serverLang(locale)) },
    ]),
    ...(simple ? [] : [csvItem(t, csvRef)]),
  ]

  return (
    <section className="ck-view" aria-labelledby="ck-view-title">
      {inHeader(slots, exports.length > 0 && <ExportMenu t={t} items={exports} />)}
      <FilterBar hostRef={setFiltersHost} slots={slots} />
      <Kpis items={kpis} large />
      {needsMissing && !simple && <Banner tone="warn">{t.needs_missing}</Banner>}
      {!needsMissing && <NeedsStaleBanner t={t} locale={locale} at={staleAt} />}
      <DataSheet
        id="ck-global" columns={shownColumns} rows={rows} rowKey={r => r.country} frozen={1} simple={simple}
        onViewChange={setSheetRows} filtersTarget={filtersHost} exportRef={simple ? undefined : csvRef}
        exportName={`cle-${ckey.year}-${ckey.pole}-${mode.toLowerCase()}`}
        onRowOpen={r => openCountry(r.country)} openHint={t.open_hint}
        // Besoins ou places : ce qui a été saisi. L'effectif contractuel est un référentiel, il ne compte pas.
        rowClass={r => ((r.needs || 0) > 0 || (r.seats || 0) > 0 ? 'is-filled' : '')}
      />
    </section>
  )
}

/* ─────────────────────────── Pays (fiche) ─────────────────────────── */

/**
 * Pied du devis pour les lignes affichées. Le besoin n'est connu que par marque : il n'est repris
 * que si les lignes couvrent des marques entières. Une clé à budget fixe n'a pas de montant par
 * ligne : son total partiel reste inconnu plutôt qu'inventé.
 */
function visibleFooter(foot, all, visible) {
  if (!foot || visible.length === all.length) return foot
  const places = Object.fromEntries(PLACE_KEYS.map(k => [k, 0]))
  for (const s of visible) {
    places.postponed += s.postponed ?? 0
    places[s.site] += s.seats - (s.postponed ?? 0)
  }
  const seats = sumOf(visible, s => s.seats)
  const lodging = { trainee_lodging: sumOf(visible, s => s.trainee_lodging), trainer_lodging: sumOf(visible, s => s.trainer_lodging) }
  const costUnknown = Number(foot.key_cost) > 0 && visible.some(s => s.key_cost == null)
  const shownRows = new Set(visible)
  const brands = new Set(visible.map(s => s.brand_code))
  const wholeBrands = foot.needs_by_brand && visible.length > 0 && !brands.has('')
    && all.every(s => shownRows.has(s) || !brands.has(s.brand_code))
  const needs = wholeBrands ? sumOf([...brands], b => foot.needs_by_brand[b]) : null
  return {
    ...foot, ...places, ...lodging, seats, needs,
    key_cost: costUnknown ? null : sumOf(visible, s => s.key_cost),
    coverage: needs == null ? null : ratio(seats, needs),
    needs_unknown: needs == null && foot.needs != null,
    total: costUnknown ? null : sumOf(visible, s => s.key_cost) + lodging.trainee_lodging + lodging.trainer_lodging,
  }
}

/** Cellule saisissable du devis : une ligne gelée ou sans bloc d'édition reste en lecture. */
const editableCell = (target, field, input, extra) => ({
  input, target, field, raw: s => s.edit.raw[field], can: s => Boolean(s.edit && !s.edit.frozen), ...extra,
})

const ALL_COUNTRIES = 'all'

export function CountryView({ t, locale, fmt, ckey, mode, global, code, setCode, session, revealTick = 0, slots, canEdit = false, onEdited }) {
  const [state, setState] = useState({ loading: true })
  // Le choix « toutes » n'a de sens que pour qui voit plusieurs filiales.
  const countries = useMemo(() => (global.partial || global.rows.length < 2
    ? global.rows
    : [{ country: ALL_COUNTRIES, label: t.all_countries }, ...global.rows]), [global, t])
  // Une adresse héritée d'un autre compte (ex. « pays=all » pour une filiale) retombe sur le défaut.
  const current = (countries.some(c => c.country === code) && code)
    || (global.rows.find(c => DEFAULT_COUNTRY.has(c.country)) ?? global.rows[0])?.country
  const isAll = current === ALL_COUNTRIES

  const fetchCountry = useCallback(() => (ckey.pole === 'ALL'
    ? planningApi.yearCountry(ckey.year, current, mode)
    : planningApi.country(ckey.id, current, mode)), [ckey.id, ckey.pole, ckey.year, current, mode])

  // Seule la réponse la plus récente s'affiche ; une plus ancienne attend celle-ci, pour
  // qu'une cellule ne quitte son état « envoi » qu'une fois sa valeur à l'écran.
  const refreshSeq = useRef(0)
  const lastRefresh = useRef(Promise.resolve())
  const quietUpdate = useRef(false)

  useEffect(() => {
    refreshSeq.current += 1
    lastRefresh.current = Promise.resolve()
    if (!current) { setState({ loading: false, data: null }); return undefined }
    let alive = true
    setState(s => ({ ...s, loading: true, error: null }))
    fetchCountry()
      .then(data => alive && setState({ loading: false, data }))
      .catch(error => alive && setState({ loading: false, error }))
    return () => { alive = false }
  }, [fetchCountry, current])

  // Sans squelette : le tableau reste monté, la cellule en cours de saisie aussi.
  const refresh = useCallback(() => {
    if (!current) return Promise.resolve()
    refreshSeq.current += 1
    const seq = refreshSeq.current
    const run = fetchCountry().then(data => {
      if (seq !== refreshSeq.current) return lastRefresh.current
      quietUpdate.current = true
      setState({ loading: false, data })
      return undefined
    }).catch(() => undefined)
    lastRefresh.current = run
    return run
  }, [fetchCountry, current])

  const [problem, setProblem] = useState(null)
  const shownValue = (value, col) => (value == null || value === '' ? t.conflict_empty : fmt(value, col.type))
  const conflictText = (details, col, value) => {
    const who = details.source === 'IMPORT' ? t.conflict_import : (details.changed_by || t.conflict_other)
    const when = details.changed_at
      ? t.conflict_when.replace('{date}', new Date(details.changed_at).toLocaleString(locale, { dateStyle: 'short', timeStyle: 'short' }))
      : ''
    return t.conflict_text.replace('{who}', who).replace('{when}', when)
      .replace('{current}', shownValue(details.current, col)).replace('{mine}', shownValue(value, col))
  }

  const sendCell = async (s, col, value, expected) => {
    const { target, field } = col.edit
    const cell = `${s.edit.allocation}|${col.id}`
    setProblem(null)
    try {
      await planningApi.editCell(s.edit.key, { target, id: s.edit[target], field, expected, value })
    } catch (err) {
      const details = err?.payload?.error?.details
      if (err?.code === 'CELL_CONFLICT' && details) {
        setProblem({ cell, text: conflictText(details, col, value), retry: () => sendCell(s, col, value, details.current) })
      } else {
        setProblem({ cell, text: errText(t, err) })
      }
      if (err?.status === 400) return // valeur refusée : rien n'a changé côté serveur
    }
    await Promise.all([refresh(), onEdited?.()])
  }

  // Retour sur l'onglet : les autres ont pu saisir entre-temps.
  useEffect(() => {
    if (!canEdit) return undefined
    const onShow = () => {
      if (document.visibilityState === 'visible') { refresh(); onEdited?.() }
    }
    document.addEventListener('visibilitychange', onShow)
    return () => document.removeEventListener('visibilitychange', onShow)
  }, [canEdit, refresh, onEdited])

  const [filters, setFilters] = useState(NO_FILTERS)
  const [reveal, setReveal] = useState(0)
  // Plusieurs filiales cochées depuis une filiale : la vue consolidée s'ouvre déjà filtrée.
  const pendingCountries = useRef(null)
  useEffect(() => {
    const keep = pendingCountries.current
    pendingCountries.current = null
    setFilters(keep ? { country: keep } : NO_FILTERS)
    setProblem(null)
  }, [current])
  // Arrivée depuis la cloche : aucun filtre ni recherche ne doit cacher la session visée.
  useEffect(() => {
    if (!revealTick) return
    setFilters(NO_FILTERS)
    setReveal(n => n + 1)
  }, [revealTick])
  // Filtres locaux (sans appel serveur) : un bref squelette sur le corps du tableau signale
  // le changement, la barre de filtres reste en place (le focus ne saute pas).
  const filtering = useSettle([filters])

  const reviews = useMemo(() => groupReviews(
    (global.review_items || []).filter(i => isAll || i.country === current), i => `${i.country}|${i.code}`,
  ), [global.review_items, current, isAll])

  const data = state.data
  const sessions = useMemo(() => data?.sessions ?? [], [data])
  const columns = useMemo(() => [
    ...(isAll
      ? [{ id: 'country', header: t.col_country, type: 'text', width: 180, merge: true, value: s => s.country_label,
        render: (v, s) => <CountryName code={s.country} label={v} /> }]
      : []),
    { id: 'brand', header: t.col_brand, type: 'text', width: 130, merge: true, value: s => s.brand,
      mergeKey: s => `${s.country ?? ''}|${s.brand}`,
      render: v => <BrandMark brand={v} /> },
    // Fusion limitée à une même marque : deux marques voisines au même niveau restent séparées.
    { id: 'level', header: t.col_level, type: 'text', width: 96, merge: true,
      mergeKey: s => (s.level ? `${s.country ?? ''}|${s.brand}|${s.level}` : null),
      value: s => s.level ?? '',
      // Le libellé est celui du barème de la marque ; seule sa couleur vient du palier commun.
      render: (v, s) => (v
        ? <span className={`sheet-c-level${s.level_tier ? ` is-${s.level_tier.toLowerCase()}` : ''}`}>{v}</span>
        : <span title={s.in_catalog === false ? t.level_not_in_catalog : undefined}>—</span>),
      edit: canEdit ? editableCell('session', 'level', 'select', {
        can: s => Boolean(s.edit && !s.edit.frozen && s.edit.levels), options: s => s.edit.levels, hint: t.edit_level_hint,
      }) : undefined },
    { id: 'code', header: t.col_code, type: 'text', width: 130, value: s => s.code,
      render: (v, s) => (
        <span className="ck-country">{v}<ReviewMark t={t} locale={locale} items={reviews.get(`${s.country ?? current}|${s.code}`)} /></span>
      ) },
    { id: 'title', header: t.col_title, type: 'text', width: 260, value: s => s.title,
      edit: canEdit ? editableCell('session', 'title', 'text', { hint: t.edit_shared }) : undefined },
    // Le champ date natif (calendrier compris) ne tient pas dans 100 px.
    { id: 'start', header: t.col_start, type: 'date', width: canEdit ? 140 : 100, value: s => s.start_date,
      edit: canEdit ? editableCell('session', 'start_date', 'date', { hint: t.edit_shared }) : undefined },
    { id: 'end', header: t.col_end, type: 'date', width: canEdit ? 140 : 100, value: s => s.end_date,
      edit: canEdit ? editableCell('session', 'end_date', 'date', { hint: t.edit_shared }) : undefined },
    { id: 'trainers', header: t.col_trainers, type: 'text', width: 190,
      value: s => (Array.isArray(s.trainers) ? s.trainers.join(', ') : s.trainers),
      render: v => <TrainerNames value={v} /> },
    { id: 'location', header: t.col_location, type: 'text', width: 120, value: s => s.location,
      edit: canEdit ? editableCell('session', 'location', 'text', { hint: t.edit_shared }) : undefined },
    { id: 'seats', header: t.col_allocated, type: 'int', total: 'sum', value: s => s.seats,
      tone: (_, s) => (s.seat_status ? placeTone(s.seat_status) : null),
      edit: canEdit ? editableCell('allocation', 'seats', 'number', { min: 1, max: 32767 }) : undefined },
    // Montant par ligne : clé tarifée seulement, une clé à budget fixe n'a pas de prix de place.
    ...(sessions.some(s => s.key_cost != null)
      ? [{ id: 'key_cost', header: t.col_key_cost, type: 'money', unit: t.currency, width: 296, total: 'sum', value: s => s.key_cost }]
      : []),
    { id: 'trainee_lodging', header: t.col_trainee_lodging, type: 'money', unit: t.currency, width: 320, total: 'sum',
      value: s => s.trainee_lodging },
    { id: 'trainer_lodging', header: t.col_trainer_lodging, type: 'money', unit: t.currency, width: 290, total: 'sum',
      value: s => s.trainer_lodging },
  ], [t, locale, reviews, sessions, canEdit, isAll, current])

  // Sans filtre, le pied renvoyé par le serveur fait foi ; sinon les indicateurs suivent le tableau.
  const [sheetRows, setSheetRows] = useState(null)
  const [filtersHost, setFiltersHost] = useState(null)
  const csvRef = useRef(null)
  const foot = useMemo(() => visibleFooter(data?.footer, sessions, sheetRows ?? sessions), [data, sessions, sheetRows])
  const monthLabel = ym => {
    const [y, m] = ym.split('-').map(Number)
    return new Date(y, m - 1, 1).toLocaleDateString(locale, { month: 'long', year: 'numeric' })
  }
  // Du plus large au plus fin : la marque, la filiale, puis ce qui décrit la formation.
  const facetDefs = useMemo(() => {
    const countryLabels = new Map(sessions.map(s => [s.country, s.country_label]))
    return [
      { id: 'brand', label: t.filter_brand, get: s => s.brand, render: v => <BrandMark brand={v} /> },
      ...(isAll ? [{ id: 'country', label: t.filter_country, get: s => s.country, text: v => countryLabels.get(v) ?? v,
        render: v => <CountryName code={v} label={countryLabels.get(v) ?? v} /> }] : []),
      { id: 'job', label: t.filter_job, get: s => s.job || NO_VALUE, text: v => t[`job_${v}`], compare: byOrder(JOBS) },
      { id: 'delivery', label: t.filter_delivery, get: s => s.delivery, text: v => t[`delivery_${v}`],
        render: v => <DeliveryMark t={t} mode={v} />, values: DELIVERY_MODES, compare: byOrder(DELIVERY_MODES) },
      { id: 'site', label: t.filter_location, get: s => s.site, text: v => t[`site_${v}`], compare: byOrder(PLACE_KEYS) },
      { id: 'month', label: t.filter_month, get: s => s.start_date?.slice(0, 7), text: monthLabel,
        compare: (x, y) => x.value.localeCompare(y.value) },
    ]
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [t, locale, isAll, sessions])
  const facets = useMemo(() => buildFacets(sessions, facetDefs, filters), [sessions, facetDefs, filters])
  const shown = useMemo(() => applyFacets(sessions, facetDefs, filters), [sessions, facetDefs, filters])
  // Une seule ligne : la filiale se choisit à droite du titre, l'export rejoint les outils
  // de l'en-tête (slots de la page) ; les filtres vivent juste au-dessus des indicateurs.
  // Une filiale : sa vue, modifiable. Aucune ou plusieurs : la vue consolidée, filtrée.
  const pickCountries = list => {
    if (list.length === 1) { if (list[0] !== current) setCode(list[0]); return }
    if (!countries.some(c => c.country === ALL_COUNTRIES)) return
    if (isAll) setFilters(cur => ({ ...cur, country: list }))
    else { pendingCountries.current = list; setCode(ALL_COUNTRIES) }
  }
  const combo = <CountryCombo t={t} countries={countries} onChange={pickCountries}
    selected={isAll ? (filters.country ?? []) : [current]} />
  const exportBtn = data && (
    <ExportMenu t={t} items={[
      { label: t.xlsx_country, hint: isAll ? t.xlsx_all_countries_hint : t.xlsx_country_hint, run: () => planningApi.downloadCountry(ckey, current, mode, serverLang(locale)) },
      csvItem(t, csvRef),
    ]} />
  )
  const filterBar = (
    <>
      {facets.filter(f => f.id !== 'country').map(f => (
        <FacetFilter key={f.id} t={t} facet={f} selected={filters[f.id] ?? []}
          onChange={list => setFilters(cur => ({ ...cur, [f.id]: list }))} />
      ))}
    </>
  )
  // Dit au-dessus des indicateurs qu'ils ne portent que sur une partie du devis.
  const hiddenRows = sheetRows != null && sheetRows.length < sessions.length
  // Les pastilles disent déjà quoi : la note ne dit que combien.
  const filterNote = hiddenRows
    && t.filter_count.replace('{n}', fmt(sheetRows.length, 'int')).replace('{total}', fmt(sessions.length, 'int'))
  // Pendant un chargement, le squelette REMPLACE l'ancien contenu (jamais les deux à la fois).
  const ready = !state.loading
  const scrollToSession = () => requestAnimationFrame(() =>
    document.querySelector('.sheet-table tr.is-focus')?.scrollIntoView?.({ block: 'center' }))
  // Une actualisation après saisie ne ramène pas l'écran sur la session de la cloche.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (quietUpdate.current) { quietUpdate.current = false; return }
    if (session && ready) scrollToSession()
  }, [session, ready, shown])
  return (
    <section className="ck-view" aria-busy={state.loading || undefined}>
      {slots?.title ? createPortal(combo, slots.title) : combo}
      {ready && inHeader(slots, exportBtn)}
      {state.loading && <SheetSkeleton label={t.loading} kpis />}
      {state.error && <Banner tone="warn">{errText(t, state.error)}</Banner>}
      {ready && data && <FilterBar hostRef={setFiltersHost} note={foot && filterNote} slots={slots} />}
      {ready && foot && (
        // Lecture par colonne : places, accommodation, puis la somme totale seule.
        <Kpis large paired items={[
          { label: foot.needs == null ? t.kpi_seats : t.kpi_seats_needs,
            value: foot.needs == null ? fmt(foot.seats, 'int') : `${fmt(foot.seats, 'int')} / ${fmt(foot.needs, 'int')}`,
            note: foot.needs == null ? null
              : t.kpi_unallocated_note.replace('{n}', fmt(Math.max(foot.needs - foot.seats, 0), 'int')),
            ...seatSplit(t, fmt, foot) },
          { label: t.col_coverage, value: foot.coverage == null ? '—' : fmt(foot.coverage, 'percent'),
            note: foot.needs_unknown ? t.kpi_needs_by_brand_note : null },
          // Une carte pour l'accommodation (stagiaires puis formateurs), le coût de formation dessous.
          { label: t.kpi_lodging,
            value: kpiMoney(Number(foot.trainee_lodging || 0) + Number(foot.trainer_lodging || 0), fmt, t),
            // Mêmes encadrés que les places, sans couleur : ce sont deux postes, pas deux états.
            split: [
              { key: 'trainees', tone: 'plain', label: t.kpi_lodging_trainees, value: kpiMoney(foot.trainee_lodging, fmt, t) },
              { key: 'trainers', tone: 'plain', label: t.kpi_lodging_trainers, value: kpiMoney(foot.trainer_lodging, fmt, t) },
            ] },
          { label: t.col_key_cost, value: foot.key_cost == null ? '—' : kpiMoney(foot.key_cost, fmt, t) },
          { label: t.col_total, value: foot.total == null ? '—' : kpiMoney(foot.total, fmt, t), note: t.kpi_total_note },
        ]} />
      )}
      {ready && data && (
        <div className={filtering ? 'ck-sheet-busy' : undefined} aria-busy={filtering || undefined}>
          <DataSheet id="ck-country-niveau" columns={columns} rows={shown} frozen={isAll ? 4 : 3} onViewChange={setSheetRows} filtersTarget={filtersHost} exportRef={csvRef}
            rowKey={(s, i) => s.edit?.allocation ?? `${s.code}-${s.start_date}-${i}`}
            rowClass={s => (session && s.code === session ? 'is-focus' : undefined)} revealKey={reveal}
            onCellCommit={canEdit ? sendCell : undefined} openHint={canEdit ? t.edit_hint : undefined}
            cellError={(s, c) => (problem?.cell === `${s.edit?.allocation}|${c.id}` ? problem.text : null)}
            exportName={`cle-${ckey.year}-${current}`} emptyText={t.no_sessions} filterControls={filterBar || null} hideSearch
            controlsActive={Object.values(filters).some(list => list.length > 0)}
            onClearControls={() => setFilters(NO_FILTERS)} />
        </div>
      )}
      {problem && (
        // Fixé à l'écran : la cellule concernée peut être loin sous le haut du tableau.
        <div className="ck-cell-alert">
          <Banner tone="warn">
            {problem.text}
            <span className="ck-cell-alert-actions">
              {problem.retry ? (
                <>
                  <button type="button" className="ck-btn" onClick={() => setProblem(null)}>{t.conflict_keep}</button>
                  <button type="button" className="ck-btn ck-btn--primary" onClick={problem.retry}>{t.conflict_replace}</button>
                </>
              ) : <button type="button" className="ck-btn" onClick={() => setProblem(null)}>{t.cell_close}</button>}
            </span>
          </Banner>
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
export function AbcView({ t, locale, fmt, scope, ckey, slots }) {
  const csvRef = useRef(null)
  const [filtersHost, setFiltersHost] = useState(null)
  const [base, setBase] = useState('a')
  const settling = useSettle([base]) // bascule A / B / C locale : bref squelette
  const [state, setState] = useState({ loading: true })
  const [sheetRows, setSheetRows] = useState(null)
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
      { id: 'a_b', header: t.col_a_b, type: 'percent', width: 90, bar: true, value: r => r.a_b,
        total: rs => ratio(sumOf(rs, r => r.a), sumOf(rs, r => r.b)), tone: v => coverageTone(v) },
      { id: 'a_c', header: t.col_a_c, type: 'percent', width: 90, bar: true, value: r => r.a_c,
        total: rs => ratio(sumOf(rs, r => r.a), sumOf(rs, r => r.c)), tone: v => coverageTone(v) },
      { id: 'share', header: t.col_share, group: t[`abc_${base}`], type: 'percent', bar: true, total: 'sum',
        value: r => r[`share_${base}`] },
      { id: 'amount', header: t.col_amount, group: t[`abc_${base}`], type: 'money', unit: t.currency, width: 140,
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

  const { missing: needsMissing, staleAt } = needsStatus(data)
  return (
    <section className="ck-view">
      <p className="ck-lead">{t.abc_lead}</p>
      {inHeader(slots, <ExportMenu t={t} items={[csvItem(t, csvRef)]} />)}
      <FilterBar hostRef={setFiltersHost} slots={slots} />
      <Kpis items={[
        { label: t.kpi_budget, value: data.budget ? kpiMoney(data.budget, fmt, t) : '—' },
        ...ABC_BASES.map(x => ({ label: t[`abc_${x}`], value: fmt(sumOf(sheetRows ?? data.rows, r => r[x]), 'int') })),
      ]} />
      {needsMissing && <Banner tone="warn">{t.needs_missing}</Banner>}
      {!needsMissing && <NeedsStaleBanner t={t} locale={locale} at={staleAt} />}
      {bar}
      <DataSheet id="ck-abc" columns={columns} rows={data.rows} rowKey={r => r.country} frozen={1} onViewChange={setSheetRows} filtersTarget={filtersHost} exportRef={csvRef}
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
    { id: 'psh', header: t.col_planned_share, group: t.col_share, type: 'percent', bar: true, value: r => r.planned_share },
    { id: 'ash', header: t.col_actual_share, group: t.col_share, type: 'percent', bar: true, value: r => r.actual_share },
    { id: 'pt', header: t.col_planned_total, group: t.col_total, type: 'money', unit: t.currency, width: 140, total: 'sum',
      value: r => r.planned_total },
    { id: 'at', header: t.col_actual_total, group: t.col_total, type: 'money', unit: t.currency, width: 140, total: 'sum',
      value: r => r.actual_total },
    { id: 'dt', header: t.col_delta_total, group: t.col_total, type: 'money', unit: t.currency, width: 140, total: 'sum',
      value: r => r.delta_total, tone: deltaTone },
  ], [t])

  const sessionCols = useMemo(() => [
    { id: 'brand', header: t.col_brand, type: 'text', width: 110, value: g => g.brand,
      render: v => <BrandMark brand={v} /> },
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
    { id: 'brand', header: t.col_brand, type: 'text', width: 120, value: m => m.brand,
      render: v => <BrandMark brand={v} /> },
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
