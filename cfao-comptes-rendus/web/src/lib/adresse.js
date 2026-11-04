/**
 * Préfixe sous lequel l'interface est servie : `/cr/` derrière cfao-edge,
 * `/` en développement. Fixé au build par `CR_BASE` (vite.config.js).
 */
export const BASE = import.meta.env.BASE_URL

/** Adresse d'une ressource du module : `adresse('/apercu/page')` -> `/cr/apercu/page`. */
export const adresse = chemin => BASE + chemin.replace(/^\//, '')
