const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet',
  'août', 'septembre', 'octobre', 'novembre', 'décembre']

/** « 14 septembre 2026 ». */
export function dateLongue(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d)) return ''
  return `${d.getDate()} ${MOIS[d.getMonth()]} ${d.getFullYear()}`
}

/** « du 14 au 18 septembre 2026 », en evitant de repeter le mois. */
export function periodeLongue(debut, fin) {
  if (!debut || !fin) return ''
  const d = new Date(debut)
  const f = new Date(fin)
  if (Number.isNaN(d) || Number.isNaN(f)) return ''
  if (d.getMonth() === f.getMonth() && d.getFullYear() === f.getFullYear()) {
    return `du ${d.getDate()} au ${f.getDate()} ${MOIS[f.getMonth()]} ${f.getFullYear()}`
  }
  return `du ${dateLongue(debut)} au ${dateLongue(fin)}`
}
