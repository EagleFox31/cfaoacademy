/**
 * Vrai sur un poste de développement : serveur Vite de dev, ou recette servie
 * depuis un build (VITE_POSTE_DEV=1, frontend/compose.dev.yml). Jamais en prod.
 */
export const POSTE_DEV = import.meta.env.DEV || import.meta.env.VITE_POSTE_DEV === '1'
