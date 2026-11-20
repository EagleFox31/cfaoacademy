/**
 * Configuration du déploiement, lue au démarrage du navigateur.
 *
 * En production, l'image du portail écrit `/config.js` au lancement du conteneur
 * (`entrypoint.d/15-config.sh`) : `window.__PORTAIL_CONFIG__` porte l'émetteur OIDC,
 * le client, les adresses des modules. Aucun hôte n'est donc figé dans l'image.
 * Sur le poste et en recette, l'objet est vide : on retombe sur les variables Vite.
 */
function configDeploiement() {
  if (typeof window === 'undefined') return {}
  const config = window.__PORTAIL_CONFIG__
  return config && typeof config === 'object' ? config : {}
}

/** Valeur texte du déploiement si elle est renseignée, sinon la valeur Vite. */
export function valeurConfig(cle, valeurVite) {
  const valeur = configDeploiement()[cle]
  if (typeof valeur === 'string' && valeur.trim()) return valeur.trim()
  return typeof valeurVite === 'string' ? valeurVite.trim() : ''
}

/** Drapeau du déploiement (vrai seulement si `true` explicitement). */
export function drapeauConfig(cle) {
  return configDeploiement()[cle] === true
}
