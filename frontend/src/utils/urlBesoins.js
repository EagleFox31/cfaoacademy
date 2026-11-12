/**
 * L'adresse du module « Recueil des besoins » (cfao-needs), servi à part du
 * portail. VITE_NEEDS_URL la fixe ; sans elle, l'adresse locale du compose.
 */
const DEFAUT = 'http://localhost:8080'

export function baseBesoins() {
  return String(import.meta.env?.VITE_NEEDS_URL || DEFAUT).replace(/\/+$/, '')
}
