import { SEUIL_DEFAUT, seuilDe } from './baremeCfao'
import { STATUTS_ELEARNING, VALIDE, NON_FINALISE, libelleModule, moduleVide, niveauDe } from './certification'
import { periodeLongue } from './compteRendu'
import { periodeCourte } from './exportEvaluation'
import { chargerClasseur } from './chargerClasseur'
import { normaliser, paysDe, reconnaitre, valeurDe } from './importEvaluation'

/**
 * Le classeur des resultats d'une certification.
 *
 * Il reprend le classeur « Résultats de la certification » des
 * formateurs — celui de la certification G3 de Guinée sert de modele :
 * memes polices (Arial 12 a 16, gras), memes largeurs, memes hauteurs
 * de lignes, titre sur fond vert, rangee de numeros au-dessus des noms,
 * pourcentage sur 100, « Validé » ou « Échoué » encadre, legende a deux
 * couleurs. Deux ajouts seulement :
 *
 *   * **la feuille globale** (« Certification G3 ») est la seule ou l'on
 *     saisit ; chaque candidat y a sa colonne, et l'e-learning suit les
 *     notes, dans le meme style, pour le resultat final ;
 *   * **une feuille par candidat** : le bloc que le modele recopiait sous
 *     le tableau, rempli ici par formules — une note ne se tape qu'a un
 *     endroit.
 *
 * Chaque nom de la feuille globale ouvre la fiche du candidat, et chaque
 * fiche y ramene.
 *
 * L'import relit ce classeur, et aussi celui des formateurs : il cherche
 * les libelles (« Nom et Prénom », « Filiale », « Total ») au lieu de
 * cases fixes.
 */

// Les couleurs du modele : titre en vert d'accent eclairci, seuil de
// validation en vert ou orange, note ou resultat insuffisant en rouge.
const TITRE = 'FFA9D08E'
const BON = 'FF92D050'
const BAS = 'FFED7D31'
const ROUGE = 'FFFF0000'
const BLANC = 'FFFFFFFF'

const ECHOUE = 'Échoué'
const CERTIFIE = 'CERTIFIÉ'
const NON_CERTIFIE = 'NON CERTIFIÉ'

// Largeurs et hauteurs du modele.
const LARGEUR_LIBELLES = 61.29
const LARGEUR_CANDIDAT = 26
const HAUTEUR_LIGNE = 42

const plein = argb => ({ type: 'pattern', pattern: 'solid', fgColor: { argb } })
const arial = (size, o = {}) => ({ name: 'Arial', size, bold: true, ...o })
const calibri = (size, o = {}) => ({ name: 'Calibri', size, bold: true, ...o })
const fin = { style: 'thin' }
const epais = { style: 'medium' }
const cadre = (o = {}) => ({ top: fin, bottom: fin, left: fin, right: fin, ...o })
const tout = { top: epais, bottom: epais, left: epais, right: epais }
const centre = { horizontal: 'center', vertical: 'middle', wrapText: true }

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

/** Un nom de feuille valide et unique (31 caracteres, sans []:*?/\). */
function nomDeFeuille(p, pris) {
  const base = [p.nom, p.prenom].filter(Boolean).join(' ').toUpperCase()
    .replace(/[[\]:*?/\\']/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 28) || 'CANDIDAT'
  let nom = base
  for (let i = 2; pris.has(nom.toUpperCase()); i++) nom = `${base.slice(0, 26)} ${i}`
  pris.add(nom.toUpperCase())
  return nom
}

/** Le lien interne vers une feuille. */
const lien = (texte, feuille) => ({ text: texte, hyperlink: `#'${feuille}'!A1` })

/** Le nom de la feuille globale : « Certification G3 », comme le modele. */
function nomGlobal(brouillon) {
  const niveau = niveauDe(brouillon)
  return niveau ? `Certification ${niveau}`.slice(0, 31) : 'Résultats'
}

/** Le titre du modele : « RÉSULTATS DE LA CERTIFICATION … DU 13 au 17 avril 2026 ». */
function titreDe(brouillon, session) {
  const code = brouillon.codeFormation || session?.codeFormation || ''
  const niveau = niveauDe(brouillon)
  const pays = String(brouillon.pays || session?.paysHote || '').toUpperCase()
  return ['RÉSULTATS DE LA CERTIFICATION', code, niveau && `NIVEAU ${niveau}`, pays,
    periodeLongue(brouillon.debut, brouillon.fin).replace(/^du /, 'DU ')]
    .filter(Boolean).join(' ')
}

/** Les lignes de la feuille globale, une fois les modules connus. */
function geometrie(nbModules) {
  const premier = 9
  const dernier = premier + Math.max(nbModules, 1) - 1
  return {
    titre: 3, numeros: 6, noms: 7, filiale: 8,
    premier, dernier,
    total: dernier + 1, pourcentage: dernier + 2, pratique: dernier + 3,
    requis: dernier + 5, valides: dernier + 6, taux: dernier + 7, statut: dernier + 8,
    final: dernier + 9,
    legende: dernier + 11,
  }
}

/** Mise en forme conditionnelle a partir d'une expression (case vide exclue). */
function regle(ws, ref, expression, argb, priority) {
  ws.addConditionalFormatting({
    ref,
    rules: [{ type: 'expression', formulae: [expression], priority,
      style: { fill: { type: 'pattern', pattern: 'solid', bgColor: { argb } } } }],
  })
}

/** Le pourcentage en vert au-dessus du seuil, en orange en dessous. */
function couleurSeuil(ws, ref, seuil = SEUIL_DEFAUT) {
  const haut = ref.split(':')[0]
  regle(ws, ref, `AND(ISNUMBER(${haut}),${haut}>=${seuil})`, BON, 1)
  regle(ws, ref, `AND(ISNUMBER(${haut}),${haut}<${seuil})`, BAS, 2)
}

/** Une note sous le seuil, en rouge comme dans le modele. */
function couleurNotes(ws, ref, seuil = SEUIL_DEFAUT) {
  const haut = ref.split(':')[0]
  regle(ws, ref, `AND(ISNUMBER(${haut}),${haut}<${seuil})`, ROUGE, 3)
}

/** Un resultat en toutes lettres : rouge s'il est mauvais, vert s'il est bon. */
function couleurResultat(ws, ref, bon, mauvais) {
  const haut = ref.split(':')[0]
  regle(ws, ref, `${haut}="${mauvais}"`, ROUGE, 4)
  if (bon) regle(ws, ref, `${haut}="${bon}"`, BON, 5)
}

function libelle(cell, texte, o = {}) {
  cell.value = texte
  cell.font = arial(12)
  cell.alignment = centre
  cell.border = cadre(o.bord)
}

function saisie(cell, valeur, o = {}) {
  cell.value = valeur
  cell.font = o.police || arial(11)
  cell.fill = plein(BLANC)
  cell.alignment = centre
  cell.border = cadre(o.bord)
  cell.protection = { locked: false }
}

function calcul(cell, formule, o = {}) {
  cell.value = { formula: formule }
  cell.font = o.police || calibri(11)
  cell.alignment = centre
  cell.border = o.bordure || cadre(o.bord)
  if (o.format) cell.numFmt = o.format
}

const nombre0 = v => (v === '' || v == null ? null : Number(v))

/** La feuille globale : la seule ou l'on saisit. */
function feuilleGlobale(wb, nom, brouillon, session, candidats, feuilles) {
  const modules = brouillon.modules?.length ? brouillon.modules : [moduleVide()]
  const seuil = seuilDe(brouillon)
  const n = modules.length
  const g = geometrie(n)
  const derniere = 2 + Math.max(candidats.length, 1)
  const ws = wb.addWorksheet(nom, {
    views: [{ state: 'frozen', xSplit: 2, ySplit: g.filiale, zoomScale: 60 }],
  })
  ws.getColumn(2).width = LARGEUR_LIBELLES
  for (let c = 3; c <= Math.max(derniere, 7); c++) ws.getColumn(c).width = LARGEUR_CANDIDAT

  // Le titre, au-dessus des candidats.
  ws.mergeCells(g.titre, 3, g.titre, Math.max(derniere, 7))
  const t = ws.getCell(g.titre, 3)
  t.value = titreDe(brouillon, session)
  t.font = arial(16)
  t.fill = plein(TITRE)
  t.alignment = centre
  t.border = tout
  ws.getRow(g.titre).height = 31.5
  ws.getRow(g.titre - 1).height = 15.75
  ws.getRow(g.numeros - 1).height = 18.75
  ws.getRow(g.numeros).height = 26.25

  libelle(ws.getCell(g.noms, 2), 'Nom et Prénom')
  libelle(ws.getCell(g.filiale, 2), 'Filiale')
  modules.forEach((m, i) => {
    const code = m.code ? `${m.code}: ` : ''
    libelle(ws.getCell(g.premier + i, 2), `${code}${m.intitule || libelleModule(m) || `Module ${i + 1}`} / 100`)
    ws.getCell(g.premier + i, 2).protection = { locked: false }
  })
  libelle(ws.getCell(g.total, 2), `Total/ ${100 * n}`)
  libelle(ws.getCell(g.pourcentage, 2), 'Pourcentage(%)')
  libelle(ws.getCell(g.requis, 2), 'Modules e-learning requis')
  libelle(ws.getCell(g.valides, 2), 'Modules e-learning validés')
  libelle(ws.getCell(g.taux, 2), 'Taux de participation e-learning (%)')
  libelle(ws.getCell(g.statut, 2), 'Statut e-learning (Validé ou Non finalisé)')
  libelle(ws.getCell(g.final, 2), 'Résultat final', { bord: tout })
  for (let r = g.noms; r <= g.pourcentage; r++) ws.getRow(r).height = HAUTEUR_LIGNE
  ws.getRow(g.pratique).height = 27
  for (let r = g.requis; r <= g.statut; r++) ws.getRow(r).height = 29.25
  ws.getRow(g.final).height = 29.25

  candidats.forEach((p, i) => {
    const col = 3 + i
    const c = lettre(col)
    const plage = `${c}${g.premier}:${c}${g.dernier}`

    const num = ws.getCell(g.numeros, col)
    num.value = i + 1
    num.font = arial(11)
    num.alignment = centre
    num.border = cadre()

    const cNom = ws.getCell(g.noms, col)
    cNom.value = lien([p.nom, p.prenom].filter(Boolean).join(' '), feuilles[i])
    // Le nom reste noir, comme dans le modele ; le lien se signale au survol.
    cNom.font = arial(14, { color: { argb: 'FF000000' } })
    cNom.alignment = centre
    cNom.border = cadre({ top: epais })
    saisie(ws.getCell(g.filiale, col),
      p.pays ? `CFAO MOBILITY ${String(p.pays).toUpperCase()}` : null,
      { police: arial(12, { color: { argb: 'FF000000' } }), bord: { top: epais } })

    modules.forEach((m, k) => {
      const cell = ws.getCell(g.premier + k, col)
      saisie(cell, nombre0(p.notesModules?.[m.id]))
      cell.dataValidation = {
        type: 'whole', operator: 'between', formulae: [0, 100], allowBlank: true,
        showErrorMessage: true, errorTitle: 'Note', error: 'Une note entière de 0 à 100.',
      }
    })
    const tot = `${c}${g.total}`
    const pct = `${c}${g.pourcentage}`
    const res = `${c}${g.pratique}`
    calcul(ws.getCell(tot), `IF(COUNT(${plage})=0,"",SUM(${plage}))`)
    calcul(ws.getCell(pct), `IF(COUNT(${plage})<${n},"",(${tot}/${100 * n})*100)`, { format: '0' })
    calcul(ws.getCell(res), `IF(${pct}="","",IF(${pct}>=${seuil},"${VALIDE}","${ECHOUE}"))`,
      { police: calibri(16), bordure: tout })

    const e = p.elearning || {}
    ;[[g.requis, e.requis], [g.valides, e.valides]].forEach(([r, v]) => {
      const cell = ws.getCell(r, col)
      saisie(cell, nombre0(v))
      cell.dataValidation = {
        type: 'whole', operator: 'greaterThanOrEqual', formulae: [0], allowBlank: true,
        showErrorMessage: true, errorTitle: 'Modules', error: 'Un nombre entier de modules.',
      }
    })
    calcul(ws.getCell(g.taux, col),
      `IF(N(${c}${g.requis})>0,(N(${c}${g.valides})/${c}${g.requis})*100,"")`, { format: '0' })
    const st = ws.getCell(g.statut, col)
    saisie(st, STATUTS_ELEARNING.includes(e.statut) ? e.statut : null)
    st.dataValidation = {
      type: 'list', allowBlank: true, formulae: [`"${STATUTS_ELEARNING.join(',')}"`],
      showErrorMessage: true, errorTitle: 'Statut', error: 'Choisissez Validé ou Non finalisé.',
    }
    const stat = `${c}${g.statut}`
    calcul(ws.getCell(g.final, col),
      `IF(${res}="${ECHOUE}","${NON_CERTIFIE}",IF(OR(${res}="",${stat}=""),"",`
      + `IF(AND(${res}="${VALIDE}",${stat}="${VALIDE}"),"${CERTIFIE}","${NON_CERTIFIE}")))`,
      { police: calibri(16), bordure: tout })
  })

  if (candidats.length) {
    const d = lettre(2 + candidats.length)
    couleurNotes(ws, `C${g.premier}:${d}${g.dernier}`, seuil)
    couleurSeuil(ws, `C${g.pourcentage}:${d}${g.pourcentage}`, seuil)
    couleurResultat(ws, `C${g.pratique}:${d}${g.pratique}`, null, ECHOUE)
    couleurResultat(ws, `C${g.final}:${d}${g.final}`, CERTIFIE, NON_CERTIFIE)
  }

  // La legende du modele : un carre de couleur, puis sa signification.
  ;[
    [BON, `Bon résultat ( ≥ ${seuil} % ) : A de bonnes aptitudes sur les thèmes abordés durant cette formation pratique.`],
    [ROUGE, `Résultat insuffisant (< ${seuil} %) : Il doit fournir des efforts pour développer ses aptitudes pratiques (e-learning Team GP, coaching, formation…).`],
  ].forEach(([couleur, texte], i) => {
    const r = g.legende + 2 * i
    ws.getCell(r, 3).fill = plein(couleur)
    ws.getCell(r, 4).value = texte
    ws.getCell(r, 4).font = arial(12, { color: { argb: 'FF000000' } })
    ws.getCell(r, 4).alignment = { vertical: 'middle' }
    ws.getRow(r).height = 29.25
    if (!i) ws.getRow(r + 1).height = 13.5
  })
  return { ws, g, modules }
}

/** La fiche d'un candidat : le bloc du modele, tout par formules. */
function feuilleCandidat(wb, nomFeuille, global, col, g, modules, seuil = SEUIL_DEFAUT) {
  const ws = wb.addWorksheet(nomFeuille, { views: [{ zoomScale: 60 }] })
  const ref = `'${global}'!`
  ws.getColumn(2).width = LARGEUR_LIBELLES
  ws.getColumn(3).width = LARGEUR_CANDIDAT
  const src = r => `${ref}$${col}$${r}`
  const siVide = r => `IF(${src(r)}="","",${src(r)})`

  const retour = ws.getCell('B1')
  retour.value = lien(`← Retour à la feuille « ${global} »`, global)
  retour.font = { name: 'Arial', size: 11, underline: true, color: { argb: 'FF0563C1' } }

  ws.mergeCells('B3:C3')
  calcul(ws.getCell('B3'), `${ref}$C$${g.titre}`, { police: arial(16), bordure: tout })
  ws.getCell('B3').fill = plein(TITRE)
  ws.getRow(3).height = 48

  libelle(ws.getCell('B5'), 'Nom et Prénom')
  calcul(ws.getCell('C5'), siVide(g.noms), { police: arial(14), bordure: cadre({ top: epais }) })
  ws.getRow(5).height = 36.75
  ws.getRow(6).height = 18.75
  libelle(ws.getCell('B7'), 'Filiale')
  calcul(ws.getCell('C7'), siVide(g.filiale), { police: arial(12), bordure: cadre({ top: epais }) })
  ws.getRow(7).height = 31.5

  const n = modules.length
  modules.forEach((_, k) => {
    const r = 8 + k
    calcul(ws.getCell(r, 2), `${ref}$B$${g.premier + k}`, { police: arial(12) })
    calcul(ws.getCell(r, 3), siVide(g.premier + k), { police: arial(12) })
    ws.getCell(r, 3).fill = plein(BLANC)
    ws.getRow(r).height = 31.5
  })
  let r = 8 + n
  const ligne = (texte, source, o = {}) => {
    libelle(ws.getCell(r, 2), texte, { bord: o.bordure })
    calcul(ws.getCell(r, 3), siVide(source), { police: o.police || calibri(12), format: o.format, bordure: o.bordure })
    ws.getRow(r).height = o.hauteur || 31.5
    return r++
  }
  ligne(`Total/ ${100 * n}`, g.total)
  const pct = ligne('Pourcentage(%)', g.pourcentage, { format: '0' })
  const prat = ligne('Résultat de la session pratique', g.pratique, { police: calibri(16), bordure: tout, hauteur: 29.25 })
  r++
  ligne('Modules e-learning requis', g.requis)
  ligne('Modules e-learning validés', g.valides)
  ligne('Taux de participation e-learning (%)', g.taux, { format: '0' })
  ligne('Statut e-learning', g.statut)
  r++
  const resultat = ligne('Résultat final', g.final, { police: calibri(16), bordure: tout, hauteur: 29.25 })

  couleurNotes(ws, `C8:C${7 + n}`, seuil)
  couleurSeuil(ws, `C${pct}`, seuil)
  couleurResultat(ws, `C${prat}`, null, ECHOUE)
  couleurResultat(ws, `C${resultat}`, CERTIFIE, NON_CERTIFIE)
  return ws
}

/** Le classeur complet, sans le telechargement. */
export async function construireClasseurCertification(ExcelJS, brouillon, session) {
  const candidats = (brouillon.participants || []).filter(p => p.present !== false)
  const wb = new ExcelJS.Workbook()
  wb.creator = 'CFAO Academy'
  const global = nomGlobal(brouillon)
  const pris = new Set([global.toUpperCase()])
  const feuilles = candidats.map(p => nomDeFeuille(p, pris))
  const { ws, g, modules } = feuilleGlobale(wb, global, brouillon, session, candidats, feuilles)
  const fiches = candidats.map((_, i) =>
    feuilleCandidat(wb, feuilles[i], global, lettre(3 + i), g, modules, seuilDe(brouillon)))
  // Seules les cases blanches de la feuille globale se modifient ; les
  // fiches, toutes en formules, se lisent.
  await ws.protect('', { selectLockedCells: true, selectUnlockedCells: true, formatColumns: true, formatRows: true })
  await Promise.all(fiches.map(f => f.protect('', { selectLockedCells: true, selectUnlockedCells: true })))
  wb.calcProperties = { fullCalcOnLoad: true }
  return wb
}

export function nomFichierCertification(brouillon, session) {
  const code = brouillon.codeFormation || session?.codeFormation || 'certification'
  const periode = periodeCourte(brouillon.debut, brouillon.fin).replace(/^du /, '')
  return `Résultats certification ${code}${periode ? ` du ${periode}` : ''}.xlsx`
    .replace(/[\\/:*?"<>|]/g, '-')
}

/** Le classeur a remplir, telecharge ; `modele` : vierge, et nomme ainsi. */
export async function exporterCertification(brouillon, session, { modele = false } = {}) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = await construireClasseurCertification(ExcelJS, brouillon, session)
  const tampon = await wb.xlsx.writeBuffer()
  const blob = new Blob([tampon], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${modele ? 'Modèle ' : ''}${nomFichierCertification(brouillon, session)}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/* ── Lecture ─────────────────────────────────────────────────────── */

const commence = (v, ...prefixes) => prefixes.some(x => normaliser(v).startsWith(x))

/** « G38001: Décharge…/ 100 » -> { code, intitule }. */
function lireModule(texte) {
  const t = String(texte ?? '').replace(/\/\s*100\s*$/, '').replace(/\s+/g, ' ').trim()
  const m = t.match(/^([A-Z0-9][A-Z0-9-]{2,11})\s*:\s*(.+)$/i)
  return m ? { code: m[1].toUpperCase(), intitule: m[2].trim() } : { code: '', intitule: t }
}

/** Un nombre lu, ou `null`. */
function nombre(v) {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.').trim())
  return Number.isFinite(n) ? n : null
}

function statut(v) {
  const t = normaliser(v)
  if (t === 'VALIDE') return VALIDE
  if (t.startsWith('NON FINALISE') || t === 'NON VALIDE') return NON_FINALISE
  return null
}

/** Trouve la case « Nom et Prénom » d'une feuille : sa ligne et sa colonne. */
function ancre(ws) {
  for (let r = 1; r <= 20; r++) {
    for (let c = 1; c <= 6; c++) {
      if (commence(valeurDe(ws.getCell(r, c)), 'NOM ET PRENOM', 'NOM PRENOM', 'NOMS ET PRENOMS')) {
        return { r, c }
      }
    }
  }
  return null
}

/** Le code de la formation, lu dans le titre (« … CERTIFICATION TS07-G3 … »). */
function codeDuTitre(ws, a) {
  for (let r = 1; r < a.r; r++) {
    for (let c = 1; c <= 10; c++) {
      const t = String(valeurDe(ws.getCell(r, c)) ?? '')
      if (!/CERTIFICATION/i.test(t)) continue
      const m = t.match(/\b([A-Z]{2,4}\d{2}-[A-Z0-9]{1,4})\b/)
      return m ? { codeFormation: m[1] } : {}
    }
  }
  return {}
}

/**
 * Relit un classeur de resultats de certification : celui qu'exporte
 * l'etape 2, ou un classeur de formateur du modele d'origine.
 * La premiere feuille qui porte « Nom et Prénom » est la feuille globale.
 * Renvoie `{ entete, modules, candidats }`.
 */
export async function lireCertification(fichier) {
  const wb = await chargerClasseur(fichier)
  let ws = null
  let a = null
  for (const f of wb.worksheets) {
    a = ancre(f)
    if (a) { ws = f; break }
  }
  if (!ws) throw new Error('ligne « Nom et Prénom » introuvable')

  const texteDe = r => valeurDe(ws.getCell(r, a.c))
  // Les lignes, reperees a leur libelle et non a leur numero.
  let filiale = null
  let total = null
  for (let r = a.r + 1; r < a.r + 80; r++) {
    if (!filiale && commence(texteDe(r), 'FILIALE', 'PAYS')) filiale = r
    if (commence(texteDe(r), 'TOTAL')) { total = r; break }
  }
  if (!total) throw new Error('ligne « Total » introuvable')
  const premier = (filiale || a.r) + 1
  const lignes = []
  for (let r = premier; r < total; r++) {
    const texte = texteDe(r)
    if (texte != null && String(texte).trim()) lignes.push({ r, ...lireModule(texte) })
  }
  if (!lignes.length) throw new Error('aucun module sous les noms')

  // L'e-learning suit le resultat pratique ; le modele d'origine n'en a
  // pas, et ses fiches recopiees plus bas ne doivent pas etre prises.
  const chercher = (...prefixes) => {
    for (let r = total + 1; r < total + 12; r++) {
      const t = normaliser(texteDe(r))
      if (prefixes.some(x => t.includes(x))) return r
    }
    return null
  }
  const lRequis = chercher('REQUIS')
  const lValides = chercher('MODULES E LEARNING VALIDES', 'MODULES VALIDES')
  const lStatut = chercher('STATUT')

  const candidats = []
  for (let c = a.c + 1; c < a.c + 60; c++) {
    const nom = valeurDe(ws.getCell(a.r, c))
    if (nom == null || !String(nom).trim()) break
    candidats.push({
      nom: String(nom).replace(/\s+/g, ' ').trim(),
      pays: filiale ? paysDe(valeurDe(ws.getCell(filiale, c))) : '',
      notes: lignes.map(l => nombre(valeurDe(ws.getCell(l.r, c)))),
      requis: lRequis ? nombre(valeurDe(ws.getCell(lRequis, c))) : null,
      valides: lValides ? nombre(valeurDe(ws.getCell(lValides, c))) : null,
      statut: lStatut ? statut(valeurDe(ws.getCell(lStatut, c))) : null,
    })
  }
  if (!candidats.length) throw new Error('aucun candidat dans le classeur')

  return {
    entete: codeDuTitre(ws, a),
    modules: lignes.map(({ code, intitule }) => ({ code, intitule })),
    candidats,
  }
}

/**
 * Les modifications a apporter au brouillon.
 *
 * Les modules du classeur rejoignent ceux du brouillon, reconnus a leur
 * code (ou a leur intitule) ; les candidats, a leur nom, dans n'importe
 * quel ordre. Une case vide ne vide pas une note deja saisie.
 * Renvoie `{ modules, participants, reconnus, ajoutes, remplaces }`.
 */
export function appliquerCertification(brouillon, lu) {
  const modules = [...(brouillon.modules || [])]
    .filter(m => String(m.code || m.intitule || '').trim())
  const ids = lu.modules.map(lm => {
    const cle = normaliser(lm.code || lm.intitule)
    let m = modules.find(x => normaliser(x.code) && normaliser(x.code) === normaliser(lm.code))
      || modules.find(x => normaliser(x.intitule) === normaliser(lm.intitule))
    if (!m && cle) {
      m = { ...moduleVide(), code: lm.code, intitule: lm.intitule }
      modules.push(m)
    }
    return m?.id
  })

  const participants = [...(brouillon.participants || [])]
  const pris = new Set()
  let reconnus = 0
  let ajoutes = 0
  let remplaces = 0
  lu.candidats.forEach((s, i) => {
    let p = reconnaitre(s.nom, participants, pris)
    if (p) reconnus++
    else {
      p = {
        id: `imp-${Date.now()}-${i}`,
        prenom: '', nom: s.nom, pays: s.pays || '', fonction: '',
        present: true, entreeBrut: '', sortieTheoBrut: '', sortiePratBrut: '',
        appreciation: '', ajoute: true,
      }
      participants.push(p)
      ajoutes++
    }
    pris.add(p.id)
    const notes = { ...(p.notesModules || {}) }
    let change = false
    s.notes.forEach((n, k) => {
      if (n == null || !ids[k]) return
      const v = String(Math.round(n))
      if (notes[ids[k]] != null && notes[ids[k]] !== '' && notes[ids[k]] !== v) change = true
      notes[ids[k]] = v
    })
    if (change) remplaces++
    const e = { ...(p.elearning || {}) }
    if (s.requis != null) e.requis = String(Math.round(s.requis))
    if (s.valides != null) e.valides = String(Math.round(s.valides))
    if (s.statut) e.statut = s.statut
    const k = participants.findIndex(x => x.id === p.id)
    participants[k] = { ...p, notesModules: notes, elearning: e, present: true }
  })
  return { modules, participants, reconnus, ajoutes, remplaces }
}
