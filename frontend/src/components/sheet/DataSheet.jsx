/**
 * Grille de lecture « comme Excel », sans dépendance :
 *   lettres de colonnes et numéros de lignes, barre de formule (adresse + valeur),
 *   tri (Maj+clic : tri secondaire), filtre par colonne (texte, >10, 10..20, (vide)),
 *   recherche (Ctrl+F), volets figés, largeur ajustable (double-clic : largeur d'origine),
 *   choix des colonnes, ligne de totaux, sélection à la souris ou au clavier
 *   (Maj+flèches, Ctrl+flèches, Ctrl+A), barre d'état Moyenne / Nombre / Somme / Min / Max,
 *   copie Ctrl+C collable dans Excel, export CSV, mise en forme conditionnelle.
 *
 * Colonne : { id, header, group?, type: text|int|money|percent|date, value(row),
 *             width?, total?: 'sum' | (rows) => valeur, tone?(v, row), bar?, render?(v, row),
 *             hidden? }
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useSettle } from './useSettle'
import useLocale from '../../hooks/useLocale'
import { aggregate, cellAddress, colLetter, fold, inRange, normRange, parseFilter, toTSV } from './sheetMath'
import { cellText, downloadBlob, makeFormatter, toCsv } from './sheetExport'

const ROWNUM_W = 44
const DEFAULT_W = { text: 180, int: 92, money: 132, percent: 96, date: 106 }
const NUMERIC = new Set(['int', 'money', 'percent'])

function loadPrefs(id) {
  try { return JSON.parse(window.localStorage.getItem(`sheet:${id}`)) || {} } catch { return {} }
}
function savePrefs(id, prefs) {
  try { window.localStorage.setItem(`sheet:${id}`, JSON.stringify(prefs)) } catch { /* stockage indisponible */ }
}

function compareValues(a, b, locale) {
  if (typeof a === 'number' && typeof b === 'number') return a - b
  return String(a).localeCompare(String(b), locale, { sensitivity: 'base', numeric: true })
}

export default function DataSheet({
  id, columns, rows, rowKey, frozen: frozenDefault = 1, onRowOpen, actions,
  exportName = 'export', emptyText, openHint, simple = false,
}) {
  // simple : lecteur pressé. Ni barre de formule, ni lettres de colonnes, ni
  // réglages de tableur ; la ligne de filtres reste à ouvrir à la demande.
  const { t, locale } = useLocale('sheet')
  const format = useMemo(() => makeFormatter(locale), [locale])
  const prefs0 = useMemo(() => loadPrefs(id), [id])

  const [hidden, setHidden] = useState(
    () => new Set(prefs0.hidden ?? columns.filter(c => c.hidden).map(c => c.id)))
  const [widths, setWidths] = useState(prefs0.widths ?? {})
  const [frozen, setFrozen] = useState(prefs0.frozen ?? frozenDefault)
  const [showFilters, setShowFilters] = useState(simple ? false : (prefs0.showFilters ?? true))
  const [sort, setSort] = useState([])
  const [filters, setFilters] = useState({})
  const [search, setSearch] = useState('')
  const [anchor, setAnchor] = useState(null)
  const [focus, setFocus] = useState(null)
  const [colsOpen, setColsOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  // Recherche, filtre de colonne ou tri : bref squelette sur le corps du tableau.
  const settling = useSettle([search, filters, sort])
  const gridRef = useRef(null)
  const searchRef = useRef(null)
  const colsRef = useRef(null)
  const dragging = useRef(false)

  useEffect(() => {
    savePrefs(id, { hidden: [...hidden], widths, frozen, showFilters })
  }, [id, hidden, widths, frozen, showFilters])

  const cols = useMemo(() => columns.filter(c => !hidden.has(c.id)), [columns, hidden])
  const width = c => widths[c.id] ?? c.width ?? DEFAULT_W[c.type ?? 'text'] ?? 120

  // ── lignes visibles : filtres, recherche, tri ────────────────────────────
  const view = useMemo(() => {
    const preds = cols
      .map(c => [c, parseFilter(filters[c.id], { percent: c.type === 'percent' })])
      .filter(([, p]) => p)
    const q = fold(search.trim())
    let out = rows.filter(r => preds.every(([c, p]) => p(c.value(r))))
    if (q) {
      out = out.filter(r => cols.some(c => {
        const v = c.value(r)
        return v != null && (fold(format(v, c.type)).includes(q) || fold(v).includes(q))
      }))
    }
    if (sort.length) {
      const byId = Object.fromEntries(columns.map(c => [c.id, c]))
      out = [...out].sort((a, b) => {
        for (const s of sort) {
          const c = byId[s.id]
          if (!c) continue
          const va = c.value(a)
          const vb = c.value(b)
          const na = va == null || va === ''
          const nb = vb == null || vb === ''
          if (na && nb) continue
          if (na) return 1 // cellules vides toujours en bas, comme Excel
          if (nb) return -1
          const r = compareValues(va, vb, locale)
          if (r) return s.desc ? -r : r
        }
        return 0
      })
    }
    return out
  }, [rows, cols, columns, filters, search, sort, format, locale])

  const totals = useMemo(() => cols.map(c => {
    if (typeof c.total === 'function') return c.total(view)
    if (c.total === 'sum') return view.reduce((s, r) => s + (Number(c.value(r)) || 0), 0)
    return null
  }), [cols, view])
  const hasTotals = cols.some(c => c.total)

  // ── sélection ────────────────────────────────────────────────────────────
  useEffect(() => {
    if (focus && (focus.row >= view.length || focus.col >= cols.length)) {
      setAnchor(null)
      setFocus(null)
    }
  }, [view.length, cols.length, focus])

  const range = normRange(anchor, focus)
  const lastR = view.length - 1
  const lastC = cols.length - 1
  const clamp = (row, col) => ({
    row: Math.max(0, Math.min(lastR, row)), col: Math.max(0, Math.min(lastC, col)),
  })

  const selection = useMemo(() => {
    if (!range || !view.length) return null
    const values = []
    for (let r = range.r0; r <= range.r1; r += 1) {
      for (let c = range.c0; c <= range.c1; c += 1) {
        if (view[r] && cols[c]) values.push(cols[c].value(view[r]))
      }
    }
    const types = new Set(cols.slice(range.c0, range.c1 + 1).map(c => c.type))
    return { cells: values.length, type: types.size === 1 ? [...types][0] : null, ...aggregate(values) }
  }, [range?.r0, range?.r1, range?.c0, range?.c1, view, cols]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!focus) return
    gridRef.current
      ?.querySelector(`[data-cell="${focus.row}:${focus.col}"]`)
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [focus])

  useEffect(() => {
    const up = () => { dragging.current = false }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  useEffect(() => {
    if (!colsOpen) return undefined
    const close = e => { if (!colsRef.current?.contains(e.target)) setColsOpen(false) }
    document.addEventListener('mousedown', close)
    return () => document.removeEventListener('mousedown', close)
  }, [colsOpen])

  const selectAll = () => {
    if (!view.length || !cols.length) return
    setAnchor({ row: 0, col: 0 })
    setFocus({ row: lastR, col: lastC })
  }

  const copy = async () => {
    let matrix
    if (range && view.length) {
      matrix = []
      for (let r = range.r0; r <= range.r1; r += 1) {
        matrix.push(cols.slice(range.c0, range.c1 + 1)
          .map(c => cellText(c.value(view[r]), c.type, locale, format)))
      }
    } else {
      matrix = [cols.map(c => (c.group ? `${c.group} · ${c.header}` : c.header)),
        ...view.map(r => cols.map(c => cellText(c.value(r), c.type, locale, format)))]
    }
    try {
      await navigator.clipboard.writeText(toTSV(matrix))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* presse-papier refusé par le navigateur */ }
  }

  const exportCsv = () => {
    downloadBlob(new Blob([toCsv({ columns: cols, rows: view, locale, format })],
      { type: 'text/csv;charset=utf-8' }), `${exportName}.csv`)
  }

  const onKeyDown = e => {
    const mod = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    if (mod && k === 'f') { e.preventDefault(); searchRef.current?.focus(); return }
    if (mod && k === 'c') { e.preventDefault(); copy(); return }
    if (mod && k === 'a') { e.preventDefault(); selectAll(); return }
    if (!view.length || !cols.length) return
    const cur = focus ?? { row: 0, col: 0 }
    let next
    switch (e.key) {
      case 'ArrowUp': next = { row: mod ? 0 : cur.row - 1, col: cur.col }; break
      case 'ArrowDown': next = { row: mod ? lastR : cur.row + 1, col: cur.col }; break
      case 'ArrowLeft': next = { row: cur.row, col: mod ? 0 : cur.col - 1 }; break
      case 'ArrowRight': next = { row: cur.row, col: mod ? lastC : cur.col + 1 }; break
      case 'Home': next = mod ? { row: 0, col: 0 } : { row: cur.row, col: 0 }; break
      case 'End': next = mod ? { row: lastR, col: lastC } : { row: cur.row, col: lastC }; break
      case 'PageUp': next = { row: cur.row - 15, col: cur.col }; break
      case 'PageDown': next = { row: cur.row + 15, col: cur.col }; break
      case 'Enter':
        if (onRowOpen && focus) { e.preventDefault(); onRowOpen(view[focus.row]) }
        return
      case 'Escape':
        if (focus) setAnchor(focus)
        return
      default:
        return
    }
    e.preventDefault()
    next = clamp(next.row, next.col)
    if (e.shiftKey) { if (!anchor) setAnchor(cur) } else setAnchor(next)
    setFocus(next)
  }

  const onCellDown = (e, row, col) => {
    if (e.button !== 0) return
    const cell = { row, col }
    if (e.shiftKey && anchor) setFocus(cell)
    else { setAnchor(cell); setFocus(cell) }
    dragging.current = true
    gridRef.current?.focus({ preventScroll: true })
  }
  const onCellEnter = (row, col) => { if (dragging.current) setFocus({ row, col }) }

  const selectColumn = (e, col) => {
    if (!view.length) return
    setAnchor({ row: 0, col: e.shiftKey && anchor ? anchor.col : col })
    setFocus({ row: lastR, col })
    gridRef.current?.focus({ preventScroll: true })
  }
  const selectRow = (e, row) => {
    setAnchor({ row: e.shiftKey && anchor ? anchor.row : row, col: 0 })
    setFocus({ row, col: lastC })
    gridRef.current?.focus({ preventScroll: true })
  }

  const toggleSort = (e, colId) => setSort(prev => {
    const cur = prev.find(s => s.id === colId)
    const next = !cur ? { id: colId, desc: false } : !cur.desc ? { id: colId, desc: true } : null
    if (e.shiftKey) {
      const rest = prev.filter(s => s.id !== colId)
      return next ? [...rest, next] : rest
    }
    return next ? [next] : []
  })

  const startResize = (e, c) => {
    e.preventDefault()
    e.stopPropagation()
    const x0 = e.clientX
    const w0 = width(c)
    const move = ev => setWidths(w => ({ ...w, [c.id]: Math.max(48, Math.round(w0 + ev.clientX - x0)) }))
    const up = () => {
      window.removeEventListener('mousemove', move)
      window.removeEventListener('mouseup', up)
    }
    window.addEventListener('mousemove', move)
    window.addEventListener('mouseup', up)
  }
  const resetWidth = c => setWidths(w => {
    const { [c.id]: _drop, ...rest } = w
    return rest
  })

  const reset = () => { setSort([]); setFilters({}); setSearch('') }
  const dirty = sort.length > 0 || search !== '' || Object.values(filters).some(Boolean)

  // ── volets figés : décalage gauche de chaque colonne figée ───────────────
  const lefts = []
  let acc = ROWNUM_W
  cols.forEach((c, i) => {
    lefts.push(i < frozen ? acc : null)
    if (i < frozen) acc += width(c)
  })
  const frozenCls = i => (lefts[i] != null ? ` is-frozen${i === frozen - 1 ? ' is-frozen-edge' : ''}` : '')
  const frozenStyle = (i, extra) => (lefts[i] != null ? { ...extra, left: lefts[i] } : extra)
  const tableWidth = cols.reduce((s, c) => s + width(c), ROWNUM_W)

  const groups = useMemo(() => {
    if (!cols.some(c => c.group)) return null
    const segs = []
    cols.forEach((c, i) => {
      const last = segs[segs.length - 1]
      if (c.group && last && last.group === c.group && i >= frozen) last.span += 1
      else segs.push({ group: c.group ?? '', span: 1, start: i })
    })
    return segs
  }, [cols, frozen])

  const fmtAgg = (v, kind) => {
    if (v == null) return ''
    if (kind !== 'count' && selection?.type === 'percent') return format(v, 'percent')
    if (kind !== 'avg' && selection?.type && NUMERIC.has(selection.type)) return format(v, 'int')
    return format(v, 'number')
  }

  const address = range
    ? (range.r0 === range.r1 && range.c0 === range.c1
      ? cellAddress(range.c0, range.r0)
      : `${cellAddress(range.c0, range.r0)}:${cellAddress(range.c1, range.r1)}`)
    : ''
  const focusCol = focus ? cols[focus.col] : null
  const focusRow = focus ? view[focus.row] : null
  const focusText = focusCol && focusRow ? format(focusCol.value(focusRow), focusCol.type) : ''

  return (
    <div className={`sheet${settling ? ' is-settling' : ''}`} aria-busy={settling || undefined}>
      {/* ── barre d'outils ── */}
      <div className="sheet-toolbar" role="toolbar" aria-label={t.toolbar}>
        <label className="sheet-search">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
            <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10.6 10.6L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input ref={searchRef} type="search" value={search} placeholder={t.search_ph}
            aria-label={t.search_ph} onChange={e => setSearch(e.target.value)} />
        </label>
        <button type="button" className={`sheet-btn${showFilters ? ' is-on' : ''}`}
          aria-pressed={showFilters} onClick={() => setShowFilters(v => !v)}>
          {t.filters}
        </button>
        <div className="sheet-pop" ref={colsRef}>
          <button type="button" className="sheet-btn" aria-expanded={colsOpen}
            onClick={() => setColsOpen(v => !v)}>
            {t.columns} {hidden.size > 0 && <span className="sheet-badge">{columns.length - hidden.size}/{columns.length}</span>}
          </button>
          {colsOpen && (
            <div className="sheet-pop-panel" role="dialog" aria-label={t.columns}>
              <div className="sheet-pop-actions">
                <button type="button" onClick={() => setHidden(new Set())}>{t.show_all}</button>
              </div>
              {columns.map(c => (
                <label key={c.id} className="sheet-pop-item">
                  <input type="checkbox" checked={!hidden.has(c.id)}
                    onChange={() => setHidden(h => {
                      const n = new Set(h)
                      if (n.has(c.id)) n.delete(c.id)
                      else n.add(c.id)
                      return n
                    })} />
                  {c.group ? `${c.group} · ${c.header}` : c.header}
                </label>
              ))}
            </div>
          )}
        </div>
        {!simple && (
          <label className="sheet-freeze">
            {t.freeze}
            <select value={frozen} onChange={e => setFrozen(Number(e.target.value))}>
              <option value={0}>{t.freeze_none}</option>
              {[1, 2, 3].map(n => (
                <option key={n} value={n}>{t.freeze_cols.replace('{n}', n)}</option>
              ))}
            </select>
          </label>
        )}
        <span className="sheet-toolbar-sep" />
        {!simple && (
          <>
            <button type="button" className="sheet-btn" onClick={copy}
              title={t.copy_hint}>{copied ? t.copied : t.copy}</button>
            <button type="button" className="sheet-btn" onClick={exportCsv}>{t.csv}</button>
          </>
        )}
        {actions}
        {dirty && <button type="button" className="sheet-btn sheet-btn-ghost" onClick={reset}>{t.reset}</button>}
      </div>

      {/* ── barre de formule ── */}
      {!simple && (
        <div className="sheet-formula" aria-live="polite">
          <span className="sheet-namebox">{address || '—'}</span>
          <span className="sheet-fx">fx</span>
          <span className="sheet-formula-val">
            {focusCol && <b>{focusCol.group ? `${focusCol.group} · ${focusCol.header}` : focusCol.header} : </b>}
            {focusText}
          </span>
        </div>
      )}

      {/* ── grille ── */}
      <div className="sheet-scroll" ref={gridRef} tabIndex={0} role="grid"
        aria-rowcount={view.length} aria-colcount={cols.length} onKeyDown={onKeyDown}>
        <table className="sheet-table" style={{ width: tableWidth }}>
          <colgroup>
            <col style={{ width: ROWNUM_W }} />
            {cols.map(c => <col key={c.id} style={{ width: width(c) }} />)}
          </colgroup>
          <thead>
            {!simple && (
              <tr className="sheet-letters">
                <th className="sheet-corner" onClick={selectAll} title={t.select_all} />
                {cols.map((c, i) => (
                  <th key={c.id} className={`sheet-letter${range && i >= range.c0 && i <= range.c1 ? ' is-hl' : ''}${frozenCls(i)}`}
                    style={frozenStyle(i)} onMouseDown={e => selectColumn(e, i)}>
                    {colLetter(i)}
                  </th>
                ))}
              </tr>
            )}
            {groups && (
              <tr className="sheet-groups">
                <th className="sheet-rownum-h" />
                {groups.map(g => (
                  <th key={`${g.start}-${g.group}`} colSpan={g.span}
                    className={`sheet-group${g.group ? ' has-group' : ''}${g.span === 1 ? frozenCls(g.start) : ''}`}
                    style={g.span === 1 ? frozenStyle(g.start) : undefined}>
                    {g.group}
                  </th>
                ))}
              </tr>
            )}
            <tr className="sheet-head">
              <th className="sheet-rownum-h" />
              {cols.map((c, i) => {
                const s = sort.find(x => x.id === c.id)
                const order = sort.length > 1 && s ? sort.indexOf(s) + 1 : null
                return (
                  <th key={c.id} scope="col"
                    aria-sort={s ? (s.desc ? 'descending' : 'ascending') : 'none'}
                    className={`sheet-h${NUMERIC.has(c.type) ? ' is-num' : ''}${frozenCls(i)}`}
                    style={frozenStyle(i)}>
                    <button type="button" className="sheet-h-btn" onClick={e => toggleSort(e, c.id)}
                      title={t.sort_hint}>
                      {c.icon && (
                        <img className="sheet-h-icon" src={c.icon} alt="" aria-hidden="true"
                          onError={e => { e.currentTarget.style.display = 'none' }} />
                      )}
                      <span className="sheet-h-label">{c.header}</span>
                      <span className={`sheet-sort${s ? ' is-on' : ''}`} aria-hidden="true">
                        {s ? (s.desc ? '▼' : '▲') : '↕'}{order && <sup>{order}</sup>}
                      </span>
                    </button>
                    <span className="sheet-resize" onMouseDown={e => startResize(e, c)}
                      onDoubleClick={() => resetWidth(c)} title={t.resize_hint} />
                  </th>
                )
              })}
            </tr>
            {showFilters && (
              <tr className="sheet-filters">
                <th className="sheet-rownum-h" aria-hidden="true">▾</th>
                {cols.map((c, i) => (
                  <th key={c.id} className={frozenCls(i).trim()} style={frozenStyle(i)}>
                    <input type="text" value={filters[c.id] ?? ''} placeholder={t.filter_ph}
                      title={NUMERIC.has(c.type) ? t.filter_help_num : t.filter_help_text}
                      aria-label={`${t.filters} ${c.header}`}
                      className={filters[c.id] ? 'is-on' : ''}
                      onChange={e => setFilters(f => ({ ...f, [c.id]: e.target.value }))} />
                  </th>
                ))}
              </tr>
            )}
          </thead>
          <tbody>
            {view.length === 0 && (
              <tr>
                <td className="sheet-rownum" />
                <td className="sheet-empty" colSpan={cols.length}>
                  {dirty ? (
                    <>{t.no_match} <button type="button" className="sheet-link" onClick={reset}>{t.reset}</button></>
                  ) : (emptyText ?? t.empty)}
                </td>
              </tr>
            )}
            {view.map((row, ri) => {
              const rowSel = range && ri >= range.r0 && ri <= range.r1
              return (
                <tr key={rowKey ? rowKey(row, ri) : ri}>
                  <th scope="row" className={`sheet-rownum${rowSel ? ' is-hl' : ''}`}
                    onMouseDown={e => selectRow(e, ri)}>{ri + 1}</th>
                  {cols.map((c, ci) => {
                    const v = c.value(row)
                    const text = format(v, c.type)
                    const sel = inRange(range, ri, ci)
                    const active = focus && focus.row === ri && focus.col === ci
                    const tone = c.tone ? c.tone(v, row) : null
                    const cls = `sheet-c${NUMERIC.has(c.type) ? ' is-num' : ''}${tone ? ` tone-${tone}` : ''}`
                      + `${sel ? ' is-sel' : ''}${active ? ' is-active' : ''}${frozenCls(ci)}`
                    return (
                      <td key={c.id} data-cell={`${ri}:${ci}`} role="gridcell" aria-selected={sel || undefined}
                        className={cls} style={frozenStyle(ci)} title={text}
                        onMouseDown={e => onCellDown(e, ri, ci)} onMouseEnter={() => onCellEnter(ri, ci)}
                        onDoubleClick={onRowOpen ? () => onRowOpen(row) : undefined}>
                        {c.bar && typeof v === 'number' && (
                          <span className="sheet-bar" style={{ width: `${Math.max(0, Math.min(100, v * 100))}%` }} />
                        )}
                        <span className="sheet-c-txt">{c.render ? c.render(v, row) : text}</span>
                      </td>
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
          {hasTotals && view.length > 0 && (
            <tfoot>
              <tr>
                <th className="sheet-rownum">Σ</th>
                {cols.map((c, i) => (
                  <td key={c.id} className={`sheet-total${NUMERIC.has(c.type) ? ' is-num' : ''}${frozenCls(i)}`}
                    style={frozenStyle(i)}>
                    {i === 0 && totals[0] == null ? t.total : format(totals[i], c.type)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── barre d'état ── */}
      <div className="sheet-status">
        <span>{selection && selection.cells > 1 ? address : (onRowOpen && openHint) || t.ready}</span>
        <span className="sheet-status-agg">
          {selection && selection.cells > 1 && (
            <>
              {selection.avg != null && <span>{t.avg} : <b>{fmtAgg(selection.avg, 'avg')}</b></span>}
              <span>{t.count} : <b>{selection.count}</b></span>
              {selection.sum != null && selection.type !== 'percent' && <span>{t.sum} : <b>{fmtAgg(selection.sum, 'sum')}</b></span>}
              {selection.min != null && <span>{t.min} : <b>{fmtAgg(selection.min, 'min')}</b></span>}
              {selection.max != null && <span>{t.max} : <b>{fmtAgg(selection.max, 'max')}</b></span>}
            </>
          )}
        </span>
        <span>{t.rows.replace('{n}', view.length).replace('{m}', rows.length)}</span>
      </div>
    </div>
  )
}
