import { useEffect, useId, useMemo, useRef, useState } from 'react'

/** Valeur d'une ligne qu'aucun référentiel ne classe : proposée comme un choix « Non classé ». */
export const NO_VALUE = 'NONE'

export const fold = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()

/** Ordre métier imposé ; une valeur absente de la liste passe après. */
export const byOrder = list => {
  const rank = o => (list.includes(o.value) ? list.indexOf(o.value) : list.length)
  return (a, b) => rank(a) - rank(b)
}

// `get` renvoie une valeur, ou une liste quand une ligne en porte plusieurs (ex. marques).
const valuesOf = (d, r) => [].concat(d.get(r) ?? []).filter(Boolean)

/** Dans un filtre, un choix OU un autre ; entre filtres, tous à la fois. `except` ignore un filtre. */
export function applyFacets(rows, defs, filters, except = null) {
  return rows.filter(r => defs.every(d =>
    d.id === except || !filters[d.id]?.length || valuesOf(d, r).some(v => filters[d.id].includes(v))))
}

/**
 * Filtres et options à proposer. Chaque filtre compte les lignes retenues par tous les AUTRES :
 * un choix qui ne mènerait à rien disparaît, et un filtre ne réduit jamais sa propre liste.
 * Tous les filtres restent visibles, même sans donnée : seules leurs options suivent les lignes.
 * Une valeur cochée reste, pour pouvoir la retirer.
 */
export function buildFacets(rows, defs, filters) {
  return defs.map(d => {
    // `values` : domaine fixe (ex. Présentiel / Distanciel), toujours proposé, à 0 si absent.
    const counts = new Map([...(d.values ?? []), ...(filters[d.id] ?? [])].map(v => [v, 0]))
    for (const r of applyFacets(rows, defs, filters, d.id)) {
      for (const v of new Set(valuesOf(d, r))) counts.set(v, (counts.get(v) ?? 0) + 1)
    }
    const options = [...counts].map(([value, count]) => ({
      value, count, label: d.text ? d.text(value) : value, node: d.render?.(value), short: d.short?.(value),
    }))
    return { id: d.id, label: d.label, layout: d.layout, year: d.year,
      options: options.sort(d.compare ?? ((a, b) => a.label.localeCompare(b.label))) }
  })
}

export const Check = ({ className }) => (
  <svg className={className} viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
    <path d="M3.5 8.5l3 3 6-7" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

export const Chevron = () => (
  <svg className="ck-combo-chev" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
    <path d="M4 6l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
)

/**
 * Filtre discret : son seul nom tant qu'il ne retient rien, une pastille bleue dès qu'il filtre.
 * Combobox : on tape pour réduire la liste, flèches et Entrée pour choisir, Échap pour fermer.
 * `single` : un seul choix, la liste se referme ; `noAll` : pas d'option « Tous ».
 * `facet.layout === 'months'` : sélecteur de mois (grille 4 × 3 de l'année, sans les jours),
 * chaque mois avec son nombre ; un mois sans ligne reste visible, grisé.
 */
export function FacetFilter({ t, facet, selected, onChange, single = false, noAll = false }) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const boxRef = useRef(null)
  const btnRef = useRef(null)
  const inputRef = useRef(null)
  const listId = useId()
  const listRef = useRef(null)
  const { label, options } = facet
  const grid = facet.layout === 'months'
  // Grille fixe janv.–déc. de l'année ; un mois d'une autre année va à part, sous la grille.
  const inYear = o => !grid || o.value.startsWith(`${facet.year}-`)
  const ordered = useMemo(() => [...options.filter(inYear), ...options.filter(o => !inYear(o))],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [options, grid, facet.year])

  const q = grid ? '' : fold(query.trim())
  // Sans option, « Tous » seul n'apprendrait rien : la liste dit qu'il n'y a rien à choisir.
  const entries = useMemo(() => (q || noAll || ordered.length === 0
    ? ordered.filter(o => fold(o.label).includes(q))
    : [{ all: true, value: '', label: t.filter_all }, ...ordered]), [ordered, q, t, noAll])

  useEffect(() => {
    if (!open) return undefined
    setQuery('')
    // Grille : aucun repère tant que le clavier n'a pas servi (il se lirait comme un choix).
    setActive(grid ? -1 : 0)
    ;(grid ? listRef : inputRef).current?.focus()
    const away = e => { if (!boxRef.current?.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', away)
    return () => document.removeEventListener('mousedown', away)
  }, [open, grid])
  useEffect(() => { setActive(0) }, [query])
  useEffect(() => {
    if (open) document.getElementById(`${listId}-${active}`)?.scrollIntoView?.({ block: 'nearest' })
  }, [open, active, listId])

  const close = () => { setOpen(false); btnRef.current?.focus() }
  const isOn = o => (o.all ? selected.length === 0 : selected.includes(o.value))
  // Mois sans ligne : visible pour lire l'année entière, mais rien à y choisir.
  const isOff = o => grid && !o.all && o.count === 0 && !isOn(o)
  const toggle = o => {
    if (isOff(o)) return
    if (single) { onChange(o.all ? [] : [o.value]); close(); return }
    if (o.all) onChange([])
    else onChange(selected.includes(o.value) ? selected.filter(v => v !== o.value) : [...selected, o.value])
  }
  // Grille : « Tous » en tête sur toute la largeur, puis 4 mois par rangée.
  const head = entries[0]?.all ? 1 : 0
  const step = (i, d) => Math.min(Math.max(i + d, 0), entries.length - 1)
  const down = i => (i < head ? head : step(i, 4))
  const up = i => (i - head < 4 ? 0 : i - 4)
  const onKey = e => {
    if (grid && e.key === 'ArrowRight') { e.preventDefault(); setActive(i => step(i, 1)) }
    else if (grid && e.key === 'ArrowLeft') { e.preventDefault(); setActive(i => step(i, -1)) }
    else if (e.key === 'ArrowDown') { e.preventDefault(); setActive(i => (grid ? down(i) : step(i, 1))) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive(i => (grid ? up(i) : step(i, -1))) }
    else if (e.key === 'Enter') { e.preventDefault(); if (entries[active]) toggle(entries[active]) }
    else if (e.key === 'Escape') { e.preventDefault(); close() }
    else if (e.key === 'Tab') setOpen(false)
  }

  const chosen = options.filter(o => selected.includes(o.value))
  const one = chosen.length === 1 ? chosen[0] : null
  const summary = selected.length === 0 ? t.filter_all : (one?.label ?? String(selected.length))
  // Sans option « Tous », le choix courant est l'état normal : il ne se signale pas comme un filtre.
  const lit = selected.length > 0 && !noAll
  return (
    <div className={`ck-combo ck-facet${lit ? ' is-on' : ''}`} ref={boxRef}>
      <button type="button" ref={btnRef} className="ck-facet-btn" aria-haspopup="listbox" aria-expanded={open}
        aria-label={`${label} : ${summary}`} title={chosen.length > 1 ? chosen.map(o => o.label).join(', ') : undefined}
        onClick={() => setOpen(o => !o)}>
        <span className="ck-facet-label">{label}</span>
        {selected.length > 0 && (
          <>
            <span className="ck-facet-sep" aria-hidden="true">·</span>
            <span className="ck-facet-value">{one?.node ?? summary}</span>
          </>
        )}
        <Chevron />
      </button>
      {open && (
        <div className={`ck-combo-panel ck-facet-panel${grid ? ' is-months' : ''}`} onKeyDown={onKey}>
          {grid ? (<>
            <div className="ck-month-head"><strong>{facet.year}</strong></div>
            <ul ref={listRef} id={listId} role="listbox" tabIndex={0} aria-multiselectable={!single} aria-label={label}
              aria-activedescendant={entries[active] ? `${listId}-${active}` : undefined} className="ck-month-grid">
              {entries.map((o, i) => [
                !o.all && !inYear(o) && (o === entries.find(e => !e.all && !inYear(e))) && (
                  <li key="outside" role="presentation" className="ck-month-outside">
                    {t.filter_month_outside?.replace('{year}', facet.year)}
                  </li>),
                <li key={o.all ? '*' : o.value} id={`${listId}-${i}`} role="option" aria-selected={isOn(o)}
                  aria-disabled={isOff(o) || undefined} data-value={o.value} title={o.all ? undefined : o.label}
                  className={`ck-month${o.all ? ' is-all' : ''}${i === active ? ' is-active' : ''}${isOn(o) ? ' is-on' : ''}${isOff(o) ? ' is-off' : ''}`}
                  onMouseEnter={() => setActive(i)} onMouseDown={e => { e.preventDefault(); toggle(o) }}>
                  {/* Pas de compte sous le mois : il se lirait comme une date. Mois vide = grisé. */}
                  {o.all ? o.label : <span className="ck-month-name">{o.short ?? o.label}</span>}
                </li>,
              ])}
            </ul>
          </>) : (<>
          <input ref={inputRef} type="text" className="ck-combo-input" role="combobox" aria-expanded="true"
            aria-autocomplete="list" aria-controls={listId}
            aria-activedescendant={entries[active] ? `${listId}-${active}` : undefined}
            placeholder={t.filter_search_option} aria-label={`${label} : ${t.filter_search_option}`}
            value={query} onChange={e => setQuery(e.target.value)} />
          <ul id={listId} role="listbox" aria-multiselectable={!single} aria-label={label} className="ck-combo-list">
            {entries.map((o, i) => (
              <li key={o.all ? '*' : o.value} id={`${listId}-${i}`} role="option" aria-selected={isOn(o)} data-value={o.value}
                className={`ck-combo-opt${i === active ? ' is-active' : ''}${isOn(o) ? ' is-on' : ''}`}
                onMouseEnter={() => setActive(i)} onMouseDown={e => { e.preventDefault(); toggle(o) }}>
                <span className="ck-facet-main">
                  {!single && <span className="ck-facet-box" aria-hidden="true">{isOn(o) && <Check />}</span>}
                  {o.node ?? o.label}
                </span>
                {single
                  ? isOn(o) && <Check className="ck-combo-check" />
                  : !o.all && o.count != null && <span className="ck-facet-count">{o.count}</span>}
              </li>
            ))}
            {entries.length === 0 && <li className="ck-combo-empty">{t.filter_no_option}</li>}
          </ul>
          </>)}
        </div>
      )}
    </div>
  )
}
