import { BAREMES, reglesAuSeuil, seuilDe } from './baremeCfao'
import { periodeCourte } from './exportEvaluation'

/**
 * Le classeur « Résultats » d'une formation, rempli dans le modèle du
 * formateur (`public/modeles/resultats.xlsx`, tiré des classeurs
 * « Résultats … » Climatisation, électrique et châssis) : une feuille,
 * un stagiaire par ligne, la même mise en forme et les mêmes formules.
 *
 * Le modèle prévoit treize lignes (5 à 17). Ici on en pose autant que de
 * stagiaires présents ; la moyenne et la légende descendent ou remontent
 * d'autant, et les formules et mises en forme conditionnelles sont
 * réécrites pour couvrir exactement ces lignes.
 *
 * Une note absente s'écrit « - », comme dans les originaux : le
 * pourcentage vaut alors 0 et la case se colore en conséquence.
 */

export const MODELE_RESULTATS = '/modeles/resultats.xlsx'

const PREMIERE = 5
const LIGNES_MODELE = 13
const MOYENNE_MODELE = PREMIERE + LIGNES_MODELE // 18
const DERNIERE_MODELE = 30
const COLONNES = 21

const copie = o => (o ? JSON.parse(JSON.stringify(o)) : {})

/** Une note brute saisie : un nombre, sinon « - ». */
function note(brut) {
  const s = String(brut ?? '').trim().replace(',', '.')
  if (s === '' || s === '-') return '-'
  const n = Number(s)
  return Number.isFinite(n) ? n : '-'
}

/** « CFAO MOBILITY CAMEROUN » ; vide si le pays n'est pas connu. */
function filiale(p) {
  return p.pays ? `CFAO MOBILITY ${String(p.pays).toUpperCase()}` : null
}

export function nomFichierResultats(brouillon, session) {
  const intitule = (brouillon.intitule || session?.moduleFormation || '').trim()
  const nom = intitule || brouillon.codeFormation || session?.codeFormation || 'session'
  const periode = periodeCourte(brouillon.debut, brouillon.fin)
  return `Résultats ${nom}${periode ? ` ${periode}` : ''}.xlsx`
    .replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ')
}

/** Descend (ou remonte) tout ce qui suit les lignes de stagiaires. */
function deplacerBas(ws, ecart) {
  if (!ecart) return
  const bloc = []
  for (let r = MOYENNE_MODELE; r <= DERNIERE_MODELE; r++) {
    const ligne = ws.getRow(r)
    const cellules = []
    for (let c = 1; c <= COLONNES; c++) {
      const cell = ws.getCell(r, c)
      cellules.push({ valeur: cell.value, style: copie(cell.style) })
    }
    bloc.push({ hauteur: ligne.height, cellules })
  }
  ws.unMergeCells(`B${MOYENNE_MODELE}:D${MOYENNE_MODELE}`)
  for (let r = MOYENNE_MODELE; r <= DERNIERE_MODELE; r++) {
    for (let c = 1; c <= COLONNES; c++) {
      const cell = ws.getCell(r, c)
      cell.value = null
      cell.style = {}
    }
  }
  bloc.forEach((l, i) => {
    const r = MOYENNE_MODELE + ecart + i
    ws.getRow(r).height = l.hauteur
    l.cellules.forEach((s, c) => {
      const cell = ws.getCell(r, c + 1)
      cell.value = s.valeur
      cell.style = copie(s.style)
    })
  })
  const m = MOYENNE_MODELE + ecart
  ws.mergeCells(`B${m}:D${m}`)
}

/** Les mises en forme conditionnelles du modèle, sur les lignes posées
 * et au seuil du compte rendu. */
function etendreRegles(ws, derniere, seuil) {
  ws.conditionalFormattings = (ws.conditionalFormattings || []).map(cf => ({
    ...cf,
    rules: reglesAuSeuil(cf.rules, seuil),
    ref: cf.ref.replace(/\d+/g, m => (Number(m) === PREMIERE + LIGNES_MODELE - 1 ? String(derniere) : m)),
  }))
}

/**
 * Le classeur lui-même, sans le téléchargement : il se construit aussi
 * hors du navigateur, pour le vérifier.
 */
export async function construireClasseurResultats(ExcelJS, modele, brouillon, session) {
  const stagiaires = (brouillon.participants || []).filter(p => p.present !== false)
  const b = brouillon.baremes || BAREMES
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(modele)
  const ws = wb.worksheets[0]

  const n = Math.max(stagiaires.length, 1)
  const ecart = n - LIGNES_MODELE
  deplacerBas(ws, ecart)
  const derniere = PREMIERE + n - 1
  const moyenne = MOYENNE_MODELE + ecart

  // Lignes en plus : le style de la première ligne du modèle.
  for (let r = PREMIERE + LIGNES_MODELE; r <= derniere; r++) {
    ws.getRow(r).height = ws.getRow(PREMIERE).height
    for (let c = 1; c <= COLONNES; c++) {
      ws.getCell(r, c).style = copie(ws.getCell(PREMIERE, c).style)
    }
  }
  // Lignes en moins : on efface celles que la moyenne a quittées.
  for (let r = derniere + 1; r < moyenne; r++) {
    for (let c = 1; c <= COLONNES; c++) {
      const cell = ws.getCell(r, c)
      cell.value = null
      cell.style = {}
    }
  }

  const intitule = (brouillon.intitule || session?.moduleFormation || '').trim()
    || brouillon.codeFormation || session?.codeFormation || ''
  const periode = periodeCourte(brouillon.debut, brouillon.fin)
  ws.getCell('B2').value = ['Résultats', intitule, periode].filter(Boolean).join(' ')

  ws.getCell('E4').value = `Test d'entrée theorique/${b.entreeTheorique}`
  ws.getCell('G4').value = `Test de sortie théorique /${b.sortieTheorique}`
  ws.getCell('I4').value = `Test de sortie pratique /${b.sortiePratique} `

  for (let i = 0; i < n; i++) {
    const r = PREMIERE + i
    const p = stagiaires[i]
    ws.getCell(`B${r}`).value = i + 1
    ws.getCell(`C${r}`).value = p ? [p.nom, p.prenom].filter(Boolean).join(' ').toUpperCase() : null
    ws.getCell(`D${r}`).value = p ? filiale(p) : null
    ws.getCell(`E${r}`).value = p ? note(p.entreeBrut) : null
    ws.getCell(`G${r}`).value = p ? note(p.sortieTheoBrut) : null
    ws.getCell(`I${r}`).value = p ? note(p.sortiePratBrut) : null
    ws.getCell(`F${r}`).value = { formula: `IF(E${r}="-",0,E${r}/${b.entreeTheorique})` }
    ws.getCell(`H${r}`).value = { formula: `IF(G${r}="-",0,G${r}/${b.sortieTheorique})` }
    ws.getCell(`J${r}`).value = { formula: `IF(I${r}="-",0,I${r}/${b.sortiePratique})` }
    ws.getCell(`K${r}`).value = { formula: `IFERROR((H${r}-F${r})/F${r},"")` }
    ws.getCell(`L${r}`).value = { formula: `AVERAGE(J${r},H${r})` }
  }

  const plage = col => `${col}${PREMIERE}:${col}${derniere}`
  for (const col of ['E', 'F', 'G', 'H', 'I', 'J', 'L']) {
    ws.getCell(`${col}${moyenne}`).value = { formula: `AVERAGE(${plage(col)})` }
  }
  ws.getCell(`K${moyenne}`).value = { formula: `IFERROR((H${moyenne}-F${moyenne})/F${moyenne},"")` }
  etendreRegles(ws, derniere, seuilDe(brouillon))

  wb.calcProperties = { fullCalcOnLoad: true }
  return wb
}

/**
 * Remplit le modèle et le propose au téléchargement.
 * `modele` : classeur vierge (noms posés, notes à remplir à la main).
 */
export async function exporterResultats(brouillon, session, { modele = false } = {}) {
  const [{ default: ExcelJS }, reponse] = await Promise.all([
    import('exceljs'),
    fetch(MODELE_RESULTATS),
  ])
  if (!reponse.ok) throw new Error('Modèle Excel introuvable')
  const wb = await construireClasseurResultats(ExcelJS, await reponse.arrayBuffer(), brouillon, session)
  const tampon = await wb.xlsx.writeBuffer()
  const blob = new Blob([tampon], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${modele ? 'Modèle ' : ''}${nomFichierResultats(brouillon, session)}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
