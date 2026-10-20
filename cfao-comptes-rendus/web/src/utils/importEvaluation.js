import { BAREMES } from './baremeCfao'
import { MENTIONS, CRITERES_FORMATION, CRITERES_ACCUEIL } from './satisfactionCfao'
import { chargerClasseur } from './chargerClasseur'

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

// Les lignes du modele de l'application ; celles d'un classeur de
// formateur se retrouvent a leur libelle (cf. `lignesDe`) : les lignes
// TP y sont plus nombreuses, et tout ce qui suit descend d'autant.
const L = { noms: 4, filiale: 5, entree: 6, sortie: 7, pratique: 10, formation: 13, accueil: 20 }

// Les filiales s'ecrivent « CFAO MOBILITY CMR » : le code pays devient
// le nom qu'affiche l'application.
const PAYS = {
  CMR: 'Cameroun', SEN: 'Sénégal', CIV: 'Côte d’Ivoire', GAB: 'Gabon', COG: 'Congo',
  COD: 'RDC', RDC: 'RDC', MLI: 'Mali', BEN: 'Bénin', TGO: 'Togo', GIN: 'Guinée',
  MDG: 'Madagascar', BFA: 'Burkina Faso', NER: 'Niger', TCD: 'Tchad', NGA: 'Nigeria',
  GHA: 'Ghana', KEN: 'Kenya', MAR: 'Maroc', CAF: 'Centrafrique', GNQ: 'Guinée équatoriale',
}

/** « CFAO MOBILITY CMR » -> « Cameroun » ; un nom de pays reste tel quel. */
export function paysDe(filiale) {
  const reste = String(filiale ?? '').replace(/CFAO\s*MOBILITY/i, '').trim()
  if (!reste) return ''
  return PAYS[reste.toUpperCase()] || reste.charAt(0).toUpperCase() + reste.slice(1).toLowerCase()
}

const pad = n => String(n).padStart(2, '0')
const annee = a => (a < 100 ? 2000 + a : a)

/**
 * La periode de la ligne 2, quelle que soit sa graphie : « du 24-31.07.26 »,
 * « du 28.08-02.09.26 », « du 07.09.2026 au 11.09.2026 », ou saisie a la
 * main, « du 24 -au -31. 07 .2026 ». Renvoie `{ debut, fin }` en ISO.
 */
export function lirePeriode(texte) {
  const n = (String(texte ?? '').match(/\d+/g) || []).map(Number)
  let j1, m1, a1, j2, m2, a2
  if (n.length === 6) [j1, m1, a1, j2, m2, a2] = n
  else if (n.length === 5) { [j1, m1, j2, m2, a2] = n; a1 = a2 }
  else if (n.length === 4) { [j1, j2, m2, a2] = n; m1 = m2; a1 = a2 }
  else return {}
  const iso = (j, m, a) => (j >= 1 && j <= 31 && m >= 1 && m <= 12
    ? `${annee(a)}-${pad(m)}-${pad(j)}` : '')
  return { debut: iso(j1, m1, a1), fin: iso(j2, m2, a2) }
}

/** « FORMATION : TSH01: Intitulé » -> code et intitule. */
function lireTitre(texte) {
  const t = String(texte ?? '').replace(/^\s*FORMATION\s*:?\s*/i, '').replace(/\s+/g, ' ').trim()
  const m = t.match(/^([A-Z0-9][A-Z0-9-]{1,11})\s*:\s*(.+)$/)
  return m ? { codeFormation: m[1], intitule: m[2].trim() } : { codeFormation: '', intitule: t }
}

export const normaliser = t => String(t ?? '')
  .normalize('NFD').replace(/[̀-ͯ]/g, '')
  .toUpperCase().replace(/[^A-Z0-9]+/g, ' ').trim()

const mots = t => new Set(normaliser(t).split(' ').filter(Boolean))

/** La valeur affichee d'une cellule : formule, texte riche ou valeur. */
export function valeurDe(cell) {
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

/** Une note sur 100, ecrite en nombre ou en texte ; `null` sinon. */
function note(v) {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.').trim())
  return Number.isFinite(n) && n >= 0 && n <= 100 ? Math.round(n) : null
}

/** Un taux lu dans le classeur, en fraction : 0,6 ou « 60 % ». */
function taux(v) {
  if (v == null || v === '') return null
  const n = typeof v === 'number' ? v : Number(String(v).replace('%', '').replace(',', '.').trim())
  if (!Number.isFinite(n)) return null
  return n > 1.5 ? n / 100 : n
}

const MENTION_PAR_LIBELLE = Object.fromEntries(MENTIONS.map(m => [normaliser(m.libelle), m.cle]))

/**
 * Les lignes de la feuille, trouvees par leur libelle en colonne A ; a
 * defaut, celles du modele. Les lignes « TP 1 (G28001) » d'une
 * certification portent chacune la note d'un module.
 */
function lignesDe(ws) {
  const trouvees = {}
  const tps = []
  for (let r = 1; r <= Math.min(ws.rowCount, 80); r++) {
    const t = normaliser(valeurDe(ws.getCell(r, 1)))
    if (!t) continue
    const tp = t.match(/^TP (\d+)(?: ([A-Z0-9]+))?$/)
    if (tp) tps.push({ ligne: r, numero: Number(tp[1]), code: tp[2] || '' })
    else if (t === 'FILIALE') trouvees.filiale ??= r
    else if (t.startsWith('TEST THEORIQUE D ENTREE')) trouvees.entree ??= r
    else if (t.startsWith('TEST THEORIQUE DE SORTIE')) trouvees.sortie ??= r
    else if (t.startsWith('TEST PRATIQUE')) trouvees.pratique ??= r
    else if (t.startsWith('THEMES ABORDES')) trouvees.formation ??= r
    else if (t.startsWith('ACCUEIL A L AEROPORT')) trouvees.accueil ??= r
  }
  const l = { ...L, ...trouvees }
  if (trouvees.filiale) l.noms = trouvees.filiale - 1
  return { ...l, tps }
}

/**
 * Lit le fichier ; rejette s'il ne porte pas la feuille attendue.
 *
 * Renvoie `{ entete, stagiaires }` : l'entete (code, intitule, dates,
 * pays) sert a creer une saisie ; les stagiaires, a la remplir.
 */
export async function lireEvaluation(fichier) {
  const wb = await chargerClasseur(fichier)
  const ws = wb.worksheets.find(f => normaliser(f.name).startsWith('DONNEES'))
  if (!ws) throw new Error('Feuille « Données Stagiaires » introuvable')
  const L = lignesDe(ws)
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
      nom: String(nom).replace(/\s+/g, ' ').trim(),
      pays: paysDe(valeurDe(ws.getCell(L.filiale, c))),
      entree: taux(valeurDe(ws.getCell(L.entree, c))),
      sortie: taux(valeurDe(ws.getCell(L.sortie, c))),
      pratique: taux(valeurDe(ws.getCell(L.pratique, c))),
      // Les notes des TP, sur 100 : celles des modules en certification.
      tps: L.tps.map(t => ({ numero: t.numero, code: t.code, note: note(valeurDe(ws.getCell(t.ligne, c))) }))
        .filter(t => t.note != null),
      reponses,
    })
  }
  if (!stagiaires.length) throw new Error('Aucun stagiaire dans le classeur')
  const pays = stagiaires.map(x => x.pays).filter(Boolean)
  const entete = {
    ...lireTitre(valeurDe(ws.getCell('A1'))),
    ...lirePeriode(valeurDe(ws.getCell('A2'))),
    // Le pays le plus frequent parmi les filiales.
    pays: pays.sort((a, b) => pays.filter(x => x === b).length
      - pays.filter(x => x === a).length)[0] || '',
  }
  return { entete, stagiaires }
}

/**
 * Lit un classeur « Résultats » (une feuille : N°, nom, filiale, puis les
 * notes brutes d'entrée, de sortie théorique et de sortie pratique).
 * Même forme de retour que `lireEvaluation`, sans les avis : les notes,
 * ramenées à leur barème, sont celles qu'`appliquerEvaluation` reprend.
 */
export async function lireResultats(fichier) {
  const wb = await chargerClasseur(fichier)
  const ws = wb.worksheets.find(f => {
    for (let r = 1; r <= 8; r++) {
      if (normaliser(valeurDe(f.getCell(r, 3))).startsWith('NOMS')) return true
    }
    return false
  })
  if (!ws) throw new Error('Tableau « Noms & Prénoms » introuvable')
  let entete = 1
  while (!normaliser(valeurDe(ws.getCell(entete, 3))).startsWith('NOMS')) entete++
  const sur = c => Number(/\/\s*(\d+)/.exec(String(valeurDe(ws.getCell(entete, c)) ?? ''))?.[1]) || null
  const baremes = { entree: sur(5), sortie: sur(7), pratique: sur(9) }
  const rapporter = (v, bareme) => {
    const n = typeof v === 'number' ? v : Number(String(v ?? '').replace(',', '.').trim())
    return v == null || v === '-' || !Number.isFinite(n) || !bareme ? null : n / bareme
  }
  const stagiaires = []
  for (let r = entete + 1; r < entete + 200; r++) {
    const nom = valeurDe(ws.getCell(r, 3))
    if (nom == null || !String(nom).trim()) break
    // La moyenne fusionne B a D : son libelle se lit aussi en C. Elle
    // n'a pas de numero, un stagiaire si.
    if (normaliser(nom).startsWith('SCORE') || !Number.isFinite(Number(valeurDe(ws.getCell(r, 2))))) break
    stagiaires.push({
      nom: String(nom).replace(/\s+/g, ' ').trim(),
      pays: paysDe(valeurDe(ws.getCell(r, 4))),
      entree: rapporter(valeurDe(ws.getCell(r, 5)), baremes.entree),
      sortie: rapporter(valeurDe(ws.getCell(r, 7)), baremes.sortie),
      pratique: rapporter(valeurDe(ws.getCell(r, 9)), baremes.pratique),
      tps: [],
      reponses: {},
    })
  }
  if (!stagiaires.length) throw new Error('Aucun stagiaire dans le classeur')
  return { entete: {}, stagiaires }
}

/** Le participant du brouillon qui porte ce nom, s'il y en a un. */
export function reconnaitre(nom, participants, pris) {
  const cible = mots(nom)
  let meilleur = null
  let score = 0
  participants.forEach(p => {
    if (pris.has(p.id)) return
    const siens = mots(`${p.nom || ''} ${p.prenom || ''}`)
    if (!siens.size) return
    const communs = [...cible].filter(m => siens.has(m)).length
    // Un seul mot commun ne suffit pas quand les deux noms en ont
    // plusieurs : KEITA Mohamed n'est pas Sekou KEITA. Les noms de
    // famille courants d'une filiale se partagent entre collegues.
    if (communs < Math.min(2, cible.size, siens.size)) return
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
        prenom: '', nom: s.nom, pays: s.pays || '', fonction: '',
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
    let change = Object.entries(notes).some(([k, v]) => p[k] !== '' && p[k] != null && p[k] !== v)
    // En certification, chaque TP est la note d'un module : reconnu a
    // son code (« TP 1 (G28001) »), sinon a son rang.
    const modules = brouillon.type === 'certification' ? brouillon.modules || [] : []
    const notesModules = { ...(p.notesModules || {}) }
    ;(s.tps || []).forEach(t => {
      const m = (t.code && modules.find(x => normaliser(x.code) === t.code))
        || (!t.code && modules[t.numero - 1])
      if (!m) return
      const v = String(t.note)
      const avant = notesModules[m.id]
      if (avant !== '' && avant != null && String(avant) !== v) change = true
      notesModules[m.id] = v
    })
    if (change) remplaces++
    const k = participants.findIndex(x => x.id === p.id)
    participants[k] = { ...p, ...notes, ...(modules.length ? { notesModules } : {}), present: true }
    if (Object.keys(s.reponses).length) satisfaction[p.id] = { ...satisfaction[p.id], ...s.reponses }
  })
  return { participants, satisfaction, reconnus, ajoutes, remplaces }
}
