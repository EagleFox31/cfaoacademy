/**
 * L'adresse du module des comptes rendus (`cfao-comptes-rendus/web`), servi
 * à part du portail. `crUrl` du déploiement (`/config.js`) ou VITE_CR_URL la
 * fixe ; sans elles, l'adresse locale.
 */
import { valeurConfig } from '../lib/configExecution'

const DEFAUT = 'http://localhost:8090'

/** L'adresse de base, sans barre finale. */
export function baseComptesRendus() {
  return String(valeurConfig('crUrl', import.meta.env?.VITE_CR_URL) || DEFAUT).replace(/\/+$/, '')
}

/**
 * L'adresse d'une page du module : le chemin, la query et l'ancre sont
 * conservés tels quels, pour que les anciens liens du portail arrivent
 * sur la même page.
 */
export function adresseComptesRendus({ pathname = '/', search = '', hash = '' } = {}, base = baseComptesRendus()) {
  return `${base.replace(/\/+$/, '')}${pathname}${search}${hash}`
}
