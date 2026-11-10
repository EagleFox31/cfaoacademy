/**
 * Les filtres de la liste des sessions : ce qu'ils proposent et quand
 * le filtre « formateur » s'affiche. La recherche elle-meme est faite
 * par le service.
 */

/** Un formateur « pur » n'a aucun role au-dela de formateur : il ne voit que ses sessions. */
export function formateurPur(user) {
  const roles = Array.isArray(user?.roles) ? user.roles : []
  return roles.every(r => r === 'formateur')
}

/** Les noms des formateurs de la session. */
export function formateursDeSession(s) {
  if (Array.isArray(s?.formateurs) && s.formateurs.length) {
    return s.formateurs.map(f => String(f?.nom || '').trim()).filter(Boolean)
  }
  return s?.formateur ? [String(s.formateur).trim()] : []
}

const sansDoublon = valeurs => [...new Set(valeurs.filter(Boolean))]
  .sort((a, b) => a.localeCompare(b, 'fr'))

/** Les formateurs distincts d'une liste de sessions, par ordre alphabetique. */
export function formateursDe(sessions) {
  return sansDoublon((sessions || []).flatMap(formateursDeSession))
}

/**
 * Le filtre formateur ne sert que s'il y a un choix : toujours pour qui
 * n'est pas formateur pur, et pour un formateur seulement si sa liste
 * en compte plusieurs (sessions animees a plusieurs). `formateurs` est
 * la liste des noms deja rencontres.
 */
export function filtreFormateurVisible(user, formateurs) {
  return !formateurPur(user) || (formateurs || []).length > 1
}

export const OPTIONS_VIDES = { pays: [], marques: [], formateurs: [] }

/**
 * Ce que les filtres proposent : les pays, marques et formateurs deja
 * rencontres. Une liste filtree ne doit pas faire disparaitre les choix
 * qui permettraient de revenir en arriere.
 */
export function fusionnerOptions(options, sessions) {
  const o = options || OPTIONS_VIDES
  return {
    pays: sansDoublon([...o.pays, ...valeursDe(sessions, 'paysHote')]),
    marques: sansDoublon([...o.marques, ...valeursDe(sessions, 'marque')]),
    formateurs: sansDoublon([...o.formateurs, ...formateursDe(sessions)]),
  }
}

/** Les valeurs distinctes d'un champ des sessions (`paysHote`, `marque`). */
export function valeursDe(sessions, champ) {
  return sansDoublon((sessions || []).map(s => String(s?.[champ] || '').trim()))
}

/** Vrai si au moins un filtre est renseigne. */
export const filtresActifs = f => Object.values(f || {}).some(v => String(v ?? '').trim() !== '')
