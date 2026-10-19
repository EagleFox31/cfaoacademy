/**
 * Le formateur par defaut des prochains comptes rendus.
 *
 * Le nom du planning et « Formateur » ne disent pas comment le formateur
 * se presente. Quand un compte rendu termine les remplace, on lui propose
 * de les garder pour la suite ; c'est lui qui decide, et il peut retenir
 * son choix (`toujours` : on garde sans demander, `jamais` : on ne
 * demande plus).
 *
 * Le portrait n'est retenu que s'il est sur le serveur : un apercu local
 * ne vit que dans l'onglet qui l'a cree.
 */

const CHAMPS = ['nom', 'fonction', 'portrait']

function cle() {
  try {
    const id = JSON.parse(sessionStorage.getItem('cfao_mock_user') || 'null')?.id
    return `cfao.comptes-rendus.${id || 'anonyme'}.formateur`
  } catch {
    return 'cfao.comptes-rendus.anonyme.formateur'
  }
}

function lire() {
  try {
    return JSON.parse(localStorage.getItem(cle()) || 'null') || {}
  } catch {
    return {}
  }
}

function ecrire(v) {
  try {
    localStorage.setItem(cle(), JSON.stringify(v))
  } catch { /* stockage indisponible : on redemandera */ }
}

/** Le formateur d'un nouveau compte rendu : le defaut retenu, sinon celui de la session. */
export function formateurInitial(session) {
  const d = lire()
  const nom = d.nom || session?.formateur || ''
  return { nom, fonction: d.fonction || (nom ? 'Formateur' : ''), portrait: d.portrait || null }
}

/** Le choix retenu : `toujours`, `jamais`, ou rien (on demande). */
export const choixRetenu = () => lire().choix || null

/**
 * Ce que le formateur `f` d'un compte rendu termine change au defaut
 * actuel, champ par champ ; `{}` si rien.
 */
export function nouveautes(f, session) {
  const d = formateurInitial(session)
  const diff = {}
  if (f?.nom?.trim() && f.nom !== d.nom) diff.nom = f.nom
  if (f?.fonction?.trim() && f.fonction !== d.fonction) diff.fonction = f.fonction
  if (f?.portrait?.ref && f.portrait.ref !== d.portrait?.ref) diff.portrait = f.portrait
  return diff
}

/** Oublie le choix retenu : la proposition reviendra. Le defaut reste. */
export function oublierChoix() {
  const { choix, ...reste } = lire()
  if (choix) ecrire(reste)
}

/** Retient `diff` pour les prochains comptes rendus, et le choix s'il est donne. */
export function retenir(diff, choix) {
  const d = lire()
  const suite = { ...d }
  CHAMPS.forEach(c => { if (diff?.[c]) suite[c] = diff[c] })
  if (choix) suite.choix = choix
  ecrire(suite)
}
