/** Navigation interne — détail PIF technicien (réplique Define React). */

export function serializeCardOriginRect(rect) {
  if (!rect) return null
  return {
    top: rect.top,
    left: rect.left,
    width: rect.width,
    height: rect.height,
  }
}

export function resolveTechnicianPifDetailPath(technician) {
  const key = technician?.id ?? technician?.username
  if (!key) return null
  return `/portail/technicien/${encodeURIComponent(String(key))}/pif`
}

export function openTechnicianPifDetail(navigate, technician, event) {
  event?.preventDefault?.()
  event?.stopPropagation?.()
  const path = resolveTechnicianPifDetailPath(technician)
  if (!path) return
  const rect = serializeCardOriginRect(event?.currentTarget?.getBoundingClientRect?.())
  navigate(path, { state: { originRect: rect } })
}
