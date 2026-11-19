/**
 * Articles de l'accueil vus par la console d'administration (lecture).
 * Source : `data/articles/*.json` (français) + traductions
 * `i18n/locales/<langue>/articles.json` (titre, résumé) et `i18n/articleBodies.js` (texte).
 */
import { getCopy } from '../i18n/index.js'
import { ARTICLE_BODIES } from '../i18n/articleBodies.js'

/** Langues dans lesquelles l'article est complet (titre, résumé et texte). */
export function articleLocales(slug) {
  const traduit = locale => {
    const copy = getCopy('articles', locale)?.[slug]
    return Boolean(copy?.title && copy?.summary && ARTICLE_BODIES[locale]?.[slug])
  }
  return { fr: true, en: traduit('en'), pt: traduit('pt') }
}

/** Lignes du tableau, les plus récentes d'abord (ordre de `ARTICLES`). */
export function articleRows(articles = []) {
  return articles.map(a => ({
    slug: a.slug,
    date: a.date,
    category: a.category,
    brand: a.brand,
    title: a.title,
    locales: articleLocales(a.slug),
  }))
}

/** Articles auxquels il manque au moins une traduction. */
export function missingTranslations(rows = []) {
  return rows.filter(r => !r.locales.en || !r.locales.pt).length
}
