import { BAREMES, SEUIL } from './baremeCfao'
import { MENTIONS, CRITERES_FORMATION, CRITERES_ACCUEIL } from './satisfactionCfao'
import { periodeLongue } from './compteRendu'

/**
 * Le classeur d'evaluation d'une session, tel que l'Academy le tient.
 *
 * Il reprend les deux feuilles des classeurs « Evaluation … » du
 * formateur — « Données Stagiaires » pour la saisie, « Satisfaction
 * Stagiaires » pour les calculs — en un format unique.
 *
 * Les classeurs d'origine avaient leurs formules posees une fois pour
 * toutes sur les colonnes B a M. Au-dela de douze stagiaires, les
 * suivants n'etaient plus comptes ; a treize, la colonne GLOBAL glissait
 * et ses moyennes visaient les mauvaises cellules. Ici chaque plage est
 * calculee depuis le nombre de stagiaires presents : les formules
 * couvrent exactement leurs colonnes, ni plus ni moins.
 *
 * Deux ecarts assumes avec les originaux :
 *   * les notes sont exportees brutes, avec leur bareme, et converties
 *     en pourcentage par formule — une correction de copie se reporte
 *     alors partout ;
 *   * la ligne « Test theorique durant la formation », doublon de la
 *     sortie, disparait, et « Accueil a l'aeroport » lit bien sa propre
 *     ligne (l'original lisait celle du repas au CFR).
 */

const DONNEES = 'Données Stagiaires'
const SYNTHESE = 'Satisfaction Stagiaires'
const REF = `'${DONNEES}'!`

/** Les libelles des criteres tels que les classeurs les ecrivent. */
const LIBELLES_CLASSEUR = {
  themes: 'Thèmes abordés',
  documents: 'Qualité des documents de formation (ppt, docs papiers …)',
  planning: 'Planning, horaires et durée de la formation',
  formateur: 'Prestation du formateur',
  composition: 'Composition du groupe',
  ambiance: 'Ambiance du groupe',
  salle: 'Salle de formation (équipement, confort)',
  aeroport: 'Accueil à l’aéroport par le centre de formation',
  transport: 'Transport de l’aéroport à l’hôtel',
  hebergement: 'Qualité de l’hébergement (hôtel, chambre, …)',
  repas_hotel: 'Qualité du repas et des boissons proposés à l’hôtel',
  accueil_centre: 'Accueil des stagiaires au centre de formation',
  repas_cfr: 'Repas au CFR',
}
const libelle = c => LIBELLES_CLASSEUR[c.cle] || c.libelle

// Charte : le bleu des en-tetes du modele PowerPoint, le gris des
// intitules de rubrique.
const BLEU = 'FF363C5A'
const GRIS = 'FFE7E6E6'
const FILET = { style: 'thin', color: { argb: 'FFC8C8C8' } }
const BORDS = { top: FILET, left: FILET, bottom: FILET, right: FILET }

/** La lettre d'une colonne, 1 -> A, 27 -> AA. */
function lettre(n) {
  let s = ''
  while (n > 0) {
    const r = (n - 1) % 26
    s = String.fromCharCode(65 + r) + s
    n = Math.floor((n - 1) / 26)
  }
  return s
}

/**
 * La geometrie du classeur pour `n` stagiaires.
 *
 * Colonnes : A les intitules, B le bareme (donnees) ou rien (synthese),
 * puis un stagiaire par colonne a partir de C, la colonne GLOBAL juste
 * apres, et la table de ponderation deux colonnes plus loin.
 */
function geometrie(n) {
  const premiere = 3
  const derniere = premiere + Math.max(n, 1) - 1
  const globale = derniere + 1
  const mention = globale + 2
  return {
    n,
    colonnes: Array.from({ length: n }, (_, i) => lettre(premiere + i)),
    C1: lettre(premiere),
    CN: lettre(derniere),
    G: lettre(globale),
    P: lettre(mention),
    Q: lettre(mention + 1),
    iG: globale,
    iP: mention,
  }
}

// ── Feuille « Données Stagiaires » : la saisie ─────────────────────────
// Lignes fixes, pour que la synthese les vise sans calcul.
const D = {
  titre: 1, periode: 2, formateur: 3,
  noms: 4, pays: 5, entree: 6, sortieTh: 7, sortiePr: 8,
  formation: 10, // intitule de rubrique ; criteres de 11 a 17
  accueil: 18, // intitule de rubrique ; criteres de 19 a 24
}
const ligneCritere = (rubrique, i) => (rubrique === 'formation' ? D.formation : D.accueil) + 1 + i

// ── Feuille « Satisfaction Stagiaires » : les calculs ──────────────────
const S = {
  titre: 1, periode: 2, formateur: 3,
  noms: 5, pays: 6,
  entree: 7, sortieTh: 8, progression: 9, sortiePr: 10, acquisition: 11, resultat: 12,
  formation: 14, // criteres de 15 a 21, total en 22
  accueil: 24, // criteres de 25 a 30, total en 31
  // Tableaux de decompte des mentions.
  decompteFormation: 34,
  decompteAccueil: 44,
  // Table de ponderation, a droite.
  bareme: 5, seuil: 13,
}

function styleEntete(cell) {
  cell.font = { bold: true, color: { argb: 'FFFFFFFF' } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: BLEU } }
  cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true }
  cell.border = BORDS
}
function styleRubrique(cell) {
  cell.font = { bold: true, color: { argb: 'FF363C5A' } }
  cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: GRIS } }
  cell.border = BORDS
}
function styleCellule(cell, format) {
  cell.border = BORDS
  cell.alignment = { vertical: 'middle', horizontal: 'center' }
  if (format) cell.numFmt = format
}

/** Le texte des trois lignes d'en-tete, repris sur les deux feuilles. */
function entetes(session, brouillon) {
  const code = brouillon.codeFormation || session?.codeFormation || ''
  const intitule = brouillon.intitule || session?.moduleFormation || ''
  const periode = periodeLongue(brouillon.debut, brouillon.fin)
  const lieu = brouillon.lieu || session?.lieu || ''
  const formateur = (brouillon.formateurs || []).map(f => f.nom).filter(Boolean).join(', ')
    || session?.formateur || ''
  return {
    titre: `FORMATION : ${[code, intitule].filter(Boolean).join(' : ')}`,
    periode: [periode, lieu].filter(Boolean).join(' — '),
    formateur: formateur ? `Formateur : ${formateur}` : '',
  }
}

function feuilleDonnees(ws, g, stagiaires, brouillon, en) {
  const baremes = brouillon.baremes || BAREMES
  const reponses = brouillon.satisfaction || {}

  ws.getCell(`A${D.titre}`).value = en.titre
  ws.getCell(`A${D.titre}`).font = { bold: true, size: 14, color: { argb: BLEU } }
  ws.getCell(`A${D.periode}`).value = en.periode
  ws.getCell(`A${D.formateur}`).value = en.formateur
  ws.getCell(`A${D.formateur}`).font = { italic: true, color: { argb: 'FF6B7280' } }

  ws.getCell(`A${D.noms}`).value = 'Stagiaire'
  ws.getCell(`B${D.noms}`).value = 'Barème'
  ;[`A${D.noms}`, `B${D.noms}`].forEach(a => styleEntete(ws.getCell(a)))
  ws.getRow(D.noms).height = 48

  const lignes = [
    [D.pays, 'Pays', null],
    [D.entree, 'Note théorique d’entrée', baremes.entreeTheorique, 'entreeBrut'],
    [D.sortieTh, 'Note théorique de sortie', baremes.sortieTheorique, 'sortieTheoBrut'],
    [D.sortiePr, 'Note pratique', baremes.sortiePratique, 'sortiePratBrut'],
  ]
  lignes.forEach(([r, texte, bareme]) => {
    ws.getCell(`A${r}`).value = texte
    ws.getCell(`A${r}`).border = BORDS
    const b = ws.getCell(`B${r}`)
    b.value = bareme
    styleCellule(b)
    if (bareme != null) b.font = { bold: true }
  })

  stagiaires.forEach((p, i) => {
    const c = g.colonnes[i]
    const nom = ws.getCell(`${c}${D.noms}`)
    nom.value = [p.prenom, p.nom].filter(Boolean).join(' ')
    styleEntete(nom)
    styleCellule(ws.getCell(`${c}${D.pays}`))
    ws.getCell(`${c}${D.pays}`).value = p.pays || ''
    lignes.slice(1).forEach(([r, , , champ]) => {
      const cell = ws.getCell(`${c}${r}`)
      const v = p[champ]
      cell.value = v === '' || v == null ? null : Number(v)
      styleCellule(cell, '0')
    })
  })

  const rubrique = (r, titre, criteres, cle) => {
    ws.getCell(`A${r}`).value = titre
    for (let k = 1; k <= 2 + g.n; k++) styleRubrique(ws.getCell(r, k))
    criteres.forEach((crit, i) => {
      const lr = ligneCritere(cle, i)
      ws.getCell(`A${lr}`).value = libelle(crit)
      ws.getCell(`A${lr}`).border = BORDS
      ws.getCell(`B${lr}`).border = BORDS
      stagiaires.forEach((p, j) => {
        const cell = ws.getCell(`${g.colonnes[j]}${lr}`)
        const m = MENTIONS.find(x => x.cle === reponses[p.id]?.[crit.cle])
        cell.value = m ? m.libelle : null
        styleCellule(cell)
        // La liste des mentions, pour corriger dans Excel sans faute de
        // frappe : une mention mal ecrite ne serait plus comptee.
        cell.dataValidation = {
          type: 'list',
          allowBlank: true,
          formulae: [`"${MENTIONS.map(x => x.libelle).join(',')}"`],
        }
      })
    })
  }
  rubrique(D.formation, 'Qualité de la formation', CRITERES_FORMATION, 'formation')
  rubrique(D.accueil, 'Qualité de l’accueil', CRITERES_ACCUEIL, 'accueil')

  ws.getColumn(1).width = 50
  ws.getColumn(2).width = 10
  g.colonnes.forEach((_, i) => { ws.getColumn(3 + i).width = 20 })
  ws.views = [{ state: 'frozen', xSplit: 2, ySplit: D.noms }]
}

function feuilleSynthese(ws, g) {
  const { C1, CN, G, P, Q } = g
  const plage = r => `${C1}${r}:${CN}${r}`
  const pond = { debut: S.bareme + 2, fin: S.bareme + 2 + MENTIONS.length - 1 }
  const P_MENTIONS = `$${P}$${pond.debut}:$${P}$${pond.fin}`
  const Q_SCORES = `$${Q}$${pond.debut}:$${Q}$${pond.fin}`
  const SEUIL_REF = `$${Q}$${S.seuil}`
  const score = k => `$${Q}$${pond.debut + k}`

  // En-tetes repris de la feuille de saisie : une seule source.
  ;[['titre', D.titre], ['periode', D.periode], ['formateur', D.formateur]].forEach(([k, r]) => {
    ws.getCell(`A${S[k]}`).value = { formula: `${REF}A${r}` }
  })
  ws.getCell(`A${S.titre}`).font = { bold: true, size: 14, color: { argb: BLEU } }
  ws.getCell(`A${S.formateur}`).font = { italic: true, color: { argb: 'FF6B7280' } }

  // Noms et pays.
  ws.getCell(`A${S.noms}`).value = 'Appréciation par stagiaire'
  styleEntete(ws.getCell(`A${S.noms}`))
  ws.getCell(`${G}${S.noms}`).value = 'GLOBAL'
  styleEntete(ws.getCell(`${G}${S.noms}`))
  ws.getRow(S.noms).height = 48
  ws.getCell(`A${S.pays}`).value = 'Pays'
  ws.getCell(`A${S.pays}`).border = BORDS
  g.colonnes.forEach(c => {
    ws.getCell(`${c}${S.noms}`).value = { formula: `${REF}${c}${D.noms}` }
    styleEntete(ws.getCell(`${c}${S.noms}`))
    ws.getCell(`${c}${S.pays}`).value = { formula: `IF(${REF}${c}${D.pays}="","",${REF}${c}${D.pays})` }
    styleCellule(ws.getCell(`${c}${S.pays}`))
  })
  styleCellule(ws.getCell(`${G}${S.pays}`))

  // Resultats des tests, par stagiaire puis en moyenne.
  const tests = [
    [S.entree, 'Test théorique d’entrée', c => `IF(${REF}${c}${D.entree}="","",${REF}${c}${D.entree}/${REF}$B$${D.entree})`, 'moy'],
    [S.sortieTh, 'Test théorique de sortie', c => `IF(${REF}${c}${D.sortieTh}="","",${REF}${c}${D.sortieTh}/${REF}$B$${D.sortieTh})`, 'moy'],
    [S.progression, 'Taux de progression', c => `IFERROR((${c}${S.sortieTh}-${c}${S.entree})/${c}${S.entree},"")`, 'prog'],
    [S.sortiePr, 'Test pratique durant la formation', c => `IF(${REF}${c}${D.sortiePr}="","",${REF}${c}${D.sortiePr}/${REF}$B$${D.sortiePr})`, 'moy'],
    [S.acquisition, 'Taux d’acquisition des compétences', c => `IF(COUNT(${c}${S.sortieTh},${c}${S.sortiePr})=0,"",AVERAGE(${c}${S.sortieTh},${c}${S.sortiePr}))`, 'moy'],
    [S.resultat, 'Résultat', c => `IF(${c}${S.acquisition}="","",IF(${c}${S.acquisition}>=${SEUIL_REF},"Acquis","Non acquis"))`, 'res'],
  ]
  tests.forEach(([r, texte, f, globale]) => {
    ws.getCell(`A${r}`).value = texte
    ws.getCell(`A${r}`).border = BORDS
    const fmt = globale === 'prog' ? '+0%;-0%;0%' : globale === 'res' ? undefined : '0%'
    g.colonnes.forEach(c => {
      ws.getCell(`${c}${r}`).value = { formula: f(c) }
      styleCellule(ws.getCell(`${c}${r}`), fmt)
    })
    const cg = ws.getCell(`${G}${r}`)
    // La progression globale est la moyenne des progressions de chacun,
    // comme dans le compte rendu : les classeurs d'origine la tiraient
    // des moyennes, et le rapport et le classeur ne disaient alors pas
    // le meme chiffre. Le resultat global compte les acquis.
    cg.value = {
      formula: globale === 'prog'
        ? `IFERROR(AVERAGE(${plage(r)}),"")`
        : globale === 'res'
          ? `COUNTIF(${plage(S.resultat)},"Acquis")&" / "&COUNT(${plage(S.acquisition)})`
          : `IFERROR(AVERAGE(${plage(r)}),"")`,
    }
    styleCellule(cg, fmt)
    cg.font = { bold: true }
  })
  ws.getCell(`A${S.acquisition}`).font = { bold: true }

  // Le taux d'acquisition passe au vert ou au rouge selon le seuil.
  ws.addConditionalFormatting({
    ref: `${C1}${S.acquisition}:${G}${S.acquisition}`,
    rules: [
      { type: 'expression', priority: 1, formulae: [`AND(ISNUMBER(${C1}${S.acquisition}),${C1}${S.acquisition}>=${SEUIL_REF})`],
        style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFD9F2E3' } }, font: { color: { argb: 'FF1A8F4C' } } } },
      { type: 'expression', priority: 2, formulae: [`AND(ISNUMBER(${C1}${S.acquisition}),${C1}${S.acquisition}<${SEUIL_REF})`],
        style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb: 'FFFBE3E3' } }, font: { color: { argb: 'FFC62828' } } } },
    ],
  })

  // Scores des criteres (sur 100) et qualite par stagiaire.
  const blocCriteres = (r0, titre, criteres, cle, total) => {
    ws.getCell(`A${r0}`).value = `${titre} (score sur 100)`
    for (let k = 1; k <= g.iG; k++) styleRubrique(ws.getCell(r0, k))
    criteres.forEach((crit, i) => {
      const r = r0 + 1 + i
      const src = ligneCritere(cle, i)
      ws.getCell(`A${r}`).value = libelle(crit)
      ws.getCell(`A${r}`).border = BORDS
      g.colonnes.forEach(c => {
        ws.getCell(`${c}${r}`).value = {
          formula: `IF(${REF}${c}${src}="","",IFERROR(INDEX(${Q_SCORES},MATCH(${REF}${c}${src},${P_MENTIONS},0)),""))`,
        }
        styleCellule(ws.getCell(`${c}${r}`), '0')
      })
      ws.getCell(`${G}${r}`).value = { formula: `IFERROR(AVERAGE(${plage(r)})/100,"")` }
      styleCellule(ws.getCell(`${G}${r}`), '0%')
    })
    const rf = r0 + criteres.length
    ws.getCell(`A${total}`).value = titre
    ws.getCell(`A${total}`).font = { bold: true }
    ws.getCell(`A${total}`).border = BORDS
    g.colonnes.forEach(c => {
      ws.getCell(`${c}${total}`).value = { formula: `IFERROR(AVERAGE(${c}${r0 + 1}:${c}${rf})/100,"")` }
      styleCellule(ws.getCell(`${c}${total}`), '0%')
      ws.getCell(`${c}${total}`).font = { bold: true }
    })
    ws.getCell(`${G}${total}`).value = { formula: `IFERROR(AVERAGE(${plage(total)}),"")` }
    styleCellule(ws.getCell(`${G}${total}`), '0%')
    ws.getCell(`${G}${total}`).font = { bold: true }
  }
  blocCriteres(S.formation, 'Qualité de la formation', CRITERES_FORMATION, 'formation', S.formation + 8)
  blocCriteres(S.accueil, 'Qualité de l’accueil', CRITERES_ACCUEIL, 'accueil', S.accueil + 7)

  // Decompte des mentions par critere. Les colonnes du decompte sont
  // celles de la feuille, independamment du nombre de stagiaires.
  const colsDecompte = ['C', 'D', 'E', 'F', 'G']
  const decompte = (r0, titre, criteres, cle) => {
    const entete = [titre, '', ...MENTIONS.map(m => m.libelle), 'Réponses', 'Taux']
    entete.forEach((t, k) => {
      const cell = ws.getCell(r0, k + 1)
      cell.value = t
      if (k !== 1) styleEntete(cell)
    })
    ws.getCell(r0, 1).alignment = { vertical: 'middle', horizontal: 'left' }
    criteres.forEach((crit, i) => {
      const r = r0 + 1 + i
      const src = ligneCritere(cle, i)
      ws.getCell(`A${r}`).value = libelle(crit)
      ws.getCell(`A${r}`).border = BORDS
      colsDecompte.forEach(col => {
        ws.getCell(`${col}${r}`).value = {
          formula: `COUNTIF(${REF}$${C1}$${src}:$${CN}$${src},${col}$${r0})`,
        }
        styleCellule(ws.getCell(`${col}${r}`), '0')
      })
      ws.getCell(`H${r}`).value = { formula: `SUM(C${r}:G${r})` }
      styleCellule(ws.getCell(`H${r}`), '0')
      // Le taux pondere les mentions par leur score, lu dans la table.
      ws.getCell(`I${r}`).value = {
        formula: `IFERROR((C${r}*${score(0)}+D${r}*${score(1)}+E${r}*${score(2)}+F${r}*${score(3)}+G${r}*${score(4)})/100/H${r},"")`,
      }
      styleCellule(ws.getCell(`I${r}`), '0%')
    })
    const rt = r0 + 1 + criteres.length
    ws.getCell(`A${rt}`).value = titre
    ws.getCell(`A${rt}`).font = { bold: true }
    ws.getCell(`A${rt}`).border = BORDS
    ;[...colsDecompte, 'H'].forEach(col => {
      ws.getCell(`${col}${rt}`).value = { formula: `SUM(${col}${r0 + 1}:${col}${rt - 1})` }
      styleCellule(ws.getCell(`${col}${rt}`), '0')
      ws.getCell(`${col}${rt}`).font = { bold: true }
    })
    ws.getCell(`I${rt}`).value = { formula: `IFERROR(AVERAGE(I${r0 + 1}:I${rt - 1}),"")` }
    styleCellule(ws.getCell(`I${rt}`), '0%')
    ws.getCell(`I${rt}`).font = { bold: true }
  }
  decompte(S.decompteFormation, 'Qualité de la formation', CRITERES_FORMATION, 'formation')
  decompte(S.decompteAccueil, 'Qualité de l’accueil', CRITERES_ACCUEIL, 'accueil')

  // Table de ponderation et seuil : les formules y lisent leurs valeurs,
  // on les ajuste ici sans toucher a une formule.
  ws.getCell(`${P}${S.bareme}`).value = 'Barème de pondération'
  ws.mergeCells(`${P}${S.bareme}:${Q}${S.bareme}`)
  styleEntete(ws.getCell(`${P}${S.bareme}`))
  ws.getCell(`${P}${S.bareme + 1}`).value = 'Mention'
  ws.getCell(`${Q}${S.bareme + 1}`).value = 'Score (sur 100)'
  ;[P, Q].forEach(col => styleRubrique(ws.getCell(`${col}${S.bareme + 1}`)))
  MENTIONS.forEach((m, k) => {
    const r = pond.debut + k
    ws.getCell(`${P}${r}`).value = m.libelle
    ws.getCell(`${P}${r}`).border = BORDS
    ws.getCell(`${Q}${r}`).value = m.score
    styleCellule(ws.getCell(`${Q}${r}`), '0')
  })
  ws.getCell(`${P}${S.seuil}`).value = 'Seuil de validation'
  ws.getCell(`${P}${S.seuil}`).font = { bold: true }
  ws.getCell(`${P}${S.seuil}`).border = BORDS
  ws.getCell(`${Q}${S.seuil}`).value = SEUIL / 100
  styleCellule(ws.getCell(`${Q}${S.seuil}`), '0%')
  ws.getCell(`${Q}${S.seuil}`).font = { bold: true }

  ws.getColumn(1).width = 50
  ws.getColumn(2).width = 3
  // Les colonnes des stagiaires servent aussi au decompte (C a I) :
  // elles gardent une largeur lisible meme pour une petite session.
  for (let k = 3; k <= Math.max(g.iG, 9); k++) ws.getColumn(k).width = k === g.iG ? 14 : 18
  ws.getColumn(g.iP).width = 24
  ws.getColumn(g.iP + 1).width = 16
  ws.views = [{ state: 'frozen', xSplit: 1, ySplit: S.noms }]
}

/** Le nom du fichier, lisible et sans caractere interdit. */
export function nomFichier(brouillon, session) {
  const code = brouillon.codeFormation || session?.codeFormation || 'session'
  const du = (brouillon.debut || '').split('-').reverse().join('.')
  const au = (brouillon.fin || '').split('-').reverse().join('.')
  const dates = du && au ? ` du ${du} au ${au}` : ''
  return `Evaluation ${code}${dates}.xlsx`.replace(/[\\/:*?"<>|]+/g, '-')
}

/**
 * Construit le classeur et le propose au telechargement.
 *
 * Seuls les stagiaires presents y figurent, dans l'ordre de la saisie.
 * La bibliotheque n'est chargee qu'au moment de l'export.
 */
export async function exporterEvaluation(brouillon, session) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = construireClasseur(ExcelJS, brouillon, session)
  const tampon = await wb.xlsx.writeBuffer()
  const blob = new Blob([tampon], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nomFichier(brouillon, session)
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Le classeur lui-meme, sans le telechargement : il se construit aussi
 *  hors du navigateur, pour le verifier. */
export function construireClasseur(ExcelJS, brouillon, session) {
  const stagiaires = (brouillon.participants || []).filter(p => p.present !== false)
  const g = geometrie(stagiaires.length)
  const en = entetes(session, brouillon)

  const wb = new ExcelJS.Workbook()
  wb.creator = 'CFAO Academy'
  wb.created = new Date()
  // La synthese d'abord, comme dans les classeurs du formateur ; elle
  // lit la feuille de saisie, creee juste apres.
  const synthese = wb.addWorksheet(SYNTHESE, { properties: { tabColor: { argb: BLEU } } })
  const donnees = wb.addWorksheet(DONNEES)
  feuilleDonnees(donnees, g, stagiaires, brouillon, en)
  feuilleSynthese(synthese, g)
  ;[synthese, donnees].forEach(ws => {
    ws.pageSetup = { orientation: 'landscape', fitToPage: true, fitToWidth: 1, fitToHeight: 0 }
  })
  // Excel recalcule a l'ouverture : les valeurs s'affichent sans
  // qu'on ait a appuyer sur F9.
  wb.calcProperties = { fullCalcOnLoad: true }
  return wb
}
