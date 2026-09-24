/**
 * Conservation locale des comptes rendus en cours.
 *
 * Une session se documente rarement d'un trait : le formateur saisit
 * les notes le vendredi, ajoute les photos le lundi. Le brouillon
 * survit donc a la fermeture de l'onglet.
 *
 * Le stockage peut echouer — navigation privee, quota plein. Chaque
 * acces est garde : un brouillon perdu est un desagrement, une page
 * blanche est une panne.
 */
const CLE = 'cfao.comptes-rendus'

function lire() {
  try {
    const brut = localStorage.getItem(CLE)
    return brut ? JSON.parse(brut) : {}
  } catch {
    return {}
  }
}

function ecrire(tout) {
  try {
    localStorage.setItem(CLE, JSON.stringify(tout))
    return true
  } catch {
    return false
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
  const notes = (b.participants || []).some(p =>
    rempli(p.entreeBrut) || rempli(p.sortieTheoBrut) || rempli(p.sortiePratBrut))
  const saisieLibre = b.manuel && (rempli(b.intitule) || rempli(b.codeFormation)
    || (b.participants || []).some(p => rempli(p.nom) || rempli(p.prenom)))
  return notes || saisieLibre
    || rempli(b.satisfaction) || rempli(b.textes) || rempli(b.photos)
    || rempli(b.photoGroupe) || rempli(b.jours) || rempli(b.objectifs)
    || rempli(b.legendes)
}

/**
 * Enregistre un brouillon sous son identifiant de session — seulement
 * s'il porte une saisie. Un brouillon redevenu vide est retire.
 */
export function enregistrer(id, brouillon) {
  if (!id) return false
  const tout = lire()
  if (!aDuContenu(brouillon)) {
    if (!(id in tout)) return true
    delete tout[id]
    return ecrire(tout)
  }
  tout[id] = { ...brouillon, modifieLe: new Date().toISOString() }
  return ecrire(tout)
}

/** Le brouillon d'une session, ou `null`. */
export function recuperer(id) {
  return lire()[id] || null
}

/** Efface un brouillon — apres production du rapport, par exemple. */
export function oublier(id) {
  const tout = lire()
  delete tout[id]
  ecrire(tout)
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
    .map(([id, b]) => ({
      id,
      // L'id d'une saisie manuelle (`manuel-<horodatage>`) n'est pas un
      // titre presentable : mieux vaut dire que rien n'est encore saisi.
      session: b.intitule || (b.sessionId?.startsWith('manuel-') ? null : b.sessionId),
      modifieLe: b.modifieLe,
      phase: b.phase ?? 0,
    }))
    .sort((a, b) => String(b.modifieLe).localeCompare(String(a.modifieLe)))
}
