/**
 * Formatage des cellules et sorties de la grille (presse-papier, CSV).
 * Les classeurs Excel « officiels » (volets figés, filtres, formules) sont
 * produits côté serveur ; ici on ne fait que ce qui se colle ou s'ouvre dans Excel.
 */

const TAGS = { fr: 'fr-FR', en: 'en-GB', pt: 'pt-PT' }

export function makeFormatter(locale) {
  const tag = TAGS[locale] ?? 'fr-FR'
  const int = new Intl.NumberFormat(tag, { maximumFractionDigits: 0 })
  const dec = new Intl.NumberFormat(tag, { maximumFractionDigits: 2 })
  const pct = new Intl.NumberFormat(tag, { style: 'percent', minimumFractionDigits: 1, maximumFractionDigits: 1 })
  return (value, type) => {
    if (value == null || value === '') return ''
    if (typeof value !== 'number') {
      if (type === 'date') {
        const d = new Date(`${value}T00:00:00`)
        return Number.isNaN(d.getTime()) ? String(value) : d.toLocaleDateString(tag)
      }
      return String(value)
    }
    if (type === 'percent') return pct.format(value)
    if (type === 'int' || type === 'money') return int.format(value)
    return dec.format(value)
  }
}

/**
 * Texte d'une cellule tel qu'Excel le relit : nombres bruts avec le séparateur
 * décimal de la langue, pourcentages formatés (« 60,0 % » est reconnu).
 */
export function cellText(value, type, locale, format) {
  if (value == null) return ''
  if (typeof value === 'number' && type !== 'percent') {
    return locale === 'en' ? String(value) : String(value).replace('.', ',')
  }
  return format(value, type)
}

export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** CSV de la vue (filtres et tri appliqués). « ; » en français, comme l'attend Excel. */
export function toCsv({ columns, rows, locale, format }) {
  const sep = locale === 'en' ? ',' : ';'
  const esc = s => (/[";,\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  const head = columns.map(c => esc(c.group ? `${c.group} · ${c.header}` : c.header)).join(sep)
  const body = rows.map(r => columns.map(c => esc(cellText(c.value(r), c.type, locale, format))).join(sep))
  return `﻿${[head, ...body].join('\r\n')}`
}
