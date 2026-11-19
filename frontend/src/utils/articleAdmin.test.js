import { describe, expect, it } from 'vitest'
import { ARTICLES } from '../data/articles/index.js'
import { articleLocales, articleRows, missingTranslations } from './articleAdmin.js'

describe('articleAdmin', () => {
  it('reconnaît un article traduit en anglais et en portugais', () => {
    expect(articleLocales('toyota-g3-diagnostic-douala-2026')).toEqual({ fr: true, en: true, pt: true })
  })

  it('signale un article sans traduction', () => {
    expect(articleLocales('article-inexistant')).toEqual({ fr: true, en: false, pt: false })
  })

  it('donne une ligne par article, dans l\'ordre de l\'accueil', () => {
    const rows = articleRows(ARTICLES)
    expect(rows).toHaveLength(ARTICLES.length)
    expect(rows[0].slug).toBe(ARTICLES[0].slug)
    expect(missingTranslations(rows)).toBeGreaterThanOrEqual(0)
  })

  it('compte les articles à traduire', () => {
    const rows = [
      { locales: { fr: true, en: true, pt: true } },
      { locales: { fr: true, en: false, pt: true } },
    ]
    expect(missingTranslations(rows)).toBe(1)
  })
})
