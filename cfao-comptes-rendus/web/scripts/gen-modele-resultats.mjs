// Fabrique public/modeles/resultats.xlsx : le classeur « Résultats … » d'un
// formateur, vidé de ses noms et de ses notes (jamais versionnés), avec sa
// mise en forme, ses formules et ses mises en forme conditionnelles.
//
//   node scripts/gen-modele-resultats.mjs "<chemin du classeur Résultats>"
import ExcelJS from 'exceljs'

const [, , source] = process.argv
if (!source) {
  console.error('Usage : node scripts/gen-modele-resultats.mjs "<classeur Résultats>"')
  process.exit(1)
}
const wb = new ExcelJS.Workbook()
await wb.xlsx.readFile(source)
const ws = wb.worksheets[0]
ws.getCell('B2').value = null
for (let r = 5; r <= 17; r++) {
  for (const c of ['C', 'D', 'E', 'G', 'I']) ws.getCell(`${c}${r}`).value = null
  ws.getCell(`B${r}`).value = r - 4
}
ws.name = 'Résultats'
await wb.xlsx.writeFile(new URL('../public/modeles/resultats.xlsx', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'))
console.log('Modèle écrit.')
