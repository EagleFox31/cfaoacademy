export function encodeCataloguePath(folder, file) {
  const encodedFolder = folder.split('/').map(encodeURIComponent).join('/')
  return `/catalogues/${encodedFolder}/${encodeURIComponent(file)}`
}

/** `fileEn` optionnel — repli sur `file` si absent ou locale fr. */
export function cataloguePdfUrl(entry, locale = 'fr') {
  if (!entry?.folder || !entry?.file) return null
  const file = locale === 'en' && entry.fileEn ? entry.fileEn : entry.file
  return encodeCataloguePath(entry.folder, file)
}
