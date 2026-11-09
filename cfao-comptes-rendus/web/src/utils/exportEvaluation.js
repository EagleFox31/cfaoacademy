import { BAREMES, lireNote, reglesAuSeuil, seuilDe } from './baremeCfao'
import { MENTIONS, CRITERES_FORMATION, CRITERES_ACCUEIL } from './satisfactionCfao'
import { estCertification, niveauDe } from './certification'

/**
 * Le classeur d'evaluation d'une session, rempli dans le modele du
 * formateur (`public/modeles/evaluation.xlsx`, tire du classeur
 * « Evaluation … Climatisation … ») : memes feuilles, memes lignes, meme
 * mise en forme.
 *
 * Seul le nombre de colonnes de stagiaires change. Le modele en prevoit
 * douze (B a M) ; ici on en pose autant que de stagiaires presents, en
 * reprenant le style des colonnes du modele, et tout ce qui suit (GLOBAL,
 * bareme de ponderation) glisse d'autant. Les formules sont reecrites
 * pour couvrir exactement ces colonnes : dans les originaux, figees sur
 * B:M, les stagiaires au-dela du douzieme n'etaient pas comptes.
 *
 * Deux corrections de formule, sans toucher a la presentation :
 * « Accueil a l'aeroport » lit sa propre ligne (l'original lisait celle
 * du repas au CFR), et la progression GLOBAL est la moyenne des
 * progressions de chacun, comme dans le compte rendu.
 */

export const MODELE_EVALUATION = '/modeles/evaluation.xlsx'

const DONNEES = 'Données Stagiaires'
const SYNTHESE = 'Satisfaction Stagiaires'
const REF = `'${DONNEES}'!`

// ── Geometrie du modele ─────────────────────────────────────────────
// « Données Stagiaires » : noms en ligne 4, un stagiaire par colonne a
// partir de B (le modele va jusqu'a O).
const D = {
  titre: 1, periode: 2, noms: 4, filiale: 5, entree: 6, sortie: 7,
  pratique: 10, acquisition: 11,
  formation: 13, // 13 a 19
  accueil: 20, // 20 a 25
  derniere: 25,
  colonnesModele: 15, // B a O
}
// « Satisfaction Stagiaires » : lignes 1 a 30 en colonnes (stagiaires,
// GLOBAL, bareme) ; en dessous, les decomptes en colonnes A a H fixes.
const S = {
  noms: 5, filiale: 6, entree: 7, sortie: 8, progression: 9, durant: 10,
  pratique: 11, acquisition: 12,
  formation: 14, totalFormation: 21,
  accueil: 23, totalAccueil: 29,
  derniereMobile: 30,
  bareme: 7, // mentions de P7 a P11, scores en Q
  decompteFormation: 33, decompteAccueil: 43,
  // Colonnes du modele : B premiere, C courante, N GLOBAL, O vide, P a T bareme.
  global: 14,
  finModele: 20,
}

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

const copie = o => (o ? JSON.parse(JSON.stringify(o)) : {})

/** L'instantane des cellules d'un bloc du modele : valeur, style, note. */
function instantane(ws, lignes, colonnes) {
  const m = {}
  for (let r = 1; r <= lignes; r++) {
    for (let c = 1; c <= colonnes; c++) {
      const cell = ws.getCell(r, c)
      m[`${r}:${c}`] = { valeur: cell.value, style: copie(cell.style), note: cell.note }
    }
  }
  return m
}

/** Vide un bloc : valeur, style et note. */
function vider(ws, lignes, de, a) {
  for (let r = 1; r <= lignes; r++) {
    for (let c = de; c <= a; c++) {
      const cell = ws.getCell(r, c)
      cell.value = null
      cell.style = {}
      // La note n'a pas de suppression publique : on retire le commentaire.
      if (cell.note) cell._comment = undefined
    }
  }
}

/** Le style d'une colonne du modele, pose sur une autre colonne. */
function poserColonne(ws, snap, lignes, source, cible, garderValeur) {
  for (let r = 1; r <= lignes; r++) {
    const s = snap[`${r}:${source}`]
    const cell = ws.getCell(r, cible)
    cell.style = copie(s.style)
    if (garderValeur) {
      cell.value = s.valeur
      if (s.note) cell.note = s.note
    }
  }
}

/** « du 07-11.09.26 », ou « du 28.08-02.09.26 » a cheval sur deux mois. */
export function periodeCourte(debut, fin) {
  if (!debut) return ''
  const [a1, m1, j1] = debut.split('-')
  const [a2, m2, j2] = (fin || debut).split('-')
  const au = `${j2}.${m2}.${a2.slice(2)}`
  if (a1 === a2 && m1 === m2) return `du ${j1}-${au}`
  return `du ${j1}.${m1}-${au}`
}

/**
 * Les lignes TP de « Données Stagiaires ». Le modele en a deux (TP 1 et
 * TP 6, lignes 8 et 9), vides pour une formation. Une certification y
 * met la note de chaque module, comme le classeur G2 des formateurs
 * (« TP 1 (G28001) ») : une ligne par module, et tout ce qui suit
 * descend d'autant. Renvoie la geometrie qui en resulte.
 */
function poserLignesTp(ws, nbModules) {
  const nb = Math.max(nbModules, 2)
  if (nb > 2) {
    ws.spliceRows(9, 0, ...Array.from({ length: nb - 2 }, () => []))
    const modele = ws.getRow(8)
    for (let r = 9; r < nb + 7; r++) {
      const ligne = ws.getRow(r)
      ligne.height = modele.height
      for (let c = 1; c <= D.colonnesModele; c++) ligne.getCell(c).style = copie(modele.getCell(c).style)
    }
  }
  // Les listes de mentions du modele visent des lignes fixes (B13:O25) :
  // on les retire, chaque case recoit plus bas la sienne.
  ws.dataValidations.model = {}
  const d = nb - 2
  return {
    ...D, tp: 8, nbTp: nb,
    pratique: D.pratique + d, acquisition: D.acquisition + d,
    formation: D.formation + d, accueil: D.accueil + d, derniere: D.derniere + d,
  }
}

// `D` : la geometrie de `poserLignesTp`, qui masque celle du modele.
function remplirDonnees(ws, stagiaires, brouillon, session, D, modules = []) {
  const n = stagiaires.length
  const snap = instantane(ws, D.derniere, D.colonnesModele)
  vider(ws, D.derniere, 2, Math.max(D.colonnesModele, n + 1))
  // Premiere colonne B, derniere O (bord droit epais), les autres C.
  stagiaires.forEach((_, i) => {
    const source = i === 0 ? 2 : i === n - 1 ? D.colonnesModele : 3
    poserColonne(ws, snap, D.derniere, source, 2 + i, false)
  })

  const code = brouillon.codeFormation || session?.codeFormation || ''
  const intitule = brouillon.intitule || session?.moduleFormation || ''
  ws.getCell('A1').value = `FORMATION : ${[code, intitule].filter(Boolean).join(': ')}`
  ws.getCell('A2').value = periodeCourte(brouillon.debut, brouillon.fin)
  modules.forEach((m, j) => {
    ws.getCell(D.tp + j, 1).value = `TP ${j + 1}${m.code ? ` (${m.code})` : ''}`
  })
  if (modules.length === 1) ws.getCell(D.tp + 1, 1).value = null

  const baremes = brouillon.baremes || BAREMES
  // La note telle que saisie, meme hors bareme : le classeur garde la
  // trace de l'erreur au lieu d'une case vide.
  const taux = (v, sur) => {
    const n = lireNote(v)
    return n == null || !sur ? null : n / sur
  }
  const reponses = brouillon.satisfaction || {}
  const liste = `"${MENTIONS.map(m => m.libelle).join(',')}"`
  const DERNIERE = lettre(n + 1)

  stagiaires.forEach((p, i) => {
    const c = lettre(2 + i)
    ws.getCell(`${c}${D.noms}`).value = [p.nom, p.prenom].filter(Boolean).join(' ').toUpperCase()
    ws.getCell(`${c}${D.filiale}`).value = p.pays ? `CFAO MOBILITY ${p.pays.toUpperCase()}` : null
    ws.getCell(`${c}${D.entree}`).value = taux(p.entreeBrut, baremes.entreeTheorique)
    ws.getCell(`${c}${D.sortie}`).value = taux(p.sortieTheoBrut, baremes.sortieTheorique)
    if (modules.length) {
      // Certification : une note sur 100 par TP, et le test pratique en
      // est la moyenne, en taux comme dans le modele.
      modules.forEach((m, j) => {
        const cell = ws.getCell(`${c}${D.tp + j}`)
        const v = p.notesModules?.[m.id]
        cell.value = lireNote(v)
        cell.numFmt = 'General'
        cell.dataValidation = {
          type: 'decimal', operator: 'between', allowBlank: true, showErrorMessage: true,
          formulae: [0, 100], errorTitle: 'Note', error: 'Une note de 0 à 100.',
        }
      })
      const tps = `${c}${D.tp}:${c}${D.tp + modules.length - 1}`
      ws.getCell(`${c}${D.pratique}`).value = { formula: `IF(COUNT(${tps})=0,"",AVERAGE(${tps})/100)` }
    } else {
      ws.getCell(`${c}${D.pratique}`).value = taux(p.sortiePratBrut, baremes.sortiePratique)
    }
    ws.getCell(`${c}${D.acquisition}`).value = {
      formula: `IF(COUNT(${c}${D.sortie},${c}${D.pratique})=0,"",AVERAGE(${c}${D.sortie},${c}${D.pratique}))`,
    }
    ;[...CRITERES_FORMATION.map((k, j) => [k, D.formation + j]),
      ...CRITERES_ACCUEIL.map((k, j) => [k, D.accueil + j])].forEach(([crit, r]) => {
      const cell = ws.getCell(`${c}${r}`)
      const m = MENTIONS.find(x => x.cle === reponses[p.id]?.[crit.cle])
      cell.value = m ? m.libelle : null
      cell.dataValidation = { type: 'list', allowBlank: true, showErrorMessage: true, formulae: [liste] }
    })
  })

  // Mise en forme conditionnelle du modele (vert au seuil, rouge sinon),
  // etendue aux colonnes reelles.
  ws.conditionalFormattings?.forEach(cf => {
    // Pas de test theorique en certification : sa ligne vide passerait
    // pour une note sous le seuil.
    cf.ref = `${modules.length ? '' : `B${D.sortie}:${DERNIERE}${D.sortie} `}B${D.pratique}:${DERNIERE}${D.acquisition}`
  })
}

function remplirSynthese(ws, n, D) {
  const snap = instantane(ws, S.derniereMobile, S.finModele)
  const fusions = ['N5:N6', 'N14:N21', 'N23:N29']
  fusions.forEach(f => { try { ws.unMergeCells(f) } catch { /* deja defaite */ } })

  const iG = 2 + n // GLOBAL
  const decalage = iG - S.global
  const fin = Math.max(S.finModele, S.finModele + decalage)
  const largeurs = {}
  for (let c = 1; c <= S.finModele; c++) largeurs[c] = ws.getColumn(c).width

  vider(ws, S.derniereMobile, 2, fin)
  for (let i = 0; i < n; i++) poserColonne(ws, snap, S.derniereMobile, i === 0 ? 2 : 3, 2 + i, false)
  // GLOBAL, la colonne vide et le bareme, avec leurs textes et notes.
  for (let c = S.global; c <= S.finModele; c++) {
    poserColonne(ws, snap, S.derniereMobile, c, c + decalage, true)
  }

  // Largeurs : celles du modele pour les stagiaires (B, C, puis la
  // largeur par defaut), puis celles de GLOBAL et du bareme a leur place.
  for (let c = 2; c <= fin; c++) {
    const source = c < iG ? Math.min(c, 4) : c - decalage
    ws.getColumn(c).width = largeurs[source]
  }
  const G = lettre(iG)
  ;[[5, 6], [14, 21], [23, 29]].forEach(([a, b]) => ws.mergeCells(`${G}${a}:${G}${b}`))

  // Le bareme, lu par les formules des criteres.
  const P = lettre(S.global + 2 + decalage)
  const Q = lettre(S.global + 3 + decalage)
  const score = libelleCell => MENTIONS
    .map((_, k) => [`$${P}$${S.bareme + k}`, `$${Q}$${S.bareme + k}`])
    .reduceRight((suite, [p, q]) => `IF(${libelleCell}=${p},${q},${suite})`, '""')

  const DN = lettre(n + 1)
  const plage = r => `B${r}:${DN}${r}`
  const f = formula => ({ formula })

  for (let i = 0; i < n; i++) {
    const c = lettre(2 + i)
    const lien = r => f(`IF(ISBLANK(${REF}${c}${r}),"",${REF}${c}${r})`)
    ws.getCell(`${c}${S.noms}`).value = f(`${REF}${c}${D.noms}`)
    ws.getCell(`${c}${S.filiale}`).value = lien(D.filiale)
    ws.getCell(`${c}${S.entree}`).value = lien(D.entree)
    ws.getCell(`${c}${S.sortie}`).value = lien(D.sortie)
    ws.getCell(`${c}${S.progression}`).value = f(`IFERROR((${c}${S.sortie}-${c}${S.entree})/${c}${S.entree},"")`)
    ws.getCell(`${c}${S.durant}`).value = lien(D.sortie)
    ws.getCell(`${c}${S.pratique}`).value = lien(D.pratique)
    ws.getCell(`${c}${S.acquisition}`).value = f(`IFERROR(AVERAGE(${c}${S.durant},${c}${S.pratique}),"")`)
    CRITERES_FORMATION.forEach((_, j) => {
      ws.getCell(`${c}${S.formation + j}`).value = f(score(`${REF}${c}${D.formation + j}`))
    })
    ws.getCell(`${c}${S.totalFormation}`).value = f(`IFERROR(AVERAGE(${c}${S.formation}:${c}${S.totalFormation - 1})/100,"")`)
    CRITERES_ACCUEIL.forEach((_, j) => {
      ws.getCell(`${c}${S.accueil + j}`).value = f(score(`${REF}${c}${D.accueil + j}`))
    })
    ws.getCell(`${c}${S.totalAccueil}`).value = f(`IFERROR(AVERAGE(${c}${S.accueil}:${c}${S.totalAccueil - 1})/100,"")`)
  }

  ;[S.entree, S.sortie, S.durant, S.pratique].forEach(r => {
    ws.getCell(`${G}${r}`).value = f(`IFERROR(AVERAGE(${plage(r)}),"")`)
  })
  ws.getCell(`${G}${S.progression}`).value = f(`IFERROR(AVERAGE(${plage(S.progression)}),"")`)
  ws.getCell(`${G}${S.acquisition}`).value = f(`IFERROR(AVERAGE(${G}${S.durant},${G}${S.pratique}),"")`)
  ws.getCell(`${G}${S.formation}`).value = f(`IFERROR(AVERAGE(${plage(S.totalFormation)}),"")`)
  ws.getCell(`${G}${S.accueil}`).value = f(`IFERROR(AVERAGE(${plage(S.totalAccueil)}),"")`)

  ws.conditionalFormattings?.forEach(cf => { cf.ref = plage(S.acquisition) })

  // Decomptes des mentions : colonnes fixes, plages ajustees.
  const decompte = (r0, nb, source) => {
    for (let j = 0; j < nb; j++) {
      const r = r0 + j
      const ligne = `${REF}B${source + j}:${DN}${source + j}`
      MENTIONS.forEach((m, k) => {
        ws.getCell(r, 2 + k).value = f(`COUNTIF(${ligne},"${m.libelle}")`)
      })
      ws.getCell(`G${r}`).value = f(`IFERROR((PRODUCT(B${r},1)+PRODUCT(C${r},0.75)+PRODUCT(D${r},0.5)+PRODUCT(E${r},0.25)+PRODUCT(F${r},0))/(SUM(B${r}:F${r})),"")`)
      ws.getCell(`H${r}`).value = f(`IFERROR(G${r},"")`)
    }
  }
  decompte(S.decompteFormation, CRITERES_FORMATION.length, D.formation)
  decompte(S.decompteAccueil, CRITERES_ACCUEIL.length, D.accueil)
}

/** Le nom du fichier, lisible et sans caractere interdit. */
/**
 * Le nom du fichier, sur le modele des classeurs des formateurs :
 * « Evaluation Diagnostic des Systèmes de Climatisation du 10-14.08.26 ».
 * L'intitule plutot que le code : c'est lui qu'on cherche dans un dossier.
 */
export function nomFichier(brouillon, session) {
  // En certification, le nom du classeur G3 des formateurs :
  // « Evaluation Post Certification G3 GUINEE du 13-17.04.26 ».
  if (estCertification(brouillon)) {
    const pays = String(brouillon.pays || session?.paysHote || '').toUpperCase()
    const periode = periodeCourte(brouillon.debut, brouillon.fin)
    return ['Evaluation Post Certification', niveauDe(brouillon), pays, periode]
      .filter(Boolean).join(' ').concat('.xlsx')
      .replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ')
  }
  const intitule = (brouillon.intitule || session?.moduleFormation || '').trim()
  const nom = intitule || brouillon.codeFormation || session?.codeFormation || 'session'
  const periode = periodeCourte(brouillon.debut, brouillon.fin)
  return `Evaluation ${nom}${periode ? ` ${periode}` : ''}.xlsx`
    .replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ')
}

/**
 * Le nom du rapport, sans extension (le service ajoute `.pptx` ou `.pdf`),
 * sur le modele des comptes rendus des formateurs :
 * « Compte rendu formation Diagnostic des Systèmes de Climatisation du 10-14.08.26 »,
 * et en certification « Compte rendu Certification pratique G3 GUINEE du 13-17.04.26 ».
 */
export function nomCompteRendu(brouillon, session) {
  const periode = periodeCourte(brouillon.debut, brouillon.fin)
  let tete
  if (estCertification(brouillon)) {
    const pays = String(brouillon.pays || session?.paysHote || '').toUpperCase()
    tete = ['Compte rendu Certification pratique', niveauDe(brouillon), pays]
  } else {
    const intitule = (brouillon.intitule || session?.moduleFormation || '').trim()
    tete = ['Compte rendu formation', intitule || brouillon.codeFormation || session?.codeFormation || 'session']
  }
  return [...tete, periode].filter(Boolean).join(' ')
    .replace(/[\\/:*?"<>|]+/g, '-').replace(/\s+/g, ' ').trim()
}

/**
 * Remplit le modele et le propose au telechargement.
 *
 * Seuls les stagiaires presents y figurent, dans l'ordre de la saisie.
 * `modele` : le fichier est un modele vierge, et son nom le dit.
 * La bibliotheque et le modele ne sont charges qu'au moment de l'export.
 */
export async function exporterEvaluation(brouillon, session, { modele = false } = {}) {
  const [{ default: ExcelJS }, reponse] = await Promise.all([
    import('exceljs'),
    fetch(MODELE_EVALUATION),
  ])
  if (!reponse.ok) throw new Error('Modèle Excel introuvable')
  const wb = await construireClasseur(ExcelJS, await reponse.arrayBuffer(), brouillon, session)
  const tampon = await wb.xlsx.writeBuffer()
  const blob = new Blob([tampon], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `${modele ? 'Modèle ' : ''}${nomFichier(brouillon, session)}`
  document.body.appendChild(a)
  a.click()
  document.body.removeChild(a)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Le classeur lui-meme, sans le telechargement : il se construit aussi
 *  hors du navigateur, pour le verifier. */
export async function construireClasseur(ExcelJS, modele, brouillon, session) {
  const stagiaires = (brouillon.participants || []).filter(p => p.present !== false)
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(modele)
  const modules = estCertification(brouillon) ? brouillon.modules || [] : []
  const donnees = wb.getWorksheet(DONNEES)
  const geometrie = poserLignesTp(donnees, modules.length)
  remplirDonnees(donnees, stagiaires, brouillon, session, geometrie, modules)
  remplirSynthese(wb.getWorksheet(SYNTHESE), Math.max(stagiaires.length, 1), geometrie)
  // Excel recalcule a l'ouverture : les valeurs s'affichent sans
  // qu'on ait a appuyer sur F9.
  wb.calcProperties = { fullCalcOnLoad: true }
  const seuil = seuilDe(brouillon)
  wb.eachSheet(ws => ws.conditionalFormattings?.forEach(cf => { cf.rules = reglesAuSeuil(cf.rules, seuil) }))
  return wb
}
