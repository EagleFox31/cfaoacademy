/**
 * Portail de l'équipe du centre de formation : directeur, coordinateur,
 * assistante. Vitrine par rôle : chaque carte ouvre une application existante
 * (clé de répartition, besoins) ou annonce un écran à venir.
 *
 * Textes : locales/<langue>/centerHome.json. Ce module ne fait que les
 * regrouper pour les imports existants ; l'application passe par getCopy.
 */
import fr from './locales/fr/centerHome.json'
import en from './locales/en/centerHome.json'
import pt from './locales/pt/centerHome.json'

export const CENTER_HOME_COPY = { fr, en, pt }
