/**
 * L'adresse du module des comptes rendus (`cfao-comptes-rendus/web`), servi
 * à part du portail. VITE_CR_URL la fixe ; sans elle, l'adresse locale.
 */
const DEFAUT = 'http://localhost:8090'

/** L'adresse de base, sans barre finale. */
export function baseComptesRendus() {
  return String(import.meta.env?.VITE_CR_URL || DEFAUT).replace(/\/+$/, '')
}

/**
 * L'adresse d'une page du module : le chemin, la query et l'ancre sont
 * conservés tels quels, pour que les anciens liens du portail arrivent
 * sur la même page.
 */
export function adresseComptesRendus({ pathname = '/', search = '', hash = '' } = {}, base = baseComptesRendus()) {
  return `${base.replace(/\/+$/, '')}${pathname}${search}${hash}`
}
