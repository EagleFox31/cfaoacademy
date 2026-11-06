/**
 * Logique pure de la grille type tableur : lettres de colonnes, filtres à la
 * manière d'Excel, agrégats de la barre d'état, conversion presse-papier.
 * Aucun import React : testable seul (sheetMath.test.js).
 */

/** 0 -> A, 25 -> Z, 26 -> AA (comme les en-têtes d'Excel). */
export function colLetter(index) {
  let n = index + 1
  let out = ''
  while (n > 0) {
    const r = (n - 1) % 26
    out = String.fromCharCode(65 + r) + out
    n = Math.floor((n - 1) / 26)
  }
  return out
}

/** Adresse d'une cellule : (0, 0) -> A1. */
export function cellAddress(col, row) {
  return `${colLetter(col)}${row + 1}`
}

const NUM_RE = /^-?\d+(?:[.,]\d+)?$/

function toNumber(raw) {
  const s = String(raw).trim().replace(/\s/g, '').replace('%', '')
  if (!NUM_RE.test(s)) return null
  return Number(s.replace(',', '.'))
}

/**
 * Filtre saisi par l'utilisateur, sur une colonne :
 *   texte        -> « contient » (sans casse ni accents)
 *   >10  >=10  <5  <=5  =3  <>3   -> comparaison numérique
 *   10..20       -> entre deux bornes incluses
 *   vide / (vide) -> cellules vides
 * Pour une colonne en pourcentage, « >80 » se lit 80 % (on compare à la valeur × 100).
 * Renvoie null si le filtre est vide (aucun filtrage).
 */
export function parseFilter(expr, { percent = false } = {}) {
  const raw = String(expr ?? '').trim()
  if (!raw) return null
  const scale = v => (percent && v != null ? v * 100 : v)

  if (/^\(?vide\)?$|^\(?empty\)?$/i.test(raw)) {
    return v => v == null || v === ''
  }
  const range = raw.match(/^(-?[\d.,]+)\s*\.\.\s*(-?[\d.,]+)$/)
  if (range) {
    const lo = toNumber(range[1])
    const hi = toNumber(range[2])
    if (lo != null && hi != null) {
      return v => typeof v === 'number' && scale(v) >= lo && scale(v) <= hi
    }
  }
  const cmp = raw.match(/^(>=|<=|<>|!=|>|<|=)\s*(.+)$/)
  if (cmp) {
    const target = toNumber(cmp[2])
    if (target != null) {
      const ops = {
        '>': (a, b) => a > b, '<': (a, b) => a < b, '>=': (a, b) => a >= b,
        '<=': (a, b) => a <= b, '=': (a, b) => a === b, '<>': (a, b) => a !== b,
        '!=': (a, b) => a !== b,
      }
      const op = ops[cmp[1]]
      return v => typeof v === 'number' && op(scale(v), target)
    }
  }
  const needle = fold(raw)
  return v => v != null && fold(v).includes(needle)
}

/** Minuscules sans accents : « Côte » trouve « cote ». */
export function fold(value) {
  return String(value).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
}

/** Agrégats de la barre d'état (comme le bas de la fenêtre Excel). */
export function aggregate(values) {
  const filled = values.filter(v => v != null && v !== '')
  const nums = filled.filter(v => typeof v === 'number' && Number.isFinite(v))
  if (!nums.length) return { count: filled.length, numCount: 0, sum: null, avg: null, min: null, max: null }
  const sum = nums.reduce((a, b) => a + b, 0)
  return {
    count: filled.length,
    numCount: nums.length,
    sum,
    avg: sum / nums.length,
    min: Math.min(...nums),
    max: Math.max(...nums),
  }
}

/** Matrice -> texte tabulé, collable tel quel dans Excel. */
export function toTSV(matrix) {
  return matrix
    .map(row => row.map(cell => {
      if (cell == null) return ''
      const s = String(cell)
      return /[\t\n"]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }).join('\t'))
    .join('\n')
}

/** Rectangle normalisé entre deux coins {row, col}. */
export function normRange(a, b) {
  if (!a) return null
  const end = b ?? a
  return {
    r0: Math.min(a.row, end.row), r1: Math.max(a.row, end.row),
    c0: Math.min(a.col, end.col), c1: Math.max(a.col, end.col),
  }
}

export function inRange(range, row, col) {
  return !!range && row >= range.r0 && row <= range.r1 && col >= range.c0 && col <= range.c1
}

/** Teinte de couverture : rouge sous 50 %, ambre sous 80 %, vert au-delà. */
export function coverageTone(ratio) {
  if (ratio == null) return null
  if (ratio < 0.5) return 'low'
  if (ratio < 0.8) return 'mid'
  return 'high'
}
