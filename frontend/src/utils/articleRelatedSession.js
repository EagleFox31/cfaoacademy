import { SESSIONS } from '../data/index.js'

/** Catégories où un lien vers une session agenda a du sens. */
const SESSION_LINK_CATS = new Set(['formation', 'certification'])

function normCat(cat) {
  return (cat ?? '')
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
}

function sessionMatchesBrand(session, brand) {
  const key = brand.toUpperCase()
  const marque = session.marque.toUpperCase()
  if (marque === 'TOUTES MARQUES' || marque === 'TOUTES MARQUES VL') {
    return false
  }
  const token = key.split(/\s+/)[0]
  return marque === key || marque.includes(key) || marque.includes(token)
}

function preferPlace(sessions, article) {
  const hint = `${article.title} ${article.content} ${article.summary}`.toLowerCase()
  const placeHints = [
    ['lagos', (s) => /nigeria/i.test(s.lieu)],
    ['nigeria', (s) => /nigeria/i.test(s.lieu)],
    ['douala', (s) => /douala/i.test(s.lieu)],
    ['abidjan', (s) => /côte|rci|ivoire/i.test(s.lieu)],
    ['togo', (s) => /togo/i.test(s.lieu)],
  ]
  for (const [needle, test] of placeHints) {
    if (hint.includes(needle)) {
      const found = sessions.find(test)
      if (found) return found
    }
  }
  return sessions[0]
}

/**
 * Session agenda liée — uniquement Formation / Certification avec marque connue.
 * Pas d’événements, pas de repli par BU ni première session du catalogue.
 */
export function relatedSession(article) {
  if (!article?.brand) return null
  if (!SESSION_LINK_CATS.has(normCat(article.category))) return null

  const matches = SESSIONS.filter((s) => sessionMatchesBrand(s, article.brand))
  return matches.length ? preferPlace(matches, article) : null
}
