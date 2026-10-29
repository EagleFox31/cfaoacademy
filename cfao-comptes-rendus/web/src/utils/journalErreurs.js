/**
 * Le journal des erreurs du service des comptes rendus.
 *
 * Ce que le portail constate (aperçu refusé, rapport jamais produit,
 * coupure réseau) n'apparaît pas forcément côté service : on le lui
 * signale pour que l'équipe technique le retrouve sur
 * `/portail/journal-erreurs`. Le signalement ne doit jamais gêner la
 * saisie : il part sans attendre et ses échecs sont ignorés.
 */
const ROUTE = '/cr-donnees/erreurs'

export function signalerErreur(action, erreur, contexte = {}) {
  try {
    fetch(ROUTE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action,
        message: String(erreur?.message ?? erreur ?? ''),
        contexte: { ...contexte, page: globalThis.location?.pathname, navigateur: globalThis.navigator?.userAgent },
      }),
    }).catch(() => {})
  } catch { /* le journal ne doit jamais casser la page */ }
}

/** Les dernières erreurs ; `null` quand l'accès est refusé. */
export async function lireErreurs(origine = '') {
  const r = await fetch(origine ? `${ROUTE}?origine=${origine}` : ROUTE)
  if (r.status === 401 || r.status === 403) return null
  if (!r.ok) throw new Error(String(r.status))
  return (await r.json()).erreurs
}
