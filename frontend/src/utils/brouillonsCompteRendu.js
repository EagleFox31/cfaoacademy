/**
 * Conservation des comptes rendus en cours.
 *
 * Une session se documente rarement d'un trait : le formateur saisit
 * les notes le vendredi, ajoute les photos le lundi — et pas forcement
 * sur le meme poste. Le brouillon est donc conserve par le serveur
 * (`/cr-donnees/brouillons`, service d'apercu pour l'instant, `cfao-core`
 * a terme), rattache au compte du formateur.
 *
 * Le navigateur en garde une copie : la saisie reste fluide et survit a
 * une coupure du serveur. Chaque ecriture part aux deux ; a la lecture,
 * la version la plus recente l'emporte, d'ou qu'elle vienne.
 *
 * Le stockage peut echouer — navigation privee, quota plein, serveur
 * arrete. Chaque acces est garde : un brouillon non synchronise est un
 * desagrement, une page blanche est une panne.
 */
import { pagesARemplir } from '../components/compte-rendu/PhaseVerification'
import { SESSIONS_FORMATEUR } from '../data/mock_sessions_formateur'

const CLE_ANCIENNE = 'cfao.comptes-rendus'
const API = '/cr-donnees/brouillons'

/** Le compte connecte : ses brouillons ne sont qu'a lui (le serveur le tient de la session). */
function utilisateur() {
  try {
    return JSON.parse(sessionStorage.getItem('cfao_mock_user') || 'null')?.id || null
  } catch {
    return null
  }
}

const cle = () => `${CLE_ANCIENNE}.${utilisateur() || 'anonyme'}`

function lire() {
  try {
    const brut = localStorage.getItem(cle())
    if (brut) return JSON.parse(brut)
    // Les brouillons d'avant le rattachement au compte : repris par le
    // premier compte qui ouvre ce navigateur.
    const ancien = localStorage.getItem(CLE_ANCIENNE)
    if (ancien && utilisateur()) {
      localStorage.setItem(cle(), ancien)
      localStorage.removeItem(CLE_ANCIENNE)
      return JSON.parse(ancien)
    }
    return {}
  } catch {
    return {}
  }
}

function ecrire(tout) {
  try {
    localStorage.setItem(cle(), JSON.stringify(tout))
    return true
  } catch {
    return false
  }
}

/** Un appel au serveur ; `null` s'il ne repond pas. */
async function serveur(chemin, options = {}) {
  const u = utilisateur()
  if (!u) return null
  try {
    const r = await fetch(`${API}${chemin}`, {
      ...options,
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
    })
    if (r.status === 404) return undefined
    if (!r.ok) return null
    return await r.json()
  } catch {
    return null
  }
}

const rempli = v => (Array.isArray(v) ? v.length > 0
  : v && typeof v === 'object' ? Object.values(v).some(rempli)
    : v != null && String(v).trim() !== '')

/**
 * Le brouillon porte-t-il quelque chose que le formateur a saisi ?
 *
 * Choisir une session du planning, ou ouvrir le formulaire de saisie
 * libre, ne suffit pas : ce qui vient du planning se retrouve sans
 * brouillon, et une carte « Saisie interrompue » sur un formulaire vide
 * ne reprend rien. Compte ce qui ne s'invente pas : les notes, la
 * satisfaction, les textes, les photos, les journees, les objectifs —
 * et pour une saisie libre, l'intitule, le code ou un nom de stagiaire.
 */
export function aDuContenu(b) {
  if (!b) return false
  const notes = (b.participants || []).some(p => aDesNotes(p) || rempli(p.elearning))
  const saisieLibre = b.manuel && (rempli(b.intitule) || rempli(b.codeFormation)
    || (b.participants || []).some(p => rempli(p.nom) || rempli(p.prenom)))
  return notes || saisieLibre
    || rempli(b.satisfaction) || rempli(b.textes) || rempli(b.photos)
    || rempli(b.photoGroupe) || rempli(b.jours) || rempli(b.objectifs)
    || rempli(b.legendes)
    // Des notes effacees a dessein : le brouillon doit s'enregistrer
    // quand meme, sinon l'ancienne version reviendrait au chargement.
    || rempli(b.reinitialiseLe)
}

/** Des notes de tests, ou de modules pour une certification. */
function aDesNotes(p) {
  return rempli(p.entreeBrut) || rempli(p.sortieTheoBrut) || rempli(p.sortiePratBrut)
    || rempli(p.notesModules)
}

const plusRecent = (a, b) => String(a?.modifieLe || '') > String(b?.modifieLe || '')

// Les envois au serveur, un par brouillon : la saisie en declenche un
// toutes les secondes et demie, inutile d'en empiler.
const enAttente = new Map()
const aEnvoyer = new Map()
function partir(id) {
  clearTimeout(enAttente.get(id))
  enAttente.delete(id)
  const brouillon = aEnvoyer.get(id)
  aEnvoyer.delete(id)
  if (brouillon) {
    // `keepalive` : l'envoi aboutit meme si l'onglet se ferme.
    serveur(`/${encodeURIComponent(id)}`,
      { method: 'PUT', body: JSON.stringify(brouillon), keepalive: true })
  }
}
function envoyer(id, brouillon) {
  clearTimeout(enAttente.get(id))
  aEnvoyer.set(id, brouillon)
  enAttente.set(id, setTimeout(() => partir(id), 800))
}
// Onglet ferme ou masque : ce qui attendait part tout de suite.
if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', () => [...aEnvoyer.keys()].forEach(partir))
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') [...aEnvoyer.keys()].forEach(partir)
  })
}

/**
 * Enregistre un brouillon sous son identifiant de session — seulement
 * s'il porte une saisie. Un brouillon redevenu vide est retire.
 */
export function enregistrer(id, brouillon) {
  if (!id) return false
  const tout = lire()
  // Un brouillon vide n'est jamais ecrit, et n'efface jamais rien.
  // Il effacait autrefois la copie existante : choisir une deuxieme fois
  // une session deja commencee repartait d'une page blanche, et cette
  // page blanche supprimait le travail enregistre, ici et sur le serveur.
  // Seule la corbeille (`oublier`) supprime un brouillon.
  if (!aDuContenu(brouillon)) return true
  // Rien n'a change : on ne re-date pas, sinon une copie ancienne
  // ouverte sur un autre poste passerait pour la plus recente.
  const sans = b => JSON.stringify({ ...b, _id: undefined, modifieLe: undefined })
  if (tout[id] && sans(tout[id]) === sans({ ...brouillon, _id: id })) return true
  const date = { ...brouillon, _id: id, modifieLe: new Date().toISOString() }
  tout[id] = date
  envoyer(id, date)
  return ecrire(tout)
}

/** Le brouillon d'une session tel que ce navigateur le connait, ou `null`. */
export function recuperer(id) {
  return lire()[id] || null
}

/**
 * Le brouillon d'une session, cote serveur si sa version est plus
 * recente — celle d'un autre poste. Renvoie `null` si rien de mieux.
 */
export async function recupererDuServeur(id) {
  const distant = await serveur(`/${encodeURIComponent(id)}`)
  if (!distant) return null
  const local = recuperer(id)
  if (local && !plusRecent(distant, local)) return null
  const tout = lire()
  tout[id] = distant
  ecrire(tout)
  return distant
}

/** Efface un brouillon, ici et sur le serveur. */
export function oublier(id) {
  const tout = lire()
  delete tout[id]
  ecrire(tout)
  clearTimeout(enAttente.get(id))
  enAttente.delete(id)
  aEnvoyer.delete(id)
  serveur(`/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/**
 * Rapproche ce navigateur et le serveur : les brouillons d'un autre
 * poste arrivent, ceux saisis ici hors connexion partent. Pour chaque
 * brouillon, la version la plus recente l'emporte. Renvoie la liste a
 * jour, ou `null` si le serveur ne repond pas.
 */
export async function synchroniser() {
  const reponse = await serveur('')
  const distants = reponse?.brouillons
  if (!Array.isArray(distants)) return null
  const tout = lire()
  // Supprime sur un autre poste depuis la derniere modification d'ici.
  Object.entries(reponse.supprimes || {}).forEach(([id, le]) => {
    if (tout[id] && String(tout[id].modifieLe || '') <= le) delete tout[id]
  })
  const vus = new Set()
  distants.forEach(d => {
    const id = d._id || d.sessionId
    if (!id) return
    vus.add(id)
    if (!tout[id] || plusRecent(d, tout[id])) tout[id] = d
    else if (plusRecent(tout[id], d)) envoyer(id, tout[id])
  })
  Object.entries(tout).forEach(([id, b]) => {
    if (!vus.has(id) && aDuContenu(b)) envoyer(id, { ...b, _id: id })
  })
  ecrire(tout)
  return brouillonsEnregistres()
}

/** Les brouillons en cours, du plus recent au plus ancien. */
export function brouillonsEnregistres() {
  const tout = lire()
  // Les brouillons vides enregistres avant cette regle disparaissent.
  const vides = Object.keys(tout).filter(id => !aDuContenu(tout[id]))
  if (vides.length) {
    vides.forEach(id => delete tout[id])
    ecrire(tout)
  }
  return Object.entries(tout)
    .map(([id, b]) => {
      const presents = (b.participants || []).filter(p => p.present !== false)
      return {
        id,
        // L'id d'une saisie manuelle (`manuel-<horodatage>`) n'est pas un
        // titre presentable : mieux vaut dire que rien n'est encore saisi.
        session: b.intitule || (b.sessionId?.startsWith('manuel-') ? null : b.sessionId),
        code: b.codeFormation || '',
        manuel: !!b.manuel,
        debut: b.debut || '',
        fin: b.fin || '',
        marque: b.marque || '',
        lieu: b.lieu || '',
        effectif: presents.length,
        notes: presents.filter(aDesNotes).length,
        certification: b.type === 'certification',
        modifieLe: b.modifieLe,
        phase: b.phase ?? 0,
        // Termine : toutes les pages remplies, selon la regle du sommaire
        // de l'etape « Completer ». Calcule, pas enregistre : un compte
        // rendu corrige jusqu'a laisser une page vide redevient en cours.
        termine: pagesARemplir(b, sessionDuBrouillon(b)) === 0,
        // Date du dernier « Terminer », a defaut de la derniere saisie.
        termineLe: b.termineLe || b.modifieLe,
      }
    })
    .sort((a, b) => String(b.modifieLe).localeCompare(String(a.modifieLe)))
}

/** La session d'un brouillon : celle du planning, ou celle qu'il decrit. */
export function sessionDuBrouillon(b) {
  if (b.manuel) {
    return {
      moduleFormation: b.intitule, codeFormation: b.codeFormation, marque: b.marque,
      lieu: b.lieu, paysHote: b.pays, debut: b.debut, fin: b.fin, nbJours: b.nbJours,
    }
  }
  return SESSIONS_FORMATEUR.find(s => s.id === b.sessionId) || null
}

/** Un compte rendu termine quitte les saisies en cours pour l'archive. */
export const estTermine = b => !!b?.termine

/** Les saisies en cours, sans les comptes rendus termines. */
export const brouillonsEnCours = (liste = brouillonsEnregistres()) => liste.filter(b => !estTermine(b))

/** Les comptes rendus termines, du plus recent au plus ancien. */
export const brouillonsTermines = (liste = brouillonsEnregistres()) => liste
  .filter(estTermine)
  .sort((a, b) => String(b.termineLe).localeCompare(String(a.termineLe)))
