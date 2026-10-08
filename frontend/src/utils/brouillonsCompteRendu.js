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
    if (r.status === 409) return { ...(await r.json()), conflit: true }
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

/*
 * Deux onglets, ou deux postes, ouverts sur le meme compte rendu.
 *
 * L'heure d'un poste ne dit pas qui a vu la derniere version : une copie
 * ancienne, retouchee, etait re-datee et ecrasait le travail fait
 * ailleurs. Le serveur numerote donc chaque version (`revision`) et cet
 * onglet retient celle dont sa saisie est partie (`bases`). Un envoi parti
 * d'une version depassee est refuse ; l'onglet le signale au formateur,
 * qui reprend la version la plus recente ou garde la sienne en
 * connaissance de cause. `ECRIVAIN` distingue cet onglet : ses propres
 * envois s'enchainent sans conflit.
 */
const ECRIVAIN = Math.random().toString(36).slice(2, 12)
const bases = new Map()
// Ce que cet onglet a lu ou ecrit en dernier, par brouillon : sans
// changement depuis, il n'a rien a envoyer.
const vus = new Map()
const signer = b => JSON.stringify({
  ...b, _id: undefined, modifieLe: undefined, revision: undefined, ecrivain: undefined,
})
const rev = b => Number(b?.revision) || 0
const base = (id, b) => (bases.has(id) ? bases.get(id) : rev(b))

// Version, puis date : la date ne departage que deux copies d'une meme
// version — une saisie faite ici hors connexion, par exemple.
const plusRecent = (a, b) => (rev(a) !== rev(b) ? rev(a) > rev(b)
  : String(a?.modifieLe || '') > String(b?.modifieLe || ''))

// Les ecrans ouverts sur un brouillon, prevenus d'un conflit.
const ecoutes = new Map()
function signaler(id, recent) {
  (ecoutes.get(id) || new Set()).forEach(f => f(recent))
}

// Une version ecrite ailleurs, plus avancee que celle de cet onglet.
const depassePar = (id, b) => b && b.ecrivain !== ECRIVAIN && bases.has(id) && rev(b) > bases.get(id)

// Les envois au serveur, un par brouillon : la saisie en declenche un
// toutes les secondes et demie, inutile d'en empiler.
const enAttente = new Map()
const aEnvoyer = new Map()
async function partir(id) {
  clearTimeout(enAttente.get(id))
  enAttente.delete(id)
  const brouillon = aEnvoyer.get(id)
  aEnvoyer.delete(id)
  if (!brouillon) return
  const corps = { ...brouillon, revision: base(id, brouillon), ecrivain: ECRIVAIN }
  // `keepalive` : l'envoi aboutit meme si l'onglet se ferme.
  const r = await serveur(`/${encodeURIComponent(id)}`,
    { method: 'PUT', body: JSON.stringify(corps), keepalive: true })
  if (r?.conflit) {
    signaler(id, r.brouillon)
  } else if (r?.ecrit && r.brouillon) {
    const n = rev(r.brouillon)
    bases.set(id, Math.max(n, bases.get(id) || 0))
    const tout = lire()
    // La copie d'ici prolonge cet envoi : elle en prend le numero.
    if (tout[id]?.ecrivain === ECRIVAIN && rev(tout[id]) < n) {
      tout[id] = { ...tout[id], revision: n }
      ecrire(tout)
    }
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
  // Ni par rapport a la copie de ce navigateur, ni par rapport a ce que
  // cet onglet a lu ou ecrit en dernier : un onglet reste ouvert, qu'on
  // ferme, ne renvoie pas sa vieille copie par-dessus celle d'un autre.
  const signature = signer(brouillon)
  if (vus.get(id) === signature) return true
  if (tout[id] && signer(tout[id]) === signature) return true
  // Un autre onglet de ce navigateur a enregistre une version plus
  // avancee : la copie de cet onglet est perimee, elle n'ecrase rien.
  if (!bases.has(id)) bases.set(id, rev(brouillon))
  if (depassePar(id, tout[id])) {
    signaler(id, tout[id])
    return false
  }
  const date = {
    ...brouillon, _id: id, modifieLe: new Date().toISOString(),
    revision: bases.get(id), ecrivain: ECRIVAIN,
  }
  tout[id] = date
  vus.set(id, signature)
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
  const local = recuperer(id)
  if (!distant || (local && !plusRecent(distant, local))) {
    // La saisie de cet onglet repart de la copie d'ici.
    if (local) {
      bases.set(id, rev(local))
      vus.set(id, signer(local))
    }
    return null
  }
  return adopter(id, distant)
}

/** Cet onglet repart d'une version : celle du serveur ou d'un autre onglet. */
export function adopter(id, version) {
  bases.set(id, rev(version))
  vus.set(id, signer(version))
  const tout = lire()
  tout[id] = version
  ecrire(tout)
  return version
}

/**
 * Le formateur garde la saisie de cet onglet face a une version plus
 * recente : elle repart de cette version, et l'ecrase donc sciemment.
 */
export function garder(id, brouillon, recente) {
  bases.set(id, rev(recente))
  const date = {
    ...brouillon, _id: id, modifieLe: new Date().toISOString(),
    revision: rev(recente), ecrivain: ECRIVAIN,
  }
  const tout = lire()
  tout[id] = date
  ecrire(tout)
  vus.set(id, signer(brouillon))
  envoyer(id, date)
  return date
}

/**
 * Previent `quand(recente)` des que la copie ouverte dans cet onglet
 * est depassee : envoi refuse par le serveur, enregistrement d'un autre
 * onglet de ce navigateur, ou version d'un autre poste constatee au
 * retour sur l'onglet. Renvoie de quoi cesser d'ecouter.
 */
export function surveiller(id, quand) {
  if (!id) return () => {}
  if (!ecoutes.has(id)) ecoutes.set(id, new Set())
  ecoutes.get(id).add(quand)
  const autreOnglet = e => {
    if (e.key !== cle()) return
    const b = lire()[id]
    if (depassePar(id, b)) quand(b)
  }
  const retour = async () => {
    if (document.visibilityState !== 'visible') return
    const distant = await serveur(`/${encodeURIComponent(id)}`)
    if (distant && !distant.conflit && depassePar(id, distant)) quand(distant)
  }
  window.addEventListener('storage', autreOnglet)
  document.addEventListener('visibilitychange', retour)
  return () => {
    ecoutes.get(id)?.delete(quand)
    window.removeEventListener('storage', autreOnglet)
    document.removeEventListener('visibilitychange', retour)
  }
}

/** Efface un brouillon, ici et sur le serveur. */
export function oublier(id) {
  const tout = lire()
  delete tout[id]
  ecrire(tout)
  clearTimeout(enAttente.get(id))
  enAttente.delete(id)
  aEnvoyer.delete(id)
  bases.delete(id)
  vus.delete(id)
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
