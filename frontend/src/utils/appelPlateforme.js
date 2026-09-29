/**
 * Les appels aux services de la plateforme (API, rendu des rapports).
 *
 * Le navigateur ne detient aucun jeton : le BFF (oauth2-proxy) porte la
 * session dans un cookie httpOnly et reinjecte le Bearer vers les services
 * (architecture_complement.md §5). Chaque appel part donc avec ce cookie.
 *
 * Sans session, le BFF repond 401 : on envoie le navigateur se connecter,
 * puis revenir sur la page en cours. Une seule redirection par minute, pour
 * ne jamais boucler si le BFF est indisponible.
 */
const CLE_REDIRECTION = 'cfao.connexion-demandee'

export function allerSeConnecter() {
  try {
    const derniere = Number(sessionStorage.getItem(CLE_REDIRECTION) || 0)
    if (Date.now() - derniere < 60_000) return false
    sessionStorage.setItem(CLE_REDIRECTION, String(Date.now()))
  } catch {
    // Stockage indisponible : on redirige quand meme, une fois par chargement.
  }
  const retour = `${window.location.pathname}${window.location.search}${window.location.hash}`
  window.location.assign(`/oauth2/start?rd=${encodeURIComponent(retour)}`)
  return true
}

/** `fetch` vers un service de la plateforme ; un 401 declenche la connexion. */
export async function appelPlateforme(url, options = {}) {
  const reponse = await fetch(url, { credentials: 'same-origin', ...options })
  if (reponse.status === 401) allerSeConnecter()
  return reponse
}
