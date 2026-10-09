/**
 * Variante de portail apprenant.
 *
 * `pl-medacap` : parcours Technicien Poids Lourds piloté par la méthode MEDACAP
 * (chaîne de priorité séquentielle dans « À faire maintenant », filtre N+1 des
 * formations, section « Formations suggérées », carte de test enrichie…).
 *
 * Tout profil qui porte `lms.portalVariant === 'pl-medacap'` obtient cette
 * expérience — aucun test sur un id utilisateur. Sans flag, le comportement
 * historique du portail est conservé à l'identique.
 */
export const PORTAL_VARIANT_PL_MEDACAP = 'pl-medacap'

export function isPlMedacapVariant(lms) {
  return lms?.portalVariant === PORTAL_VARIANT_PL_MEDACAP
}
