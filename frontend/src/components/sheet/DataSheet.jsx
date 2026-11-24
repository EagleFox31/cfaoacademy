/**
 * Grille de lecture « comme Excel », sans dépendance :
 *   lettres de colonnes et numéros de lignes, barre de formule (adresse + valeur),
 *   tri (Maj+clic : tri secondaire), filtre par colonne (texte, >10, 10..20, (vide)),
 *   recherche (Ctrl+F), volets figés, largeur ajustable (double-clic : largeur d'origine),
 *   choix des colonnes, ligne de totaux, sélection à la souris ou au clavier
 *   (Maj+flèches, Ctrl+flèches, Ctrl+A), barre d'état Moyenne / Nombre / Somme / Min / Max,
 *   copie Ctrl+C collable dans Excel, export CSV, mise en forme conditionnelle.
 *
 * Colonne : { id, header, group?, groupIcon?, type: text|int|money|percent|date, value(row),
 *             width?, total?: 'sum' | (rows) => valeur, tone?(v, row), bar?, unit?, render?(v, row),
 *             hidden?, edit?, formula?(row) }
 *   formula : texte du calcul d'une cellule calculée, montré dans la barre fx après la valeur.
 * Saisie (avec onCellCommit et un rowKey stable, indépendant de l'index) :
 *   edit : { input: number|date|text, raw(row), can?(row), min?, max?, hint? }.
 *   F2, Entrée ou double-clic ouvrent la cellule ; Entrée valide et descend, Tab passe à la
 *   suivante, Échap annule, quitter la cellule valide. La valeur lue à l'ouverture part avec
 *   la saisie : c'est elle qui permet au serveur de détecter une modification concurrente.
 *   cellError?(row, col) : message d'erreur à porter sur la cellule (état tenu par le parent).
 *   Recopie comme Excel : la poignée du coin bas-droit, tirée vers le haut ou le bas, copie la
 *   valeur dans les cellules saisissables de la même colonne ; Ctrl+D recopie la 1re ligne de
 *   la sélection vers le bas. onCellsCommit?(items) reçoit le lot ({ row, col, value, base }),
 *   sinon chaque cellule passe par onCellCommit. Double-clic sur la poignée : jusqu'en bas.
 *   Ctrl+V colle un bloc (Excel ou la grille) dans les cellules saisissables ; Ctrl+Z annule
 *   la dernière écriture (le serveur refuse si la cellule a changé depuis). onCellCommit et
 *   onCellsCommit peuvent renvoyer false (par item pour le lot) : écriture refusée.
 */
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSettle } from './useSettle'
import useLocale from '../../hooks/useLocale'
import { aggregate, cellAddress, cellDraft, colLetter, fold, fromTSV, isRowSelected, mergeSpans, normRange, parseCellInput, parseFilter, parsePasted, sameCell, spanInRange, toTSV } from './sheetMath'
import { cellText, columnTitle, downloadBlob, makeFormatter, toCsv } from './sheetExport'

/** Unité affichée à côté du nombre ; le presse-papier et le CSV gardent le nombre seul. */
const withUnit = (text, unit) => (unit && text ? <>{text} <small className="sheet-unit">{unit}</small></> : text)

const ROWNUM_W = 44
const ROWNUM_CHECK_W = 58 // avec la case à cocher de la ligne
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

/** Champ de saisie : son brouillon reste local, la grille ne se redessine pas à chaque frappe. */
function CellInput({ edit, initial, label, invalidText, onDone, options }) {
  const [draft, setDraft] = useState(initial)
  const [invalid, setInvalid] = useState(false)
  const ref = useRef(null)
  const closed = useRef(false)
  const viaKey = useRef(false) // au clavier, les flèches parcourent la liste sans valider

  useEffect(() => { ref.current?.focus(); ref.current?.select?.() }, [])

  const close = (outcome, move) => {
    if (closed.current) return
    closed.current = true
    onDone(outcome, move)
  }
  const submit = move => {
    const parsed = parseCellInput(draft, edit)
    if (parsed.ok) close(parsed, move)
    else setInvalid(true)
  }
  const onKeyDown = e => {
    e.stopPropagation() // flèches, Ctrl+A, Ctrl+C : ils agissent sur le texte, pas sur la grille
    if (e.key === 'Enter') { e.preventDefault(); submit({ row: 1, col: 0 }) }
    else if (e.key === 'Tab') { e.preventDefault(); submit({ row: 0, col: e.shiftKey ? -1 : 1 }) }
    else if (e.key === 'Escape') { e.preventDefault(); close(null, { row: 0, col: 0 }) }
  }
  const onBlur = () => {
    if (document.hasFocus?.() === false) return // changement de fenêtre : la saisie continue au retour
    const parsed = parseCellInput(draft, edit)
    close(parsed.ok ? parsed : null, null)
  }
  const stop = e => e.stopPropagation()
  if (options) {
    return (
      <select ref={ref} className="sheet-edit" aria-label={label} value={draft}
        onChange={e => {
          const { value } = e.target
          setDraft(value)
          if (!viaKey.current) close(parseCellInput(value, edit), { row: 0, col: 0 })
        }}
        onKeyDown={e => { viaKey.current = true; onKeyDown(e) }} onBlur={onBlur}
        onMouseDown={stop} onClick={stop} onDoubleClick={stop}>
        <option value="">—</option>
        {options.map(o => <option key={o} value={o}>{o}</option>)}
      </select>
    )
  }
  return (
    <input ref={ref} className={`sheet-edit${invalid ? ' is-invalid' : ''}`} aria-label={label}
      aria-invalid={invalid || undefined} title={invalid ? invalidText : undefined}
      type={edit.input === 'date' ? 'date' : 'text'} inputMode={edit.input === 'number' ? 'numeric' : undefined}
      value={draft} onChange={e => { setDraft(e.target.value); setInvalid(false) }}
      onKeyDown={onKeyDown} onBlur={onBlur}
      onMouseDown={stop} onClick={stop} onDoubleClick={stop} />
  )
}

/** Dans une cellule fusionnée, la ligne qui se trouve sous le pointeur. */
const rowInSpan = (e, span) => {
  const box = e.currentTarget.getBoundingClientRect()
  if (span < 2 || !box.height) return 0
  return Math.min(span - 1, Math.max(0, Math.floor((e.clientY - box.top) / (box.height / span))))
}

export default function DataSheet({
  id, columns, rows, rowKey, frozen = 1, onRowOpen, filterControls, filtersTarget, hideSearch = false, exportRef, controlsActive = false, onClearControls,
  exportName = 'export', emptyText, openHint, simple = false, rowClass, revealKey = 0,
  onCellCommit, onCellsCommit, cellError, onViewChange, formulaAction,
}) {
  // formulaAction { label, onClick } : lien affiché dans la barre fx à côté d'une formule
  // (ex. « Modifier les tarifs » quand la formule dépend de réglages saisis ailleurs).
  // simple : lecteur pressé. Ni barre de formule, ni lettres de colonnes, ni
  // réglages de tableur ; la ligne de filtres reste à ouvrir à la demande.
  const { t, locale } = useLocale('sheet')
  const format = useMemo(() => makeFormatter(locale), [locale])
  const prefs0 = useMemo(() => loadPrefs(id), [id])

  const [hidden, setHidden] = useState(
    () => new Set(prefs0.hidden ?? columns.filter(c => c.hidden).map(c => c.id)))
  const [widths, setWidths] = useState(prefs0.widths ?? {})
  const showFilters = !simple
  const rowHeadW = simple ? ROWNUM_W : ROWNUM_CHECK_W
  const [sort, setSort] = useState([])
  const [filters, setFilters] = useState({})
  const [search, setSearch] = useState('')
  const [anchor, setAnchor] = useState(null)
  const [focus, setFocus] = useState(null)
  const [colsAt, setColsAt] = useState(null) // position du panneau des colonnes, null s'il est fermé
  const [checked, setChecked] = useState(() => new Set())
  const [copied, setCopied] = useState(false)
  const [editing, setEditing] = useState(null) // { id, row, col, base }
  const [saving, setSaving] = useState({}) // id de cellule -> valeur en cours d'envoi
  const [fill, setFill] = useState(null) // poignée tirée : { ci, r0, r1, to }
  const fillRef = useRef(null)
  // Recherche, filtre de colonne ou tri : bref squelette sur le corps du tableau.
  const settling = useSettle([search, filters, sort])
  const gridRef = useRef(null)
  const searchRef = useRef(null)
  const colsRef = useRef(null)
  const colsBtn = useRef(null)
  const dragging = useRef(false)

  useEffect(() => {
    savePrefs(id, { hidden: [...hidden], widths })
  }, [id, hidden, widths])

  // Demande extérieure d'afficher la ligne .is-focus : la recherche et les filtres
  // de colonne sont retirés, puis la ligne revient à l'écran une fois le corps rendu.
  useEffect(() => {
    if (revealKey) { setFilters({}); setSearch('') }
  }, [revealKey])
  useEffect(() => {
    if (revealKey && !settling) gridRef.current?.querySelector('tr.is-focus')?.scrollIntoView?.({ block: 'center' })
  }, [revealKey, settling])

  // Panneau Colonnes : colonnes adjacentes de même groupe réunies sous le nom du groupe.
  const colSections = useMemo(() => {
    const out = []
    for (const c of columns) {
      const last = out[out.length - 1]
      if (last && last.group === (c.group ?? '')) last.cols.push(c)
      else out.push({ group: c.group ?? '', icon: c.groupIcon, cols: [c] })
    }
    return out
  }, [columns])

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

  // Le parent cale ses indicateurs sur les lignes affichées, avant peinture : jamais d'ancien chiffre.
  useLayoutEffect(() => { onViewChange?.(view) }, [view, onViewChange])

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
      ?.querySelector(`[data-cell="${focus.row}:${focus.col}"]`) // absente sur une ligne fusionnée
      ?.scrollIntoView({ block: 'nearest', inline: 'nearest' })
  }, [focus])

  useEffect(() => {
    const up = () => { dragging.current = false }
    window.addEventListener('mouseup', up)
    return () => window.removeEventListener('mouseup', up)
  }, [])

  useEffect(() => {
    if (!colsAt) return undefined
    const close = e => {
      if (!colsRef.current?.contains(e.target) && !colsBtn.current?.contains(e.target)) setColsAt(null)
    }
    const onEsc = e => {
      if (e.key !== 'Escape') return
      setColsAt(null)
      colsBtn.current?.focus()
    }
    document.addEventListener('mousedown', close)
    document.addEventListener('keydown', onEsc)
    return () => {
      document.removeEventListener('mousedown', close)
      document.removeEventListener('keydown', onEsc)
    }
  }, [colsAt])

  const toggleCols = e => {
    const btn = e.currentTarget.getBoundingClientRect()
    const box = e.currentTarget.closest('.sheet').getBoundingClientRect()
    setColsAt(at => (at ? null : { top: btn.bottom - box.top + 4, left: btn.left - box.left }))
  }

  // Lignes cochées : elles seules partent dans la copie et le CSV. La clé ne dépend ni du tri
  // ni des filtres, pour qu'une case reste sur sa ligne.
  const rowIndex = useMemo(() => new Map(rows.map((r, i) => [r, i])), [rows])
  const checkKey = row => (rowKey ? rowKey(row, rowIndex.get(row)) : row)
  const isChecked = row => checked.has(checkKey(row))
  const checkedRows = view.filter(isChecked)
  const allChecked = view.length > 0 && checkedRows.length === view.length
  // Cocher remplace la sélection de cellules : la copie suit toujours le dernier geste.
  const pickRows = next => {
    setAnchor(null)
    setFocus(null)
    setChecked(next)
  }
  const toggleCheck = row => {
    const next = new Set(checked)
    if (!next.delete(checkKey(row))) next.add(checkKey(row))
    pickRows(next)
  }
  const toggleAll = () => pickRows(new Set(allChecked ? [] : view.map(checkKey)))

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
      matrix = [cols.map(columnTitle),
        ...(checkedRows.length ? checkedRows : view).map(r => cols.map(c => cellText(c.value(r), c.type, locale, format)))]
    }
    try {
      await navigator.clipboard.writeText(toTSV(matrix))
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch { /* presse-papier refusé par le navigateur */ }
  }

  const exportCsv = () => {
    downloadBlob(new Blob([toCsv({ columns: cols, rows: checkedRows.length ? checkedRows : view, locale, format })],
      { type: 'text/csv;charset=utf-8' }), `${exportName}.csv`)
  }
  // exportRef : la page propose le CSV dans son propre menu d'export, à la place du bouton.
  useLayoutEffect(() => { if (exportRef) exportRef.current = exportCsv })

  // ── saisie ───────────────────────────────────────────────────────────────
  const editId = (row, ri, c) => `${rowKey ? rowKey(row, ri) : ri}|${c.id}`
  const canEdit = (row, ri, c) => Boolean(
    onCellCommit && c.edit && (!c.edit.can || c.edit.can(row)) && !(editId(row, ri, c) in saving))

  const openEdit = (ri, ci) => {
    const row = view[ri]
    const c = cols[ci]
    if (!row || !c || !canEdit(row, ri, c)) return false
    setEditing({ id: editId(row, ri, c), row, col: c, base: c.edit.raw(row), at: { row: ri, col: ci } })
    return true
  }

  // ── écritures par lot (recopie, collage, annulation) ───────────────────
  // Item : { id, row, col, value, base }. onCellsCommit peut renvoyer un booléen par item,
  // onCellCommit un booléen : false = refusé, l'écriture n'entre pas dans l'historique.
  const history = useRef([]) // Ctrl+Z : les 20 dernières écritures, la plus récente à la fin
  const remember = items => {
    history.current = [...history.current.slice(-19),
      items.map(i => ({ id: i.id, row: i.row, col: i.col, value: i.base, base: i.value }))]
  }
  const commitItems = async (items, { undoable = true } = {}) => {
    if (!items.length) return
    setSaving(s => ({ ...s, ...Object.fromEntries(items.map(i => [i.id, i.value])) }))
    let results
    try {
      if (onCellsCommit) results = await onCellsCommit(items.map(({ id: _id, ...item }) => item))
      else {
        results = []
        for (const i of items) results.push(await onCellCommit(i.row, i.col, i.value, i.base)) // eslint-disable-line no-await-in-loop
      }
    } finally {
      const ids = new Set(items.map(i => i.id))
      setSaving(s => Object.fromEntries(Object.entries(s).filter(([k]) => !ids.has(k))))
    }
    const done = items.filter((_, k) => !Array.isArray(results) || results[k] !== false)
    if (undoable && done.length) remember(done)
  }
  // Annuler : on renvoie l'ancienne valeur en attendant celle qu'on a écrite ; si quelqu'un l'a
  // changée entre-temps, le serveur refuse et le parent affiche le conflit (rien n'est écrasé).
  const undo = () => {
    const last = history.current.pop()
    if (last) commitItems(last, { undoable: false })
  }

  const finishEdit = async (outcome, move) => {
    const cur = editing
    setEditing(null)
    if (move) {
      let row = cur.at.row + move.row
      // Entrée sur une cellule fusionnée : on passe à la ligne qui suit toute la fusion.
      const key = cur.col.merge ? (cur.col.mergeKey ?? cur.col.value) : null
      const k0 = key ? key(cur.row) : null
      if (move.row > 0 && k0 != null && k0 !== '') {
        while (row <= lastR && key(view[row]) === k0) row += 1
      }
      const next = clamp(row, cur.at.col + move.col)
      setAnchor(next)
      setFocus(next)
      gridRef.current?.focus({ preventScroll: true })
    }
    if (!outcome || sameCell(outcome.value, cur.base)) return
    setSaving(s => ({ ...s, [cur.id]: outcome.value }))
    let ok
    try {
      ok = await onCellCommit(cur.row, cur.col, outcome.value, cur.base)
    } finally {
      setSaving(({ [cur.id]: _done, ...rest }) => rest)
    }
    if (ok !== false) remember([{ id: cur.id, row: cur.row, col: cur.col, value: outcome.value, base: cur.base }])
  }

  // Coller (Ctrl+V) depuis Excel ou la grille : le bloc part de la 1re cellule de la sélection ;
  // une seule valeur collée remplit toute la sélection. Cellules non saisissables ignorées.
  const onPaste = e => {
    if (!onCellCommit || editing || !range) return
    const text = e.clipboardData?.getData('text/plain')
    if (!text) return
    e.preventDefault()
    const matrix = fromTSV(text)
    const single = matrix.length === 1 && matrix[0].length === 1
    const h = single ? range.r1 - range.r0 + 1 : matrix.length
    const w = single ? range.c1 - range.c0 + 1 : Math.max(...matrix.map(l => l.length))
    const items = []
    let refused = 0
    for (let dr = 0; dr < h; dr += 1) {
      for (let dc = 0; dc < w; dc += 1) {
        const ri = range.r0 + dr
        const row = view[ri]
        const c = cols[range.c0 + dc]
        const raw = single ? matrix[0][0] : matrix[dr][dc]
        if (!row || !c || raw == null || !canEdit(row, ri, c)) continue
        const parsed = parsePasted(raw, c.edit, c.edit.options?.(row))
        if (!parsed.ok) { refused += 1; continue }
        const base = c.edit.raw(row)
        if (!sameCell(parsed.value, base)) items.push({ id: editId(row, ri, c), row, col: c, value: parsed.value, base })
      }
    }
    setAnchor({ row: range.r0, col: range.c0 })
    setFocus(clamp(range.r0 + h - 1, range.c0 + w - 1))
    if (refused) {
      setCopied(t.paste_refused.replace('{n}', refused))
      setTimeout(() => setCopied(false), 4000)
    }
    commitItems(items)
  }

  // ── recopie (poignée, Ctrl+D) ───────────────────────────────────────────
  // Source : une seule colonne, saisissable, une seule valeur (une cellule fusionnée en compte plusieurs).
  const fillSource = (() => {
    if (!onCellCommit || editing || !range || range.c0 !== range.c1) return null
    const c = cols[range.c0]
    const first = view[range.r0]
    if (!c?.edit || !first || !canEdit(first, range.r0, c)) return null
    const value = c.edit.raw(first)
    for (let r = range.r0 + 1; r <= range.r1; r += 1) {
      if (!sameCell(c.edit.raw(view[r]), value)) return null
    }
    return { ci: range.c0, r0: range.r0, r1: range.r1, value }
  })()

  const fillCells = async (ci, value, from, to) => {
    const c = cols[ci]
    const items = []
    for (let ri = from; ri <= to; ri += 1) {
      const row = view[ri]
      if (!row || !canEdit(row, ri, c)) continue
      const base = c.edit.raw(row)
      if (!sameCell(value, base)) items.push({ id: editId(row, ri, c), row, col: c, value, base })
    }
    return commitItems(items)
  }
  // Double-clic sur la poignée : recopie jusqu'à la dernière ligne affichée.
  const fillDown = e => {
    e.stopPropagation()
    if (!fillSource || fillSource.r1 >= lastR) return
    setAnchor({ row: fillSource.r0, col: fillSource.ci })
    setFocus({ row: lastR, col: fillSource.ci })
    fillCells(fillSource.ci, fillSource.value, fillSource.r1 + 1, lastR)
  }

  const endFill = useRef(null)
  endFill.current = () => {
    const f = fillRef.current
    fillRef.current = null
    setFill(null)
    if (!f) return
    const [from, to] = f.to > f.r1 ? [f.r1 + 1, f.to] : f.to < f.r0 ? [f.to, f.r0 - 1] : [null, null]
    if (from == null) return
    setAnchor({ row: Math.min(from, f.r0), col: f.ci })
    setFocus({ row: Math.max(to, f.r1), col: f.ci })
    fillCells(f.ci, f.value, from, to)
  }
  const startFill = e => {
    if (e.button !== 0 || !fillSource) return
    e.preventDefault()
    e.stopPropagation()
    fillRef.current = { ...fillSource, to: fillSource.r1 }
    setFill(fillRef.current)
    window.addEventListener('mouseup', () => endFill.current(), { once: true })
  }
  const fillLo = fill ? Math.min(fill.r0, fill.to) : null
  const fillHi = fill ? Math.max(fill.r1, fill.to) : null

  const onKeyDown = e => {
    const mod = e.ctrlKey || e.metaKey
    const k = e.key.toLowerCase()
    if (mod && k === 'f' && searchRef.current) { e.preventDefault(); searchRef.current.focus(); return }
    if (mod && k === 'c') { e.preventDefault(); copy(); return }
    if (mod && k === 'a') { e.preventDefault(); selectAll(); return }
    if (mod && k === 'z' && !e.shiftKey && onCellCommit && !editing) { e.preventDefault(); undo(); return }
    if (mod && k === 'd' && onCellCommit && !editing && range && range.c0 === range.c1 && range.r1 > range.r0) {
      const c = cols[range.c0]
      const first = view[range.r0]
      if (c?.edit && first && canEdit(first, range.r0, c)) {
        e.preventDefault()
        fillCells(range.c0, c.edit.raw(first), range.r0 + 1, range.r1)
      }
      return
    }
    if (e.target.matches('button, input[type="checkbox"]')) return // Entrée, Espace et flèches restent aux contrôles
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
      case 'F2':
        if (focus && openEdit(focus.row, focus.col)) e.preventDefault()
        return
      case 'Enter':
        if (focus && openEdit(focus.row, focus.col)) { e.preventDefault(); return }
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

  // La colonne en cours de saisie se dé-fusionne : chaque ligne y a sa propre valeur.
  const editingCol = editing?.col.id
  const spansByCol = useMemo(() => new Map(
    cols.filter(c => c.merge && c.id !== editingCol)
      .map(c => [c.id, mergeSpans(view.map(r => (c.mergeKey ?? c.value)(r)))]),
  ), [cols, view, editingCol])

  const onCellDown = (e, row, col, rows = 1) => {
    if (e.button !== 0) return
    const cell = { row, col }
    if (e.shiftKey && anchor) setFocus({ row: row + rows - 1, col })
    else { setAnchor(cell); setFocus({ row: row + rows - 1, col }) }
    dragging.current = true
    gridRef.current?.focus({ preventScroll: true })
  }
  const onCellEnter = (row, col, rows = 1) => {
    const f = fillRef.current
    if (f) {
      // La recopie reste dans sa colonne ; vers le bas, une cellule fusionnée compte jusqu'à sa dernière ligne.
      const to = row > f.r1 ? row + rows - 1 : row
      if (to !== f.to) { fillRef.current = { ...f, to }; setFill(fillRef.current) }
      return
    }
    if (dragging.current) setFocus({ row, col })
  }

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

  const reset = () => { setSort([]); setFilters({}); setSearch(''); onClearControls?.() }
  const dirty = controlsActive || sort.length > 0 || search !== '' || Object.values(filters).some(Boolean)

  // ── volets figés : décalage gauche de chaque colonne figée ───────────────
  const lefts = []
  let acc = rowHeadW
  cols.forEach((c, i) => {
    lefts.push(i < frozen ? acc : null)
    if (i < frozen) acc += width(c)
  })
  const frozenCls = i => (lefts[i] != null ? ` is-frozen${i === frozen - 1 ? ' is-frozen-edge' : ''}` : '')
  const frozenStyle = (i, extra) => (lefts[i] != null ? { ...extra, left: lefts[i] } : extra)
  const tableWidth = cols.reduce((s, c) => s + width(c), rowHeadW)

  const groups = useMemo(() => {
    if (!cols.some(c => c.group)) return null
    const segs = []
    cols.forEach((c, i) => {
      const last = segs[segs.length - 1]
      if (c.group && last && last.group === c.group && i >= frozen) last.span += 1
      else segs.push({ group: c.group ?? '', icon: c.groupIcon, span: 1, start: i })
    })
    return segs
  }, [cols, frozen])
  // Trait vertical à chaque début de groupe, et à la première colonne qui suit le dernier.
  const groupStarts = useMemo(() => new Set((groups ?? [])
    .filter((g, i) => g.group || groups[i - 1]?.group).map(g => g.start)), [groups])
  const groupCls = i => (groupStarts.has(i) ? ' is-group-start' : '')

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
  const focusFormula = focusCol?.formula && focusRow ? focusCol.formula(focusRow) : null

  // filtersTarget : élément qui reçoit recherche et filtres quand ils pilotent aussi le reste
  // de la page (null tant qu'il n'est pas monté). Non fourni, ils restent dans la barre.
  const filtersOutside = filtersTarget !== undefined
  const colsLabel = hidden.size > 0
    ? `${t.columns_choose} (${columns.length - hidden.size}/${columns.length})`
    : t.columns_choose
  const filterTools = (
    <>
      {!hideSearch && (
        <label className="sheet-search">
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
            <circle cx="7" cy="7" r="4.6" fill="none" stroke="currentColor" strokeWidth="1.6" />
            <path d="M10.6 10.6L14 14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
          <input ref={searchRef} type="search" value={search} placeholder={t.search_ph}
            aria-label={t.search_ph} onChange={e => setSearch(e.target.value)} />
        </label>
      )}
      {filterControls}
      {dirty && <button type="button" className="sheet-btn sheet-btn-ghost" onClick={reset}>{t.reset}</button>}
    </>
  )

  return (
    <div className={`sheet${settling ? ' is-settling' : ''}`} aria-busy={settling || undefined}>
      {filtersOutside && filtersTarget && createPortal(
        <div className="sheet-toolbar" role="toolbar" aria-label={t.filter_tools}>{filterTools}</div>,
        filtersTarget,
      )}
      {/* ── barre d'outils : seulement s'il lui reste quelque chose à porter ── */}
      {(!filtersOutside || (!simple && !exportRef)) && (
        <div className="sheet-toolbar" role="toolbar" aria-label={t.toolbar}>
          {!filtersOutside && filterTools}
          <span className="sheet-toolbar-sep" />
          {!simple && !exportRef && <button type="button" className="sheet-btn" onClick={exportCsv}>{t.csv}</button>}
        </div>
      )}

      {/* Hors de la grille, qui défile et couperait le panneau. */}
      {colsAt && (
        <div ref={colsRef} className="sheet-pop-panel" style={colsAt} role="dialog" aria-label={t.columns}>
          <div className="sheet-pop-actions">
            <button type="button" onClick={() => setHidden(new Set())}>{t.show_all}</button>
          </div>
          {colSections.map(s => {
            const items = s.cols.map(c => (
              <label key={c.id} className="sheet-pop-item">
                <input type="checkbox" checked={!hidden.has(c.id)}
                  onChange={() => setHidden(h => {
                    const n = new Set(h)
                    if (n.has(c.id)) n.delete(c.id)
                    else n.add(c.id)
                    return n
                  })} />
                {c.header}
              </label>
            ))
            if (!s.group) return items
            return (
              <div key={s.cols[0].id} className="sheet-pop-group" role="group" aria-label={s.group}>
                <div className="sheet-pop-title">
                  {s.icon && (
                    <img className="sheet-h-icon" src={s.icon} alt="" aria-hidden="true"
                      onError={e => { e.currentTarget.style.display = 'none' }} />
                  )}
                  {s.group}
                </div>
                <div className="sheet-pop-row">{items}</div>
              </div>
            )
          })}
        </div>
      )}

      {/* ── barre de formule ── */}
      {!simple && (
        <div className="sheet-formula" aria-live="polite">
          <span className="sheet-namebox">{address || '—'}</span>
          <span className="sheet-fx">fx</span>
          <span className="sheet-formula-val">
            {focusCol && <b>{focusCol.group ? `${focusCol.group} · ${focusCol.header}` : focusCol.header} : </b>}
            {focusText}
            {focusFormula && <span className="sheet-formula-expr">{focusFormula}</span>}
          </span>
          {focusFormula && formulaAction && (
            <button type="button" className="sheet-formula-link" onClick={formulaAction.onClick}>
              {formulaAction.label}
            </button>
          )}
        </div>
      )}

      {/* ── grille ── */}
      <div className="sheet-scroll" ref={gridRef} tabIndex={0} role="grid"
        aria-rowcount={view.length} aria-colcount={cols.length} onKeyDown={onKeyDown} onPaste={onPaste}>
        <table className={`sheet-table${fill ? ' is-fill-drag' : ''}`} style={{ width: tableWidth }}>
          <colgroup>
            <col style={{ width: rowHeadW }} />
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
                  <th key={`${g.start}-${g.group}`} scope="colgroup" colSpan={g.span}
                    className={`sheet-group${g.group ? ' has-group' : ''}${groupCls(g.start)}${g.span === 1 ? frozenCls(g.start) : ''}`}
                    style={g.span === 1 ? frozenStyle(g.start) : undefined}>
                    {g.icon ? (
                      <span className="sheet-group-in">
                        <img className="sheet-h-icon" src={g.icon} alt="" aria-hidden="true" title={g.group}
                          onError={e => { e.currentTarget.style.display = 'none'; e.currentTarget.classList.add('is-broken') }} />
                        <span className="sheet-group-label">{g.group}</span>
                      </span>
                    ) : g.group}
                  </th>
                ))}
              </tr>
            )}
            <tr className="sheet-head">
              <th className="sheet-rownum-h">
                <span className="sheet-rownum-in">
                  {!simple && (
                    <label className="sheet-check" title={t.check_hint}>
                      <input type="checkbox" aria-label={t.check_all} checked={allChecked} disabled={!view.length}
                        ref={el => { if (el) el.indeterminate = checkedRows.length > 0 && !allChecked }}
                        onChange={toggleAll} />
                    </label>
                  )}
                  <button type="button" ref={colsBtn} className="sheet-cols-btn" aria-haspopup="dialog"
                    aria-expanded={Boolean(colsAt)} aria-label={colsLabel} title={colsLabel} onClick={toggleCols}>
                    <svg viewBox="0 0 16 16" width="15" height="15" aria-hidden="true" focusable="false">
                      <rect x="1.8" y="2.3" width="12.4" height="11.4" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.4" />
                      <path d="M6 2.5v11M10 2.5v11" stroke="currentColor" strokeWidth="1.4" />
                    </svg>
                    {hidden.size > 0 && <span className="sheet-cols-dot" />}
                  </button>
                </span>
              </th>
              {cols.map((c, i) => {
                const s = sort.find(x => x.id === c.id)
                const order = sort.length > 1 && s ? sort.indexOf(s) + 1 : null
                return (
                  <th key={c.id} scope="col"
                    aria-sort={s ? (s.desc ? 'descending' : 'ascending') : 'none'}
                    className={`sheet-h${NUMERIC.has(c.type) ? ' is-num' : ''}${groupCls(i)}${frozenCls(i)}`}
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
                <tr key={rowKey ? rowKey(row, ri) : ri}
                  className={[rowClass?.(row), isRowSelected(range, ri, lastR, lastC) && 'is-row-sel'].filter(Boolean).join(' ') || undefined}>
                  <th scope="row" className={`sheet-rownum${rowSel ? ' is-hl' : ''}${isChecked(row) ? ' is-checked' : ''}`}
                    onMouseDown={e => selectRow(e, ri)}>
                    {simple ? ri + 1 : (
                      <span className="sheet-rownum-in">
                        <label className="sheet-check" title={t.check_hint} onMouseDown={e => e.stopPropagation()}>
                          <input type="checkbox" aria-label={t.check_row.replace('{n}', ri + 1)}
                            checked={isChecked(row)} onChange={() => toggleCheck(row)} />
                        </label>
                        {ri + 1}
                      </span>
                    )}
                  </th>
                  {cols.map((c, ci) => {
                    const v = c.value(row)
                    const text = format(v, c.type)
                    const span = spansByCol.get(c.id)?.[ri] ?? 1
                    if (span === 0) return null
                    const sel = spanInRange(range, ri, span, ci)
                    const active = focus && focus.row >= ri && focus.row < ri + span && focus.col === ci
                    const tone = c.tone ? c.tone(v, row) : null
                    const cid = onCellCommit && c.edit ? editId(row, ri, c) : null
                    const isSaving = cid != null && cid in saving
                    const isEditing = cid != null && editing?.id === cid
                    const editable = cid != null && canEdit(row, ri, c)
                    const failure = editable && !isEditing ? cellError?.(row, c) : null
                    const shown = isSaving ? format(saving[cid], c.type) : text
                    const filling = fill && fill.ci === ci && ri <= fillHi && ri + span - 1 >= fillLo
                    // Poignée au coin bas-droit de la source, comme Excel.
                    const handle = !fill && fillSource && fillSource.ci === ci
                      && ri <= fillSource.r1 && ri + span - 1 >= fillSource.r1
                    const cls = `sheet-c${NUMERIC.has(c.type) ? ' is-num' : ''}${groupCls(ci)}${tone ? ` tone-${tone}` : ''}`
                      + `${sel ? ' is-sel' : ''}${active ? ' is-active' : ''}${c.merge ? ' is-merged' : ''}${c.openOnClick && onRowOpen ? ' is-openable' : ''}${frozenCls(ci)}`
                      + `${editable ? ' is-editable' : ''}${isSaving ? ' is-saving' : ''}${failure ? ' is-error' : ''}`
                      + `${filling ? ' is-filling' : ''}${handle ? ' has-fill' : ''}`
                    const tip = failure || (editable && c.edit.hint ? [text, c.edit.hint].filter(Boolean).join(' · ') : text)
                    return (
                      <td key={c.id} data-cell={`${ri}:${ci}`} role="gridcell" aria-selected={sel || undefined}
                        aria-busy={isSaving || undefined}
                        rowSpan={span > 1 ? span : undefined}
                        className={cls} style={frozenStyle(ci)} title={tip}
                        onMouseDown={e => onCellDown(e, ri, ci, span)} onMouseEnter={() => onCellEnter(ri, ci, span)}
                        onClick={c.openOnClick && onRowOpen ? e => {
                          // Une sélection au clavier ou un bouton de la cellule n'ouvrent pas la ligne.
                          if (!e.shiftKey && !e.ctrlKey && !e.metaKey && !e.target.closest('button, a')) onRowOpen(row)
                        } : undefined}
                        onDoubleClick={editable ? e => openEdit(ri + rowInSpan(e, span), ci) : (onRowOpen ? () => onRowOpen(row) : undefined)}>
                        {c.bar && typeof v === 'number' && (
                          <span className="sheet-bar" style={{ width: `${Math.max(0, Math.min(100, v * 100))}%` }} />
                        )}
                        {isEditing
                          ? <CellInput key={cid} edit={c.edit} initial={cellDraft(editing.base)} label={c.header}
                              invalidText={t.edit_invalid} onDone={finishEdit} options={c.edit.options?.(editing.row)} />
                          : <span className="sheet-c-txt">{c.render && !isSaving ? c.render(v, row) : withUnit(shown, c.unit)}</span>}
                        {handle && <span className="sheet-fill-handle" title={t.fill_hint} aria-hidden="true" onMouseDown={startFill} onDoubleClick={fillDown} />}
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
                  <td key={c.id} className={`sheet-total${NUMERIC.has(c.type) ? ' is-num' : ''}${groupCls(i)}${frozenCls(i)}`}
                    style={frozenStyle(i)}>
                    {i === 0 && totals[0] == null ? t.total : withUnit(format(totals[i], c.type), c.unit)}
                  </td>
                ))}
              </tr>
            </tfoot>
          )}
        </table>
      </div>

      {/* ── barre d'état ── */}
      <div className="sheet-status">
        <span>
          {copied ? (copied === true ? t.copied : copied) : selection && selection.cells > 1 ? address : checkedRows.length > 0 ? (
            <>
              {(checkedRows.length === 1 ? t.checked_one : t.checked_many).replace('{n}', checkedRows.length)}{' '}
              <button type="button" className="sheet-link" onClick={() => pickRows(new Set())}>{t.uncheck_all}</button>
            </>
          ) : ((onRowOpen || onCellCommit) && openHint) || t.ready}
        </span>
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
