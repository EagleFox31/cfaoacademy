/**
 * Libellé relatif « Mis à jour il y a X … » pour les sections portail.
 */
export function formatPortalUpdatedAgo(date, t) {
  if (!date) return t.data_updating

  const diffMs = Date.now() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)

  if (diffMin < 1) return t.data_updated_now
  if (diffMin < 60) {
    return t.data_updated_ago_min.replace('{n}', String(diffMin))
  }

  const diffHours = Math.floor(diffMin / 60)
  if (diffHours < 24) {
    return t.data_updated_ago_hours.replace('{n}', String(diffHours))
  }

  const diffDays = Math.floor(diffHours / 24)
  return t.data_updated_ago_days.replace('{n}', String(diffDays))
}
