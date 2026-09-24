import { BAREMES } from './baremeCfao'
import { MENTIONS, CRITERES_FORMATION, CRITERES_ACCUEIL } from './satisfactionCfao'

/**
 * Relit un classeur d'evaluation — celui qu'exporte l'etape 2, ou un
 * classeur de formateur du meme modele — et en reprend les notes et la
 * satisfaction dans le brouillon.
 *
 * La feuille « Données Stagiaires » porte tout : un stagiaire par
 * colonne a partir de B, son nom en ligne 4, les taux des tests en
 * lignes 6, 7 et 10, les mentions de satisfaction en lignes 13 a 25.
 * Les taux redeviennent des notes brutes par les baremes du brouillon.
 *
 * Les stagiaires sont reconnus a leur nom, dans n'importe quel ordre et
 * sans egard aux accents ni a l'ordre nom / prenom. Un stagiaire du
 * classeur absent du brouillon y est ajoute : apres un brouillon ecrase,
 * perdre une ligne serait pire que d'en avoir une a completer.
 */

const L = { noms: 4, entree: 6, sortie: 7, pratique: 10, formation: 13, accueil: 20 }

const normaliser = t => String(t ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()

const mots = t => new Set(normaliser(t).split(' ').filter(Boolean))

/** La valeur affichee d'une cellule : formule, texte riche ou valeur. */
function valeurDe(cell) {
  const v = cell?.value
  if (v == null) return null
  if (typeof v === 'object') {
    if ('result' in v) return v.result ?? null
    if (v.richText) return v.richText.map(r => r.text).join('')
    if (v.text) return v.text
    if (v.error) return null
  }
  return v
}

/** Un taux lu dans le classeur, en fraction : 0,6 ou « 60 % ». */
function taux(v) {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace('%', '').replace(',', '.').trim())
  if (!Number.isFinite(n)) return null
  return n > 1.5 ? n / 100 : n
}

const MENTION_PAR_LIBELLE = Object.fromEntries(MENTIONS.map(m => [normaliser(m.libelle), m.cle]))

/** Lit le fichier ; rejette s'il ne porte pas la feuille attendue. */
export async function lireEvaluation(fichier) {
  const { default: ExcelJS } = await import('exceljs')
  const wb = new ExcelJS.Workbook()
  await wb.xlsx.load(await fichier.arrayBuffer())
  const ws = wb.worksheets.find(f => normaliser(f.name).startsWith('DONNEES'))
  if (!ws) throw new Error('Feuille « Données Stagiaires » introuvable')
  const stagiaires = []
  for (let c = 2; c < 80; c++) {
    const nom = valeurDe(ws.getCell(L.noms, c))
    if (nom == null || !String(nom).trim()) break
    if (normaliser(nom) === 'GLOBAL') break
    const reponses = {}
    ;[...CRITERES_FORMATION.map((k, j) => [k, L.formation + j]),
      ...CRITERES_ACCUEIL.map((k, j) => [k, L.accueil + j])].forEach(([crit, r]) => {
      const mention = MENTION_PAR_LIBELLE[normaliser(valeurDe(ws.getCell(r, c)))]
      if (mention) reponses[crit.cle] = mention
    })
    stagiaires.push({
      nom: String(nom).trim(),
      entree: taux(valeurDe(ws.getCell(L.entree, c))),
      sortie: taux(valeurDe(ws.getCell(L.sortie, c))),
      pratique: taux(valeurDe(ws.getCell(L.pratique, c))),
      reponses,
    })
  }
  if (!stagiaires.length) throw new Error('Aucun stagiaire dans le classeur')
  return stagiaires
}

/** Le participant du brouillon qui porte ce nom, s'il y en a un. */
function reconnaitre(nom, participants, pris) {
  const cible = mots(nom)
  let meilleur = null
  let score = 0
  participants.forEach(p => {
    if (pris.has(p.id)) return
    const siens = mots(`${p.nom || ''} ${p.prenom || ''}`)
    if (!siens.size) return
    const communs = [...cible].filter(m => siens.has(m)).length
    const s = communs / Math.max(cible.size, siens.size)
    if (s > score) { score = s; meilleur = p }
  })
  return score >= 0.5 ? meilleur : null
}

/**
 * Les modifications a apporter au brouillon.
 *
 * Renvoie `{ participants, satisfaction, reconnus, ajoutes, remplaces }` :
 * `remplaces` compte les stagiaires dont une note deja saisie change,
 * pour demander confirmation avant d'ecraser.
 */
export function appliquerEvaluation(brouillon, stagiaires) {
  const baremes = brouillon.baremes || BAREMES
  const brut = (v, sur) => (v == null ? '' : String(Math.round(v * sur)))
  const participants = [...(brouillon.participants || [])]
  const satisfaction = { ...(brouillon.satisfaction || {}) }
  const pris = new Set()
  let reconnus = 0
  let ajoutes = 0
  let remplaces = 0
  stagiaires.forEach((s, i) => {
    let p = reconnaitre(s.nom, participants, pris)
    if (p) reconnus++
    else {
      p = {
        id: `imp-${Date.now()}-${i}`,
        prenom: '', nom: s.nom, pays: '', fonction: '',
        present: true, entreeBrut: '', sortieTheoBrut: '', sortiePratBrut: '',
        appreciation: '', ajoute: true,
      }
      participants.push(p)
      ajoutes++
    }
    pris.add(p.id)
    // Une case vide du classeur ne vide pas une note deja saisie.
    const notes = Object.fromEntries([
      ['entreeBrut', s.entree, baremes.entreeTheorique],
      ['sortieTheoBrut', s.sortie, baremes.sortieTheorique],
      ['sortiePratBrut', s.pratique, baremes.sortiePratique],
    ].filter(([, v]) => v != null).map(([k, v, sur]) => [k, brut(v, sur)]))
    const change = Object.entries(notes).some(([k, v]) => p[k] !== '' && p[k] != null && p[k] !== v)
    if (change) remplaces++
    const k = participants.findIndex(x => x.id === p.id)
    participants[k] = { ...p, ...notes, present: true }
    if (Object.keys(s.reponses).length) satisfaction[p.id] = { ...satisfaction[p.id], ...s.reponses }
  })
  return { participants, satisfaction, reconnus, ajoutes, remplaces }
}
