/**
 * Après une mise en ligne, un onglet resté ouvert réclame des morceaux de page dont
 * le nom haché n'existe plus. On recharge une fois pour prendre la nouvelle version.
 * Si cela échoue encore, RepliChargement affiche un bouton : jamais de boucle.
 */
const CLE = 'cfao-rechargement-morceau'
export const DELAI_ENTRE_RECHARGEMENTS_MS = 60_000

function stockageSession() {
  try {
    return window.sessionStorage
  } catch {
    return null
  }
}

function dejaRecharge(stockage, maintenant) {
  const dernier = Number(stockage.getItem(CLE)) || 0
  return maintenant - dernier < DELAI_ENTRE_RECHARGEMENTS_MS
}

export function surEchecMorceau(event, {
  stockage = stockageSession(),
  recharger = () => window.location.reload(),
  maintenant = Date.now(),
} = {}) {
  try {
    // Sans stockage utilisable, on ne saurait pas borner les rechargements.
    if (!stockage || dejaRecharge(stockage, maintenant)) return
    stockage.setItem(CLE, String(maintenant))
  } catch {
    return
  }
  event.preventDefault()
  recharger()
}
