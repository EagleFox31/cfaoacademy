/**
 * Phrase d'un point à traiter de la clé (gabarits `review_<issue>` de costKey.json).
 * Module léger : le portail l'emploie pour sa cloche sans charger les écrans de la clé.
 */
export function reviewText(t, locale, i) {
  const template = t[`review_${i.issue}`]
  if (!template) return null
  const day = d => new Date(`${d}T12:00:00`).toLocaleDateString(locale)
  return template.replace('{assignee}', i.assignee).replace('{code}', i.code).replace('{country}', i.country_label)
    .replace('{seats}', i.seats).replace('{end}', day(i.end_date)).replace('{start}', day(i.start_date))
}
