import { BASE } from './adresse'

/**
 * Adresse de l'accueil formateur du portail CFAO Academy, seule vitrine du
 * formateur : le module des comptes rendus n'a que ses écrans de travail.
 *
 * `VITE_PORTAIL_URL` si elle est fixée au build ; sinon, derrière cfao-edge
 * (module servi sous `/cr/`), le portail est sur la même origine, en
 * `/portail`. Servi seul à la racine (développement), il n'y a pas de portail.
 */
export const PORTAIL_URL = import.meta.env.VITE_PORTAIL_URL || (BASE !== '/' ? '/portail' : null)

/** Adresse du portail, avec une ancre de l'accueil formateur si besoin. */
export function adressePortail(ancre = '') {
  if (!PORTAIL_URL) return null
  return ancre ? `${PORTAIL_URL}#${ancre.replace(/^#/, '')}` : PORTAIL_URL
}
