import { filterHelpArticles } from './articles/index.js'

/** Recherche textuelle simple dans les articles localisés. */
export function searchHelpArticles({ locale, role, query, limit = 12 }) {
  if (!query?.trim()) return []
  return filterHelpArticles({ locale, role, query }).slice(0, limit)
}

export function rankHelpArticles(articles, contextKey) {
  if (!contextKey) return articles
  return [...articles].sort((a, b) => {
    const aMatch = a.contextKeys?.includes(contextKey) ? 1 : 0
    const bMatch = b.contextKeys?.includes(contextKey) ? 1 : 0
    return bMatch - aMatch
  })
}
