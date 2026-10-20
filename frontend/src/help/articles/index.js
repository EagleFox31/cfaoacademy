import rawItems from './items.json'

const ITEMS = rawItems

function normalizeLocale(locale) {
  const code = (locale ?? 'fr').slice(0, 2).toLowerCase()
  return ['fr', 'en', 'pt'].includes(code) ? code : 'fr'
}

function localizeItem(item, locale) {
  const loc = normalizeLocale(locale)
  const copy = item[loc] ?? item.fr ?? {}
  return {
    id: item.id,
    topics: item.topics ?? [],
    roles: item.roles ?? ['*'],
    contextKeys: item.contextKeys ?? [],
    title: copy.title ?? '',
    summary: copy.summary ?? '',
    body: copy.body ?? '',
  }
}

function roleMatches(articleRoles, userRole) {
  if (!articleRoles?.length || articleRoles.includes('*')) return true
  return articleRoles.includes(userRole)
}

export function getHelpArticles(locale = 'fr') {
  return ITEMS.map((item) => localizeItem(item, locale))
}

export function getHelpArticle(id, locale = 'fr') {
  const item = ITEMS.find((entry) => entry.id === id)
  return item ? localizeItem(item, locale) : null
}

export function filterHelpArticles({
  locale = 'fr',
  role = 'learner',
  contextKey = null,
  query = '',
  topic = null,
} = {}) {
  const q = query.trim().toLowerCase()
  return getHelpArticles(locale).filter((article) => {
    if (!roleMatches(article.roles, role)) return false
    if (topic && !article.topics.includes(topic)) return false
    if (contextKey && !article.contextKeys.includes(contextKey)) return false
    if (!q) return true
    const haystack = `${article.title} ${article.summary} ${article.body}`.toLowerCase()
    return haystack.includes(q)
  })
}

export function getContextualHelpArticles({ locale, role, contextKey }) {
  if (!contextKey) return []
  return filterHelpArticles({ locale, role, contextKey })
}

export const HELP_TOPICS = [
  { id: 'portal', labelKey: 'topic_portal' },
  { id: 'training', labelKey: 'topic_training' },
  { id: 'results', labelKey: 'topic_results' },
  { id: 'support', labelKey: 'topic_support' },
]

export { ITEMS as HELP_ARTICLE_ITEMS }
