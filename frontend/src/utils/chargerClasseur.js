/**
 * Ouvre un classeur Excel choisi par le formateur.
 *
 * Certains outils ecrivent les fichiers internes du classeur autrement
 * qu'Excel (cf. `lisible`). Excel les ouvre ; exceljs non :
 * il ne trouve alors plus le classeur (« Cannot read properties of
 * undefined (reading 'sheets') »). Dans ce cas, on les reecrit, puis
 * on relit.
 */
export async function chargerClasseur(fichier) {
  const { default: ExcelJS } = await import('exceljs')
  const octets = await fichier.arrayBuffer()
  try {
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(octets)
    return wb
  } catch (e) {
    const nettoye = await lisible(octets)
    if (!nettoye) throw e
    const wb = new ExcelJS.Workbook()
    await wb.xlsx.load(nettoye)
    return wb
  }
}

/**
 * Le classeur reecrit dans la forme qu'exceljs sait lire ; `null` s'il
 * n'y avait rien a reecrire. Deux ecarts, tous deux produits par les
 * outils qui generent des classeurs par programme :
 *   * une BOM en tete des fichiers XML ;
 *   * des balises prefixees (`<x:workbook>`, `<x:row>`) au lieu de
 *     l'espace de noms par defaut ;
 *   * des liens absolus (`/xl/comments1.xml`) entre fichiers internes ;
 *   * des commentaires dont le dessin porte un nom hors norme.
 */
/** `xl/comments1.xml` vu de `xl/worksheets` : `../comments1.xml`. */
function relatif(base, cible) {
  const de = base ? base.split('/') : []
  const vers = cible.split('/')
  let i = 0
  while (i < de.length && i < vers.length - 1 && de[i] === vers[i]) i++
  return [...de.slice(i).map(() => '..'), ...vers.slice(i)].join('/')
}

async function lisible(octets) {
  const { default: JSZip } = await import('jszip')
  const zip = await JSZip.loadAsync(octets)
  let reecrits = 0
  await Promise.all(Object.values(zip.files)
    .filter(f => !f.dir && /\.(xml|rels|vml)$/i.test(f.name))
    .map(async f => {
      const avant = await f.async('string')
      let texte = avant.charCodeAt(0) === 0xFEFF ? avant.slice(1) : avant
      const prefixe = /xmlns:(\w+)="http:\/\/schemas\.openxmlformats\.org\/spreadsheetml\/2006\/main"/
        .exec(texte)?.[1]
      if (prefixe) {
        texte = texte
          .replace(new RegExp(`(</?)${prefixe}:`, 'g'), '$1')
          .replace(`xmlns:${prefixe}=`, 'xmlns=')
      }
      if (f.name.endsWith('.rels')) {
        const base = f.name.replace(/(^|\/)_rels\/[^/]+$/, '')
        texte = texte.replace(/Target="\/([^"]+)"/g, (_, cible) => `Target="${relatif(base, cible)}"`)
          // Les commentaires de cellule ne servent pas a l'import, et leur
          // dessin nomme hors norme (vmldrawing.vml) bloque la lecture.
          .replace(/<Relationship\b[^>]*relationships\/(?:comments|vmlDrawing)"[^>]*\/>/g, '')
      }
      if (/^xl\/worksheets\/[^/]+\.xml$/.test(f.name)) texte = texte.replace(/<legacyDrawing\b[^>]*\/>/g, '')
      if (texte === avant) return
      zip.file(f.name, texte)
      reecrits++
    }))
  return reecrits ? zip.generateAsync({ type: 'arraybuffer' }) : null
}
